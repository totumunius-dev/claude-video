"""Aria tests with a scripted fake Claude client (no network, no API key)."""
from __future__ import annotations

import json
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace as NS

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aria import agent, server, store  # noqa: E402


@pytest.fixture(autouse=True)
def aria_home(tmp_path, monkeypatch):
    monkeypatch.setenv("ARIA_HOME", str(tmp_path))
    return tmp_path


def text(t):
    return NS(type="text", text=t)


def call(name, inp, id_):
    return NS(type="tool_use", name=name, input=inp, id=id_)


def msg(*content, stop="end_turn"):
    return NS(stop_reason=stop, content=list(content))


class FakeClient:
    """Routes each request to a script keyed by who is asking (orchestrator or companion)."""

    def __init__(self, scripts):
        self.scripts = {k: list(v) for k, v in scripts.items()}
        self.requests = []
        self.lock = threading.Lock()
        self.beta = NS(messages=NS(create=self.create))

    def create(self, **kw):
        sys_text = kw["system"][0]["text"]
        who = "aria" if sys_text.startswith("You are Aria") else sys_text.split()[3].lower()
        with self.lock:
            # snapshot: the loop mutates `messages` after this call returns
            self.requests.append({**kw, "who": who, "messages": list(kw["messages"])})
            return self.scripts[who].pop(0)


def test_parallel_delegation_memory_and_notes():
    fake = FakeClient({
        "aria": [
            msg(text("On it."),
                call("remember", {"fact": "Runs a coffee brand called Bean There"}, "t1"),
                call("delegate", {"companion": "research", "task": "Find 3 coffee trends"}, "t2"),
                call("delegate", {"companion": "creative", "task": "Write a tagline"}, "t3"),
                stop="tool_use"),
            msg(text("Here are trends and a tagline.")),
        ],
        "research": [
            msg(NS(type="server_tool_use", name="web_search"), text("Trends: A, B, C")),
        ],
        "creative": [
            msg(call("save_note", {"title": "Taglines", "content": "Bean there, loved that."}, "c1"),
                stop="tool_use"),
            msg(text("Tagline: Bean there, loved that.")),
        ],
    })
    events = []
    reply = agent.Aria(client=fake).chat("Help me market my coffee brand", emit=events.append)

    assert reply == "Here are trends and a tagline."
    assert [m["text"] for m in store.list_memories()] == ["Runs a coffee brand called Bean There"]
    assert [n["title"] for n in store.list_notes()] == ["Taglines"]
    assert store.get_history()[-1] == {"role": "assistant", "content": reply}

    # every tool_use got exactly one result, in one user message
    final = [r for r in fake.requests if r["who"] == "aria"][-1]["messages"][-1]
    assert sorted(r["tool_use_id"] for r in final["content"]) == ["t1", "t2", "t3"]
    by_id = {r["tool_use_id"]: r["content"] for r in final["content"]}
    assert by_id["t2"] == "Trends: A, B, C"

    # web search only for web-enabled companions; fallbacks + effort always set
    tools = {r["who"]: [t.get("name") for t in r["tools"]] for r in fake.requests}
    assert "web_search" in tools["research"] and "web_search" not in tools["creative"]
    assert all(r["fallbacks"] == "default" for r in fake.requests)
    assert all("server-side-fallback-2026-07-01" in r["betas"] for r in fake.requests)

    kinds = [e["type"] for e in events]
    assert kinds.count("companion_start") == 2 and kinds.count("companion_done") == 2


def test_tool_errors_return_to_model():
    fake = FakeClient({"aria": [
        msg(call("delegate", {"companion": "nope", "task": "x"}, "t1"), stop="tool_use"),
        msg(text("That companion doesn't exist.")),
    ]})
    agent.Aria(client=fake).chat("hi")
    result = fake.requests[-1]["messages"][-1]["content"][0]
    assert result["is_error"] and "no companion 'nope'" in result["content"]


def test_refusal_and_pause_turn():
    fake = FakeClient({"aria": [msg(stop="refusal")]})
    assert "can't help" in agent.Aria(client=fake).chat("bad")
    fake = FakeClient({"aria": [msg(text("part"), stop="pause_turn"), msg(text("done"))]})
    assert agent.Aria(client=fake).chat("search") == "done"
    assert fake.requests[-1]["messages"][-1]["role"] == "assistant"


def test_create_companion_and_schedule():
    fake = FakeClient({"aria": [
        msg(call("create_companion", {"key": "Finance", "name": "Finance", "role": "Budgets",
                                      "instructions": "Do budgets."}, "a"), stop="tool_use"),
        msg(call("schedule_task", {"companion": "finance", "task": "Weekly spend review",
                                   "daily_at": "08:00"}, "b"), stop="tool_use"),
        msg(text("Done.")),
    ]})
    agent.Aria(client=fake).chat("set up finance")
    assert "finance" in store.list_companions()
    (s,) = store.list_schedules()
    assert s["companion"] == "finance" and s["daily_at"] == "08:00"


def test_mcp_connectors_attach_to_companions(aria_home):
    (aria_home / "connectors.json").write_text(json.dumps(
        [{"name": "crm", "url": "https://mcp.example.com/sse", "authorization_token": "tok"}]))
    fake = FakeClient({"sales": [msg(text("ok"))]})
    agent.Aria(client=fake).run_companion("sales", "find leads")
    req = fake.requests[0]
    assert req["mcp_servers"] == [{"type": "url", "url": "https://mcp.example.com/sse",
                                   "name": "crm", "authorization_token": "tok"}]
    assert {"type": "mcp_toolset", "mcp_server_name": "crm"} in req["tools"]
    assert "mcp-client-2025-11-20" in req["betas"]


def test_schedule_due_logic():
    t0 = time.mktime((2026, 1, 5, 7, 0, 0, 0, 0, -1))
    s = {"every_minutes": 60, "daily_at": None, "created": t0, "last_run": None}
    assert not store.schedule_is_due(s, t0 + 59 * 60)
    assert store.schedule_is_due(s, t0 + 60 * 60)
    d = {"every_minutes": None, "daily_at": "08:00", "created": t0, "last_run": None}
    assert not store.schedule_is_due(d, t0 + 30 * 60)
    assert store.schedule_is_due(d, t0 + 61 * 60)
    d["last_run"] = t0 + 61 * 60
    assert not store.schedule_is_due(d, t0 + 3 * 3600)
    with pytest.raises(ValueError):
        store.add_schedule("research", "x")


def test_run_due_schedules_saves_note():
    s = store.add_schedule("research", "AI news brief", every_minutes=5)
    fake = FakeClient({"research": [msg(text("Brief: ..."))]})
    ran = server.run_due_schedules(agent.Aria(client=fake), now=s["created"] + 301)
    assert ran == [s["id"]]
    assert store.list_notes()[0]["content"] == "Brief: ..."
    assert store.list_schedules()[0]["last_result"] == "ok"


def test_http_api_roundtrip():
    fake = FakeClient({"aria": [msg(text("Hello!"))]})
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(agent.Aria(client=fake)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    def req(path, method="GET", body=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(base + path, data=data, method=method,
                                   headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(r) as resp:
            return resp.read().decode()

    try:
        assert "<title>Aria OS</title>" in req("/")
        mem = json.loads(req("/api/memory", "POST", {"text": "Prefers short answers"}))
        events = [json.loads(l[6:]) for l in req("/api/chat", "POST", {"text": "hi"}).split("\n\n")
                  if l.startswith("data: ")]
        assert events[-1] == {"type": "reply", "text": "Hello!"}
        state = json.loads(req("/api/state"))
        assert set(state["companions"]) == {"research", "creative", "operations", "sales"}
        assert state["history"][-1]["content"] == "Hello!"
        req(f"/api/memory/{mem['id']}", "DELETE")
        assert json.loads(req("/api/state"))["memories"] == []
        with pytest.raises(urllib.error.HTTPError):
            req("/static/../aria/server.py")
    finally:
        httpd.shutdown()
