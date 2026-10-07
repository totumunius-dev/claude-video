"""JSON-file persistence for memory, companions, schedules, notes, and chat history.

Everything lives in one directory (``$ARIA_HOME`` or ``~/.config/aria``) so the
user can read, back up, or wipe it by hand. Writes are atomic (tmp + rename) and
serialized with a process-wide lock because the HTTP server and the scheduler
thread both write.
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any

_LOCK = threading.RLock()

DEFAULT_COMPANIONS: dict[str, dict[str, Any]] = {
    "research": {
        "name": "Research",
        "role": "Finds, verifies, and summarizes information from the web.",
        "instructions": (
            "You are the Research companion. Search the web when facts may be "
            "recent or uncertain, cross-check claims across sources, and return a "
            "tight summary with source links. Save substantial findings as a note."
        ),
        "web": True,
        "color": "#4f8cff",
    },
    "creative": {
        "name": "Creative",
        "role": "Writes copy, scripts, posts, names, and creative concepts.",
        "instructions": (
            "You are the Creative companion. Produce polished drafts in the user's "
            "voice (check memory for tone and brand details). Offer 2-3 options "
            "when the brief is open-ended. Save finished drafts as notes."
        ),
        "web": False,
        "color": "#ff6fae",
    },
    "operations": {
        "name": "Operations",
        "role": "Plans, organizes, schedules recurring work, and tracks tasks.",
        "instructions": (
            "You are the Operations companion. Turn goals into concrete plans and "
            "checklists, and set up recurring schedules when work should repeat. "
            "Be specific about owners, dates, and next actions."
        ),
        "web": False,
        "color": "#33c58a",
    },
    "sales": {
        "name": "Sales",
        "role": "Prospect research, outreach emails, follow-ups, and pitch prep.",
        "instructions": (
            "You are the Sales companion. Research prospects, draft personalized "
            "outreach and follow-ups, and prepare objection handling. Keep emails "
            "short and specific. Save drafts as notes."
        ),
        "web": True,
        "color": "#ffb020",
    },
}

HISTORY_LIMIT = 40  # text turns kept for conversational context


def data_dir() -> Path:
    root = Path(os.environ.get("ARIA_HOME") or Path.home() / ".config" / "aria")
    root.mkdir(parents=True, exist_ok=True)
    return root


def _path(name: str) -> Path:
    return data_dir() / f"{name}.json"


def _load(name: str, default: Any) -> Any:
    p = _path(name)
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text())
    except (OSError, json.JSONDecodeError):
        return default


def _save(name: str, value: Any) -> None:
    p = _path(name)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, indent=2))
    os.replace(tmp, p)


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


# --- memory -----------------------------------------------------------------

def list_memories() -> list[dict]:
    with _LOCK:
        return _load("memory", [])


def add_memory(text: str, source: str = "aria") -> dict:
    with _LOCK:
        items = _load("memory", [])
        item = {"id": _new_id(), "text": text.strip(), "source": source, "created": time.time()}
        items.append(item)
        _save("memory", items)
        return item


def delete_memory(mem_id: str) -> bool:
    with _LOCK:
        items = _load("memory", [])
        kept = [m for m in items if m["id"] != mem_id]
        _save("memory", kept)
        return len(kept) != len(items)


def clear_memories() -> None:
    with _LOCK:
        _save("memory", [])


# --- companions ---------------------------------------------------------------

def list_companions() -> dict[str, dict]:
    with _LOCK:
        stored = _load("companions", None)
        if stored is None:
            stored = {k: dict(v) for k, v in DEFAULT_COMPANIONS.items()}
            _save("companions", stored)
        return stored


def upsert_companion(key: str, spec: dict) -> dict:
    key = "".join(c for c in key.lower() if c.isalnum() or c in "-_")[:32]
    if not key:
        raise ValueError("companion key must contain letters or digits")
    with _LOCK:
        comps = list_companions()
        current = comps.get(key, {})
        current.update({
            "name": spec.get("name") or current.get("name") or key.title(),
            "role": spec.get("role") or current.get("role", ""),
            "instructions": spec.get("instructions") or current.get("instructions", ""),
            "web": bool(spec.get("web", current.get("web", False))),
            "color": spec.get("color") or current.get("color") or "#9b7bff",
        })
        comps[key] = current
        _save("companions", comps)
        return {"key": key, **current}


def delete_companion(key: str) -> bool:
    with _LOCK:
        comps = list_companions()
        if key not in comps:
            return False
        del comps[key]
        _save("companions", comps)
        return True


# --- schedules ----------------------------------------------------------------

def list_schedules() -> list[dict]:
    with _LOCK:
        return _load("schedules", [])


def add_schedule(companion: str, task: str, every_minutes: int | None = None,
                 daily_at: str | None = None) -> dict:
    if not every_minutes and not daily_at:
        raise ValueError("give every_minutes or daily_at (HH:MM)")
    if daily_at:
        hh, mm = daily_at.split(":")
        if not (0 <= int(hh) < 24 and 0 <= int(mm) < 60):
            raise ValueError("daily_at must be HH:MM in 24h time")
    if every_minutes is not None and every_minutes < 5:
        raise ValueError("every_minutes must be at least 5")
    with _LOCK:
        items = _load("schedules", [])
        item = {
            "id": _new_id(), "companion": companion, "task": task,
            "every_minutes": every_minutes, "daily_at": daily_at,
            "created": time.time(), "last_run": None, "last_result": None,
        }
        items.append(item)
        _save("schedules", items)
        return item


def update_schedule(sched_id: str, **fields: Any) -> None:
    with _LOCK:
        items = _load("schedules", [])
        for s in items:
            if s["id"] == sched_id:
                s.update(fields)
        _save("schedules", items)


def delete_schedule(sched_id: str) -> bool:
    with _LOCK:
        items = _load("schedules", [])
        kept = [s for s in items if s["id"] != sched_id]
        _save("schedules", kept)
        return len(kept) != len(items)


def schedule_is_due(s: dict, now: float | None = None) -> bool:
    now = time.time() if now is None else now
    last = s.get("last_run")
    if s.get("every_minutes"):
        start = last if last is not None else s["created"]
        return now - start >= s["every_minutes"] * 60
    if s.get("daily_at"):
        hh, mm = (int(x) for x in s["daily_at"].split(":"))
        lt = time.localtime(now)
        target = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, hh, mm, 0, 0, 0, -1))
        return now >= target and (last is None or last < target) and s["created"] < target
    return False


# --- notes (companion deliverables) ------------------------------------------

def list_notes() -> list[dict]:
    with _LOCK:
        return _load("notes", [])


def add_note(title: str, content: str, companion: str) -> dict:
    with _LOCK:
        items = _load("notes", [])
        item = {"id": _new_id(), "title": title, "content": content,
                "companion": companion, "created": time.time()}
        items.append(item)
        _save("notes", items)
        return item


def delete_note(note_id: str) -> bool:
    with _LOCK:
        items = _load("notes", [])
        kept = [n for n in items if n["id"] != note_id]
        _save("notes", kept)
        return len(kept) != len(items)


# --- chat history ---------------------------------------------------------------

def get_history() -> list[dict]:
    with _LOCK:
        return _load("history", [])


def append_history(user_text: str, assistant_text: str) -> None:
    with _LOCK:
        hist = _load("history", [])
        hist.append({"role": "user", "content": user_text})
        hist.append({"role": "assistant", "content": assistant_text})
        _save("history", hist[-HISTORY_LIMIT:])


def clear_history() -> None:
    with _LOCK:
        _save("history", [])


# --- connectors (remote MCP servers) ----------------------------------------------

def list_connectors() -> list[dict]:
    """Remote MCP servers from ``connectors.json``: [{name, url, authorization_token?}]."""
    with _LOCK:
        return _load("connectors", [])
