# SaDB

> A modern, AI-native database client. PostgreSQL · MySQL · MongoDB · Bring-your-own AI.

SaDB is a cross-platform desktop database client built with **React + Electron**. It pairs a polished, futuristic dark UI with developer-friendly ergonomics — a Monaco-powered SQL editor, a virtualized results grid, one-click chart visualization, and an AI agent that translates plain English into queries using a model **you** choose.

## Highlights

- **Three databases out of the box** — PostgreSQL, MySQL/MariaDB, MongoDB (shell syntax).
- **Bring-your-own AI** — Anthropic Claude, OpenAI GPT, or Google Gemini. Keys live in your OS keychain (Electron `safeStorage`).
- **AI agent that reads your schema** — before the model writes a query it sees the actual tables and columns, so it doesn't hallucinate.
- **Monaco editor** — syntax highlighting, smart formatting (`⇧⌥F`), run with `⌘⏎`.
- **Virtualized result grid** — renders 100 k+ rows smoothly with column-type-aware cell rendering.
- **Built-in charting** — flip results between Table / JSON / Chart; pick bar, line, area, or pie.
- **Command palette** (`⌘K`) — actions, connections, queries — all keyboard-first.
- **Tabs & schema tree** — multi-query workflow, browse and one-click sample any table.
- **Cancel long-running queries** safely (`pg_cancel_backend`, MySQL destroy, mongo abort).
- **CSV / JSON export** for any result.
- **Cross-platform** — first-class macOS, Windows, and Linux builds via `electron-builder`.

## Quick start

```bash
# Requires Node.js 20+
npm install
npm run dev
```

The Electron window will launch with hot-reloading for the renderer.

## Packaging

```bash
# Whatever platform you're on
npm run package

# Or target explicitly
npm run package:mac      # .dmg (arm64 + x64)
npm run package:win      # NSIS installer
npm run package:linux    # AppImage
```

Output lands in `release/`.

## First-time setup

1. **Add a connection** (sidebar → `+` or `⌘K → New connection`). Pick Postgres / MySQL / MongoDB, fill in host/port/db/user/password, hit **Test connection**, then **Save**.
2. **Set up the AI agent** (top-right gear or `⌘K → Open settings`). Paste an API key for any of:
   - Anthropic (`console.anthropic.com`)
   - OpenAI (`platform.openai.com`)
   - Gemini (`aistudio.google.com`)
   Pick which one is **active** — that's the model the agent will use.
3. **Open a tab**, click your connection in the sidebar to connect, write a query, hit **Run** (or `⌘⏎`).
4. **Toggle the AI panel** in the tab toolbar to ask the agent in plain English. It reads your live schema and emits a runnable query you can review before executing.

## Architecture

```
electron/
  main/          Node-side: drivers, IPC, AI calls, encrypted store
    db/          Postgres / MySQL / Mongo drivers (Driver interface)
    ai/          Anthropic / OpenAI / Gemini provider adapters
    ipc.ts       All IPC handlers
    store.ts     Persistent JSON store w/ safeStorage encryption
  preload/       Context-isolated bridge — exposes window.sadb
shared/          Types + IPC channel constants (used by both sides)
src/             React renderer
  components/    UI primitives, layout, schema, editor, results, AI, settings
  lib/           Zustand store + utils
  workspace/     Tabs + Welcome screen
```

### Security model

- Database passwords and AI API keys never leave the main process unencrypted.
- The preload script exposes a narrow, typed `window.sadb` API — no Node access in the renderer.
- AI calls go directly from the main process to the provider you chose. SaDB has no server.
- A strict CSP is set in `index.html`.

### Developer-friendly extras

- **Format SQL** (`⇧⌥F`) — uses `sql-formatter` and respects each dialect.
- **Query cancellation** — main process tracks an `AbortController` per connection.
- **Connection coloring** — color-coded dots in sidebar, tab bar, status bar.
- **Type-aware cells** — booleans render as glowing pills, JSON as pretty-printed blocks, numbers as monospace amber, dates as mint.
- **Mongo support** — write familiar `db.coll.find({…}).limit(50)` / `aggregate([…])` syntax; SaDB flattens documents into a tabular view automatically.

## Roadmap ideas

- Saved queries / snippets library
- ERD / schema visualization
- Inline cell editing for SELECTs of single tables
- Multi-statement execution with per-statement timing
- Local model support via Ollama
- Plugin system for custom drivers
