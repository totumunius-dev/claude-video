# Aria OS — a voice-first personal AI operating system

A ZoeyOS-style assistant built on the Claude API. You talk (or type) to **Aria**, an orchestrator that remembers you, and she routes work to a team of specialist **companions** that run in parallel, search the web, use your connected tools, save deliverables, and run on schedules — all shown in a live 3D workspace.

| ZoeyOS feature | Aria |
|---|---|
| Voice-first | Mic button (or Space in an empty input) for speech-to-text; replies read aloud (toggle the speaker). Uses the browser's built-in speech — Chrome, Edge, or Safari. |
| Orchestrator + companions | Aria delegates to Research, Creative, Operations, Sales out of the box. |
| Parallel bots | Several `delegate` calls in one turn run concurrently. |
| Builds a team for your goals | Ask “add a finance companion” — Aria creates it — or use **Team → New companion**. |
| Memory you can read and erase | **Memory** tab lists every fact with delete / erase-all; Aria also forgets on request. |
| Runs on schedules | “Every weekday at 8:00 have Research brief me on AI news” → **Schedules** tab; results land in **Notes**. |
| 1,000+ services | Any remote MCP server via `connectors.json` (see below). |
| Visual 3D workspace | Isometric floor; companion orbs light up with live beams and status while they work. |

## Run it

```bash
cd assistant
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...      # or: ant auth login
python3 -m aria.server                   # → http://127.0.0.1:8765
```

Flags: `--port`, `--host` (default `127.0.0.1` — there's no auth, keep it local), `--no-scheduler`.

Scheduled tasks only run while the server is running.

## Data

Everything is plain JSON in `~/.config/aria/` (override with `ARIA_HOME`): `memory.json`, `companions.json`, `schedules.json`, `notes.json`, `history.json`, `connectors.json`. Delete a file to reset that part.

## Connect your tools (MCP)

Create `~/.config/aria/connectors.json` with remote MCP servers. Every companion gets access to them:

```json
[
  {"name": "notion", "url": "https://mcp.notion.com/mcp", "authorization_token": "..."},
  {"name": "zapier", "url": "https://mcp.zapier.com/api/mcp/s/.../mcp"}
]
```

Zapier/Composio-style MCP gateways are the quickest way to reach hundreds of apps (Gmail, Calendar, Slack, HubSpot, …).

## How it works

- `aria/agent.py` — the Claude tool-use loop. Aria (`claude-opus-5-5`, effort `medium`) has tools for `delegate`, `remember`/`forget`, `create_companion`, `schedule_task`, and notes. Each companion is its own loop (effort `high`) with `web_search` (if enabled), MCP connectors, memory, and `save_note`. Requests opt into server-side refusal fallbacks (`fallbacks: "default"`) and prompt caching.
- `aria/server.py` — stdlib HTTP server: serves the UI, streams progress events over SSE, and runs a scheduler thread.
- `aria/store.py` — JSON persistence.
- `static/index.html` — single-file UI, no build step.

## Tests

```bash
python3 -m pytest -q assistant/tests     # fake Claude client — no network or API key
```
