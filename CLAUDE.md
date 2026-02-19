# Mission Control

AI Agent Orchestration Dashboard — create tasks, plan via interactive Q&A, auto-spawn agents, watch them work in real-time, and track deliverables.

## Stack

- Next.js 14.2 (App Router, API routes)
- React 18.2, TypeScript 5.7
- Tailwind CSS 3.4, PostCSS
- Supabase (Postgres via PostgREST)
- Zustand 5.0 (state management)
- Zod 4.3 (validation)
- systemd user service (production deployment)
- Playwright (E2E testing)

## Commands

```bash
npm run dev          # Dev server (port 4000)
npm run build        # Production build
npm start            # Production server (port 4000)
npm run lint         # ESLint
npm run db:seed      # Seed Supabase with OpenClaw agents
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
│   ├── db/                 # Supabase client (getSupabase singleton)
│   ├── openclaw/           # WebSocket client, device auth (RSA), deploy
│   ├── store.ts            # Zustand state
│   ├── events.ts           # SSE broadcaster
│   ├── validation.ts       # Zod schemas
│   └── config.ts           # Configuration
└── middleware.ts            # Auth middleware (Bearer token)
```

**Data flow**: Browser <-> Next.js API <-> Supabase (Postgres) + OpenClaw Gateway (WebSocket)
**Real-time**: SSE from server to browser, WebSocket from server to OpenClaw Gateway

## Code Style

- Functional components only, no class components
- State in Zustand store (`src/lib/store.ts`), not component-level useState for shared state
- API routes return consistent JSON: `{ data }` on success, `{ error }` on failure
- Zod validation on all API inputs (`src/lib/validation.ts`)
- File paths always validated against allowed directories (path traversal protection)
- Use `date-fns` for date formatting, never raw Date manipulation

## Constraints

- **Supabase Postgres only** — No ORM. Supabase PostgREST client via `getSupabase()` singleton. Schema managed through Supabase dashboard/migrations. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **No shadcn/ui** — Custom components with Tailwind. The UI is specialized (Kanban board, planning tab, SSE debug panel) and doesn't benefit from a component library.
- **SSE not WebSocket for browser** — Server-Sent Events for server-to-browser push. WebSocket reserved for OpenClaw Gateway connection only. SSE is simpler, works with HTTP/2, and auto-reconnects.
- **Bearer token auth, not session-based** — `MC_API_TOKEN` env var. Same-origin browser requests exempted. No user accounts needed for single-operator dashboard.
- **Never commit .env files or .pem keys**

## Deployment

Live in production since Feb 2026 on Ubuntu VPS (SSH alias: `openclaw`), port 4000, managed by systemd user service.

**Deploy (3 commands):**
```bash
rsync -az --delete \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=.env --exclude=.env.local --exclude='*.pem' \
  --exclude=.DS_Store --exclude=.claude/ --exclude=.kilocode/ \
  --exclude=.vscode/ --exclude=.mcp.json --exclude=opencode.json \
  --exclude=ecosystem.config.cjs --exclude=mission-control.db \
  ./ openclaw:/home/deploy/mission-control/
ssh -T openclaw "cd /home/deploy/mission-control && npm install && npm run build"
ssh -T openclaw "systemctl --user restart mission-control.service"
```

**NEVER use `nohup npm start &` over SSH** — it creates zombie processes outside systemd. Always use `systemctl --user restart`.

See `docs/PRODUCTION_SETUP.md` for full details.

## Docs

- `docs/AGENT_PROTOCOL.md` — Agent communication protocol
- `docs/ORCHESTRATION_WORKFLOW.md` — Task lifecycle and dispatch flow
- `docs/ORCHESTRATION.md` — Orchestration guide (sub-agents, activity logging)
- `docs/HEARTBEAT.md` — Orchestrator instructions (inbox polling, task assignment)
- `docs/REALTIME_SPEC.md` — SSE event types and streaming architecture
- `docs/TESTING_REALTIME.md` — Real-time integration testing guide
- `docs/VERIFICATION_CHECKLIST.md` — Pre-deployment verification checklist
- `docs/PRODUCTION_SETUP.md` — Deployment guide (systemd, Tailscale, deploy workflow)
- `docs/claude-workflow.md` — Claude Code best practices for this project

## Workflow

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Feature branches off `main`, never commit directly to main
- Run `npm run lint` and `npm run build` before committing
- Update CHANGELOG.md for user-facing changes
- See `~/.claude/CLAUDE.md` for global operating principles
