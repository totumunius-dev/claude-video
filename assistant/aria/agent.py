"""Orchestrator + companion agents on the Claude API.

Aria (the orchestrator) talks to the user, keeps memory, and delegates work to
companions through the ``delegate`` tool. Several ``delegate`` calls in one turn
run in parallel threads -- that is the "dispatch parallel bots" behavior. Each
companion is its own tool-use loop with web search (if enabled), any connected
MCP servers, memory, and a notes workspace.

Progress is reported through an ``emit(event: dict)`` callback so the UI can
animate the workspace while work happens.
"""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from . import store

MODEL = "claude-opus-5-5"
MAX_TOKENS = 16000
MAX_STEPS = 24  # hard stop on runaway tool loops
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MCP_BETA = "mcp-client-2025-11-20"

Emit = Callable[[dict], None]


def _noop(_: dict) -> None:
    pass


# --- tool schemas ------------------------------------------------------------------

def _tool(name: str, description: str, props: dict, required: list[str]) -> dict:
    return {
        "name": name,
        "description": description,
        "input_schema": {"type": "object", "properties": props, "required": required},
    }


T_REMEMBER = _tool(
    "remember",
    "Save a durable fact about the user (preferences, goals, people, projects, "
    "tone of voice). Only save things worth knowing in future conversations.",
    {"fact": {"type": "string", "description": "One self-contained fact."}},
    ["fact"],
)
T_FORGET = _tool(
    "forget",
    "Erase a memory by id when the user asks you to forget something or a fact "
    "is no longer true.",
    {"memory_id": {"type": "string"}},
    ["memory_id"],
)
T_DELEGATE = _tool(
    "delegate",
    "Hand a task to a companion. Give a complete, self-contained brief -- the "
    "companion does not see this conversation. Call this several times in one "
    "turn to run companions in parallel.",
    {
        "companion": {"type": "string", "description": "Companion key, e.g. 'research'."},
        "task": {"type": "string", "description": "Full brief including any context needed."},
    },
    ["companion", "task"],
)
T_CREATE_COMPANION = _tool(
    "create_companion",
    "Add a new specialist companion to the user's team (or update one) when the "
    "user's goals need a skill the current team lacks.",
    {
        "key": {"type": "string", "description": "Short lowercase id, e.g. 'finance'."},
        "name": {"type": "string"},
        "role": {"type": "string", "description": "One-line description of what it does."},
        "instructions": {"type": "string", "description": "System instructions for the companion."},
        "web": {"type": "boolean", "description": "Whether it may search the web."},
    },
    ["key", "name", "role", "instructions"],
)
T_SCHEDULE = _tool(
    "schedule_task",
    "Run a companion task on a recurring schedule. Use every_minutes for "
    "intervals or daily_at (24h HH:MM, server local time) for a daily run.",
    {
        "companion": {"type": "string"},
        "task": {"type": "string", "description": "Self-contained brief run on each firing."},
        "every_minutes": {"type": "integer"},
        "daily_at": {"type": "string"},
    },
    ["companion", "task"],
)
T_LIST_SCHEDULES = _tool("list_schedules", "List recurring scheduled tasks.", {}, [])
T_CANCEL_SCHEDULE = _tool(
    "cancel_schedule", "Cancel a scheduled task by id.",
    {"schedule_id": {"type": "string"}}, ["schedule_id"],
)
T_SAVE_NOTE = _tool(
    "save_note",
    "Save a finished deliverable (report, draft, plan, list) to the user's "
    "workspace so they can open it later.",
    {"title": {"type": "string"}, "content": {"type": "string", "description": "Markdown."}},
    ["title", "content"],
)
T_LIST_NOTES = _tool("list_notes", "List saved workspace notes (titles and ids).", {}, [])
T_READ_NOTE = _tool(
    "read_note", "Read a saved workspace note by id.",
    {"note_id": {"type": "string"}}, ["note_id"],
)
WEB_SEARCH = {"type": "web_search_20260209", "name": "web_search", "max_uses": 8}


# --- prompts --------------------------------------------------------------------------

ORCHESTRATOR_PROMPT = """You are Aria, the user's personal AI operating system. You \
lead a team of specialist companions and act as the user's single point of contact.

How you work:
- Answer simple questions and small talk yourself, briefly.
- For real work (research, writing, planning, outreach, anything multi-step), \
delegate to the best-fit companion with a complete brief. Split independent \
parts across companions and call `delegate` several times in the same turn so \
they run in parallel. Then synthesize their results into one answer.
- If no companion fits, create one with `create_companion`, then delegate.
- When the user shares lasting facts (goals, preferences, people, projects), \
save them with `remember`. When they ask you to forget something, use `forget`.
- When work should repeat ("every morning", "weekly"), set it up with `schedule_task`.
- Replies may be read aloud: lead with the answer, keep it conversational, and \
avoid heavy markdown unless the user asked for a document. Mention when a \
companion saved a note so the user knows where to find it."""

COMPANION_PROMPT = """{instructions}

You are a companion on the user's team inside Aria, their personal AI operating \
system. You were handed a task by Aria, who will relay your result to the user. \
Do the work fully, using your tools, then reply with the result itself -- not a \
description of what you did. If something essential is missing, make a \
reasonable assumption and state it."""


def _memory_block() -> str:
    mems = store.list_memories()[-200:]
    if not mems:
        return "Memory: nothing saved about the user yet."
    lines = "\n".join(f"- [{m['id']}] {m['text']}" for m in mems)
    return f"What you remember about the user (id in brackets):\n{lines}"


def _team_block() -> str:
    comps = store.list_companions()
    lines = "\n".join(f"- {k}: {c['name']} -- {c['role']}" for k, c in comps.items())
    return f"Your companions (key: name -- role):\n{lines}"


def _context_block() -> str:
    return "Current local time: " + time.strftime("%A %Y-%m-%d %H:%M")


# --- agent ----------------------------------------------------------------------------

class Aria:
    def __init__(self, client: Any = None, model: str = MODEL):
        if client is None:
            import anthropic  # imported lazily so the store/tests don't need the SDK

            client = anthropic.Anthropic()
        self.client = client
        self.model = model

    # One tool-use loop. Shared by the orchestrator and every companion.
    def _loop(self, *, who: str, system: list[dict], messages: list[dict],
              tools: list[dict], handlers: dict[str, Callable[[dict], str]],
              effort: str, emit: Emit, mcp: list[dict] | None = None) -> str:
        betas = [FALLBACK_BETA]
        extra: dict[str, Any] = {}
        if mcp:
            betas.append(MCP_BETA)
            extra["mcp_servers"] = [
                {"type": "url", **{k: v for k, v in s.items() if k in ("url", "name", "authorization_token")}}
                for s in mcp
            ]
            tools = tools + [{"type": "mcp_toolset", "mcp_server_name": s["name"]} for s in mcp]

        for _ in range(MAX_STEPS):
            resp = self.client.beta.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                tools=tools,
                betas=betas,
                fallbacks="default",
                output_config={"effort": effort},
                cache_control={"type": "ephemeral"},
                **extra,
            )
            if resp.stop_reason == "refusal":
                return "I can't help with that request."

            messages.append({"role": "assistant", "content": resp.content})
            for block in resp.content:
                if block.type in ("server_tool_use", "mcp_tool_use"):
                    emit({"type": "tool", "who": who, "tool": getattr(block, "name", block.type)})

            if resp.stop_reason == "pause_turn":
                continue  # server-side tool loop paused; resend to resume
            if resp.stop_reason != "tool_use":
                text = "".join(b.text for b in resp.content if b.type == "text").strip()
                if resp.stop_reason == "max_tokens":
                    text += "\n\n(Response was cut off at the length limit.)"
                return text

            calls = [b for b in resp.content if b.type == "tool_use"]
            for c in calls:
                if c.name != "delegate":
                    emit({"type": "tool", "who": who, "tool": c.name})

            def run(call: Any) -> dict:
                handler = handlers.get(call.name)
                try:
                    if handler is None:
                        raise ValueError(f"unknown tool {call.name}")
                    out = handler(dict(call.input or {}))
                    return {"type": "tool_result", "tool_use_id": call.id, "content": out}
                except Exception as e:  # tool errors go back to the model, not the user
                    return {"type": "tool_result", "tool_use_id": call.id,
                            "content": f"Error: {e}", "is_error": True}

            if len(calls) > 1:
                with ThreadPoolExecutor(max_workers=min(8, len(calls))) as pool:
                    results = list(pool.map(run, calls))
            else:
                results = [run(c) for c in calls]
            messages.append({"role": "user", "content": results})

        return "I stopped because this task took too many steps. Try breaking it into smaller pieces."

    # --- companions -------------------------------------------------------------

    def run_companion(self, key: str, task: str, emit: Emit = _noop) -> str:
        comps = store.list_companions()
        if key not in comps:
            raise ValueError(f"no companion '{key}'. Available: {', '.join(comps)}")
        comp = comps[key]
        emit({"type": "companion_start", "who": key, "task": task})

        handlers = {
            "remember": lambda i: self._remember(i, source=key, emit=emit),
            "save_note": lambda i: self._save_note(i, key, emit),
            "list_notes": lambda i: self._list_notes(),
            "read_note": lambda i: self._read_note(i),
        }
        tools = [T_REMEMBER, T_SAVE_NOTE, T_LIST_NOTES, T_READ_NOTE]
        if comp.get("web"):
            tools.append(WEB_SEARCH)

        system = [
            {"type": "text", "text": COMPANION_PROMPT.format(instructions=comp["instructions"])},
            {"type": "text", "text": _memory_block() + "\n\n" + _context_block()},
        ]
        try:
            result = self._loop(
                who=key, system=system,
                messages=[{"role": "user", "content": task}],
                tools=tools, handlers=handlers, effort="high", emit=emit,
                mcp=store.list_connectors() or None,
            )
        except Exception as e:
            emit({"type": "companion_done", "who": key, "ok": False})
            raise RuntimeError(f"{comp['name']} failed: {e}") from e
        emit({"type": "companion_done", "who": key, "ok": True})
        return result

    # --- orchestrator -----------------------------------------------------------------

    def chat(self, user_text: str, emit: Emit = _noop) -> str:
        handlers = {
            "delegate": lambda i: self._delegate(i, emit),
            "remember": lambda i: self._remember(i, source="aria", emit=emit),
            "forget": lambda i: self._forget(i, emit),
            "create_companion": lambda i: self._create_companion(i, emit),
            "schedule_task": lambda i: self._schedule(i, emit),
            "list_schedules": lambda i: json.dumps(store.list_schedules()),
            "cancel_schedule": lambda i: self._cancel_schedule(i, emit),
            "list_notes": lambda i: self._list_notes(),
            "read_note": lambda i: self._read_note(i),
        }
        tools = [T_DELEGATE, T_REMEMBER, T_FORGET, T_CREATE_COMPANION, T_SCHEDULE,
                 T_LIST_SCHEDULES, T_CANCEL_SCHEDULE, T_LIST_NOTES, T_READ_NOTE]
        system = [
            {"type": "text", "text": ORCHESTRATOR_PROMPT},
            {"type": "text", "text": "\n\n".join([_team_block(), _memory_block(), _context_block()])},
        ]
        messages = store.get_history() + [{"role": "user", "content": user_text}]
        emit({"type": "thinking", "who": "aria"})
        reply = self._loop(who="aria", system=system, messages=messages, tools=tools,
                           handlers=handlers, effort="medium", emit=emit)
        store.append_history(user_text, reply)
        return reply

    # --- tool handlers ----------------------------------------------------------------------

    def _delegate(self, i: dict, emit: Emit) -> str:
        return self.run_companion(i["companion"], i["task"], emit)

    def _remember(self, i: dict, source: str, emit: Emit) -> str:
        item = store.add_memory(i["fact"], source=source)
        emit({"type": "memory", "action": "add", "item": item})
        return f"Saved memory {item['id']}."

    def _forget(self, i: dict, emit: Emit) -> str:
        ok = store.delete_memory(i["memory_id"])
        emit({"type": "memory", "action": "delete", "id": i["memory_id"]})
        return "Forgotten." if ok else "No memory with that id."

    def _create_companion(self, i: dict, emit: Emit) -> str:
        comp = store.upsert_companion(i["key"], i)
        emit({"type": "team_changed"})
        return f"Companion '{comp['key']}' ({comp['name']}) is ready."

    def _schedule(self, i: dict, emit: Emit) -> str:
        if i["companion"] not in store.list_companions():
            raise ValueError(f"no companion '{i['companion']}'")
        s = store.add_schedule(i["companion"], i["task"],
                               every_minutes=i.get("every_minutes"), daily_at=i.get("daily_at"))
        emit({"type": "schedules_changed"})
        return f"Scheduled {s['id']}."

    def _cancel_schedule(self, i: dict, emit: Emit) -> str:
        ok = store.delete_schedule(i["schedule_id"])
        emit({"type": "schedules_changed"})
        return "Cancelled." if ok else "No schedule with that id."

    def _save_note(self, i: dict, companion: str, emit: Emit) -> str:
        note = store.add_note(i["title"], i["content"], companion)
        emit({"type": "note", "item": {k: note[k] for k in ("id", "title", "companion")}})
        return f"Saved note {note['id']}."

    def _list_notes(self) -> str:
        notes = store.list_notes()
        if not notes:
            return "No notes yet."
        return "\n".join(f"[{n['id']}] {n['title']} (by {n['companion']})" for n in notes[-50:])

    def _read_note(self, i: dict) -> str:
        for n in store.list_notes():
            if n["id"] == i["note_id"]:
                return f"# {n['title']}\n\n{n['content']}"
        raise ValueError("no note with that id")
