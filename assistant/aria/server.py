"""Local web server: serves the UI, streams agent progress over SSE, runs schedules.

    python3 -m aria.server [--port 8765] [--host 127.0.0.1]

Binds to localhost by default -- there is no auth, so don't expose it publicly.
"""
from __future__ import annotations

import argparse
import json
import queue
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import store
from .agent import Aria

STATIC = Path(__file__).resolve().parent.parent / "static"
SCHEDULER_TICK = 30  # seconds


def run_due_schedules(aria: Aria, now: float | None = None) -> list[str]:
    """Run every due schedule once; returns the ids that ran."""
    ran = []
    for s in store.list_schedules():
        if not store.schedule_is_due(s, now):
            continue
        # Mark first so a slow run isn't picked up again by the next tick.
        store.update_schedule(s["id"], last_run=time.time() if now is None else now)
        try:
            result = aria.run_companion(s["companion"], s["task"])
            store.add_note(f"Scheduled: {s['task'][:60]}", result, s["companion"])
            store.update_schedule(s["id"], last_result="ok")
        except Exception as e:
            store.update_schedule(s["id"], last_result=f"error: {e}")
        ran.append(s["id"])
    return ran


def _scheduler(aria: Aria) -> None:
    while True:
        try:
            run_due_schedules(aria)
        except Exception:
            traceback.print_exc()
        time.sleep(SCHEDULER_TICK)


def make_handler(aria: Aria):
    class Handler(BaseHTTPRequestHandler):
        server_version = "Aria/0.1"

        def log_message(self, fmt, *args):  # quieter console
            if "/api/state" not in (args[0] if args else ""):
                sys.stderr.write("[aria] " + fmt % args + "\n")

        # --- helpers ---
        def _json(self, obj, status=200):
            body = json.dumps(obj).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _body(self) -> dict:
            n = int(self.headers.get("Content-Length") or 0)
            if not n:
                return {}
            return json.loads(self.rfile.read(n) or b"{}")

        def _parts(self) -> list[str]:
            return [p for p in self.path.split("?")[0].split("/") if p]

        # --- routes ---
        def do_GET(self):
            parts = self._parts()
            if not parts:
                return self._static("index.html")
            if parts[0] == "static" and len(parts) == 2:
                return self._static(parts[1])
            if parts == ["api", "state"]:
                return self._json({
                    "companions": store.list_companions(),
                    "memories": store.list_memories(),
                    "schedules": store.list_schedules(),
                    "notes": [{k: n[k] for k in ("id", "title", "companion", "created")}
                              for n in store.list_notes()],
                    "history": store.get_history(),
                    "connectors": [c.get("name") for c in store.list_connectors()],
                })
            if parts[:2] == ["api", "notes"] and len(parts) == 3:
                for n in store.list_notes():
                    if n["id"] == parts[2]:
                        return self._json(n)
                return self._json({"error": "not found"}, 404)
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            parts = self._parts()
            try:
                body = self._body()
            except json.JSONDecodeError:
                return self._json({"error": "invalid JSON"}, 400)
            if parts == ["api", "chat"]:
                return self._chat(str(body.get("text", "")).strip())
            if parts == ["api", "companions"]:
                try:
                    return self._json(store.upsert_companion(str(body.get("key", "")), body))
                except ValueError as e:
                    return self._json({"error": str(e)}, 400)
            if parts == ["api", "memory"]:
                text = str(body.get("text", "")).strip()
                if not text:
                    return self._json({"error": "text required"}, 400)
                return self._json(store.add_memory(text, source="user"))
            self._json({"error": "not found"}, 404)

        def do_DELETE(self):
            parts = self._parts()
            ok = False
            if parts == ["api", "memory"]:
                store.clear_memories(); ok = True
            elif parts == ["api", "history"]:
                store.clear_history(); ok = True
            elif len(parts) == 3 and parts[0] == "api":
                fn = {"memory": store.delete_memory, "companions": store.delete_companion,
                      "schedules": store.delete_schedule, "notes": store.delete_note}.get(parts[1])
                ok = bool(fn and fn(parts[2]))
            self._json({"ok": ok}, 200 if ok else 404)

        def _static(self, name: str):
            p = (STATIC / name).resolve()
            if STATIC not in p.parents or not p.is_file():
                return self._json({"error": "not found"}, 404)
            ctype = {".html": "text/html", ".js": "text/javascript",
                     ".css": "text/css"}.get(p.suffix, "application/octet-stream")
            data = p.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _chat(self, text: str):
            if not text:
                return self._json({"error": "text required"}, 400)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            events: queue.Queue = queue.Queue()

            def work():
                try:
                    reply = aria.chat(text, emit=events.put)
                    events.put({"type": "reply", "text": reply})
                except Exception as e:
                    traceback.print_exc()
                    events.put({"type": "error", "message": str(e)})
                events.put(None)

            threading.Thread(target=work, daemon=True).start()
            while True:
                try:
                    ev = events.get(timeout=15)
                except queue.Empty:
                    ev = {"type": "ping"}  # keep the connection alive during long runs
                if ev is None:
                    break
                try:
                    self.wfile.write(f"data: {json.dumps(ev)}\n\n".encode())
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    break  # browser left; the work thread still finishes and saves history

    return Handler


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Run the Aria assistant web app.")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-scheduler", action="store_true", help="don't run scheduled tasks")
    args = ap.parse_args(argv)

    aria = Aria()
    if not args.no_scheduler:
        threading.Thread(target=_scheduler, args=(aria,), daemon=True).start()
    httpd = ThreadingHTTPServer((args.host, args.port), make_handler(aria))
    print(f"[aria] data dir: {store.data_dir()}")
    print(f"[aria] open http://{args.host}:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
