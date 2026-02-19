# Mission Control Design: OpenClaw Task Orchestration Dashboard

**Date:** 2026-02-16
**Status:** Approved
**Base project:** [crshdn/mission-control](https://github.com/crshdn/mission-control) (409 stars, MIT, Next.js 14)

## Goal

A visible task board where the user can dump tasks via Telegram, Bob (main agent) autonomously picks them up, routes to the correct workflow agents, executes them, and updates the board in real-time. When idle, Bob suggests improvements.

## Architecture

```
User (Telegram) → Bob (main agent) → Supabase (task store)
                                          ↑
Mission Control Dashboard (Next.js) ──────┘
    on VPS port 4000, Tailscale-only
    ↕ WebSocket
OpenClaw Gateway (port 18789)
    ├── Bob (main, gemini-2.5-flash, fallback glm-4.7)
    ├── Worker (glm-4.7)
    └── 26 workflow agents (glm-4.7)
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Base project | crshdn/mission-control | Purpose-built for OpenClaw, MIT, Next.js, kanban + agent dispatch |
| Database | Supabase (migrate from SQLite) | Community consensus: agents are ephemeral, need persistent REST-accessible store. User already has Supabase MCP configured. |
| Real-time (v1) | Keep SSE from base project | Works, low risk. Upgrade to Supabase Realtime in v2. |
| Auth | Bearer token (MC_API_TOKEN) | Single user, Tailscale-only. No need for user auth system. |
| Task input | Telegram → Bob → Supabase REST | Natural language task creation via existing Telegram channel. |
| Task polling | Heartbeat on local model (ollama/qwen2.5:3b) every 15min | Zero z.ai prompt cost for checking. Only actual work costs prompts. |
| Execution | Direct agent invocation (`openclaw agent --agent <id>`) | Replaced cron-polling antfarm with sequential invocation. |
| Autonomy | Fully autonomous with safety gates | Per OPERATING_CONTRACT.md: approval only for destructive/monetary/public actions. |

## Database Schema (Supabase Migration)

Migrate these 13 tables from SQLite to Supabase Postgres:

1. **workspaces** — Workspace containers
2. **agents** — AI agent definitions (maps to OpenClaw agent IDs)
3. **tasks** — Mission queue items (7 statuses: planning → inbox → assigned → in_progress → testing → review → done)
4. **planning_questions** — AI planning Q&A per task
5. **planning_specs** — Locked specifications after planning approval
6. **conversations** — Agent-to-agent or task discussions
7. **conversation_participants** — Conversation membership
8. **messages** — Message records
9. **events** — System event log
10. **openclaw_sessions** — WebSocket session mapping
11. **task_activities** — Real-time activity log per task
12. **task_deliverables** — Output artifacts per task
13. **businesses** — Legacy workspace support

Add RLS policies: all rows accessible (single user). Can add multi-user RLS later.

## Kanban Columns

| Column | Purpose | Trigger |
|--------|---------|---------|
| Planning | AI-guided Q&A to define task | User creates task |
| Inbox | Queued for assignment | Planning approved or skipped |
| Assigned | Agent selected, ready to dispatch | Manual or auto-assign |
| In Progress | Agent actively working | Auto-dispatch |
| Testing | Automated verification | Agent reports completion |
| Review | Human approval pending | Tests pass |
| Done | Completed | User approves |

## Task Flow

1. User messages Bob on Telegram: "New task: Build login page for project X"
2. Bob calls Mission Control API: `POST /api/tasks` with title, description, suggested workflow
3. Task appears in Planning column on dashboard
4. Bob runs AI planning (or user skips planning for simple tasks)
5. Task moves to Inbox → auto-assigned to correct workflow agent
6. Auto-dispatch sends task to agent via OpenClaw Gateway
7. Agent works, posts activity updates and deliverables via REST
8. Task progresses: In Progress → Testing → Review → Done
9. Bob notifies user on Telegram when complete

## Heartbeat Integration

```
Every 15 min (local model, free):
1. Read HEARTBEAT.md
2. Check Mission Control API for tasks in 'inbox' status
3. If tasks found → trigger main agent on glm-4.7 to process them
4. If no tasks → HEARTBEAT_OK (silent)
5. If idle for >2h → suggest improvements via Telegram
```

## Prompt Budget

| Activity | Prompts per 5h | Notes |
|----------|----------------|-------|
| Heartbeat checks | 0 | Local model (free) |
| Task execution (bug-fix) | ~6-8 | Per task |
| Task execution (feature-dev) | ~8-20 | Depends on story count |
| Task status updates | 0 | REST API calls, not prompts |
| Dashboard SSE | 0 | Server-side, no LLM |
| **Total overhead** | **0** | Only actual work costs prompts |

## Files Modified (from base project)

| File | Change |
|------|--------|
| `src/lib/db/index.ts` | Replace better-sqlite3 with @supabase/supabase-js |
| `src/lib/db/schema.ts` | Convert to Supabase migration SQL |
| `src/lib/db/migrations.ts` | Remove (use Supabase migrations) |
| `src/lib/db/seed.ts` | Rewrite for Supabase |
| `package.json` | Remove better-sqlite3, add @supabase/supabase-js @supabase/ssr |
| `.env.local` | Add SUPABASE_URL, SUPABASE_ANON_KEY |
| `next.config.mjs` | Remove better-sqlite3 webpack config if present |

## Deployment

1. VPS: `/home/deploy/mission-control/`
2. Process: PM2 or systemd
3. Port: 4000 (behind Tailscale)
4. Access: `https://srv1360790.tail30bf7c.ts.net:4000`
5. Gateway: `ws://127.0.0.1:18789` (same machine, loopback)
