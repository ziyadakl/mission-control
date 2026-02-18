# Mission Control

AI Agent Orchestration Dashboard — create tasks, plan via interactive Q&A, auto-spawn agents, watch them work in real-time, and track deliverables.

## Stack

- Next.js 14.2 (App Router, API routes)
- React 18.2, TypeScript 5.7
- Tailwind CSS 3.4, PostCSS
- SQLite 3 (better-sqlite3)
- Zustand 5.0 (state management)
- Zod 4.3 (validation)
- PM2 (production deployment)
- Playwright (E2E testing)

## Commands

```bash
npm run dev          # Dev server (port 4000)
npm run build        # Production build
npm start            # Production server
npm run lint         # ESLint
npm run db:seed      # Seed database
npm run db:backup    # Backup SQLite DB
npm run db:restore   # Restore from backup
npm run db:reset     # Drop + reseed
```

## Architecture

```
src/
├── app/                    # Next.js app directory
│   ├── api/                # REST API routes (tasks, agents, webhooks, files, events)
│   ├── workspace/[slug]/   # Dynamic workspace pages
│   └── settings/           # Settings page
├── components/             # React UI (WorkspaceDashboard, MissionQueue, TaskModal, etc.)
├── hooks/                  # Custom hooks (useSSE for real-time)
├── lib/
│   ├── db/                 # SQLite schema, migrations, seed
│   ├── openclaw/           # WebSocket client, device auth (RSA), deploy
│   ├── store.ts            # Zustand state
│   ├── events.ts           # SSE broadcaster
│   ├── validation.ts       # Zod schemas
│   └── config.ts           # Configuration
└── middleware.ts            # Auth middleware (Bearer token)
```

**Data flow**: Browser <-> Next.js API <-> SQLite + OpenClaw Gateway (WebSocket)
**Real-time**: SSE from server to browser, WebSocket from server to OpenClaw Gateway

## Code Style

- Functional components only, no class components
- State in Zustand store (`src/lib/store.ts`), not component-level useState for shared state
- API routes return consistent JSON: `{ data }` on success, `{ error }` on failure
- Zod validation on all API inputs (`src/lib/validation.ts`)
- File paths always validated against allowed directories (path traversal protection)
- Use `date-fns` for date formatting, never raw Date manipulation

## Constraints

- **SQLite only** — No ORM. Raw SQL via better-sqlite3. Considered Prisma but SQLite is file-based and portable for single-machine deployment.
- **No shadcn/ui** — Custom components with Tailwind. The UI is specialized (Kanban board, planning tab, SSE debug panel) and doesn't benefit from a component library.
- **SSE not WebSocket for browser** — Server-Sent Events for server-to-browser push. WebSocket reserved for OpenClaw Gateway connection only. SSE is simpler, works with HTTP/2, and auto-reconnects.
- **Bearer token auth, not session-based** — `MC_API_TOKEN` env var. Same-origin browser requests exempted. No user accounts needed for single-operator dashboard.
- **Never commit .env files, .db files, or .pem keys**

## Deployment

OpenClaw and Mission Control are **live in production** since February 2026.

| Detail | Value |
|--------|-------|
| Production URL | `https://srv1360790.tail30bf7c.ts.net` |
| SSH access | `ssh openclaw` (configured in `~/.ssh/config`) |
| Mission Control (deployed) | `/home/deploy/mission-control/` on VPS |
| OpenClaw config (deployed) | `/home/deploy/.openclaw/` on VPS |
| Mission Control (local dev) | This repo |

- Managed with PM2 on VPS, accessible via Tailscale network
- To deploy: push to main, SSH in, pull + restart PM2
- Reference docs (setup plans, hosting comparison, token optimization) live in `docs/plans/` and `docs/` -- these are historical reference, not active instructions

## Docs

- `docs/AGENT_PROTOCOL.md` — Agent communication protocol
- `docs/ORCHESTRATION_WORKFLOW.md` — Task lifecycle and dispatch flow
- `docs/REALTIME_SPEC.md` — SSE event types and streaming architecture
- `docs/PRODUCTION_SETUP.md` — Deployment guide (PM2, Tailscale, reverse proxy)
- `docs/claude-workflow.md` — Claude Code best practices for this project

## Workflow

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Feature branches off `main`, never commit directly to main
- Run `npm run lint` and `npm run build` before committing
- Update CHANGELOG.md for user-facing changes
- See `~/.claude/CLAUDE.md` for global operating principles
