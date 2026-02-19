# OpenClaw Mission Control — Improvement Roadmap Design

**Date:** 2026-02-18
**Status:** Approved
**Approach:** Phased roadmap with "best hits" Phase 1

---

## Context

Three parallel research streams identified improvement opportunities:

1. **Production server audit** (SSH) — service healthy, resources abundant, but no TLS/firewall (relying on Tailscale), leftover dev files on server
2. **Codebase analysis** — 38 API endpoints with solid Zod validation, but no CI/CD, no tests, shell injection risk, DB schema not version-controlled, no monitoring
3. **Industry trends** (web research) — `output: 'standalone'` is standard, per-session cost tracking is table stakes, approval gates trending, OpenTelemetry + Langfuse for observability

**Deployment constraint:** Stay with rsync + systemd. No Docker/Kamal.

---

## Phase 1: Harden & Automate

Highest-impact items from each category. Self-contained and shippable as one sprint.

### 1.1 Deployment

#### `output: 'standalone'` in next.config.mjs
- Set `output: 'standalone'` in Next.js config
- Produces a self-contained build in `.next/standalone/` — no full `node_modules` needed on server
- Update deploy script to rsync `.next/standalone/` instead of the entire project
- Update systemd service to run `node .next/standalone/server.js` instead of `npm start`

#### GitHub Actions CI/CD
- Trigger on push to `main`
- Steps: lint → build → rsync to VPS → restart systemd service
- Requires SSH key as GitHub secret (deploy key, not personal key)
- Consider a `deploy` branch or tag-based triggers if `main` sees frequent non-deploy commits

#### Tighten rsync excludes
Add to the rsync command:
- `--exclude=.DS_Store`
- `--exclude=.claude/`
- `--exclude=.kilocode/`
- `--exclude=.vscode/`
- `--exclude=.mcp.json`
- `--exclude=opencode.json`
- `--exclude=ecosystem.config.cjs`
- `--exclude=mission-control.db`

Clean up existing artifacts on server.

#### Simple rollback script
- Tag each deploy with `deploy-YYYY-MM-DD-HHMMSS`
- `scripts/rollback.sh` that checks out previous tag, builds, and restarts
- Keep last 3 deploy tags, prune older ones

### 1.2 Security

#### Fix shell injection in `/api/files/reveal`
- **File:** `src/app/api/files/reveal/route.ts`
- **Issue:** `exec()` with interpolated path string — shell metacharacters in filename = command injection
- **Fix:** Replace `exec(\`open -R "${normalizedPath}"\`)` with `execFile('open', ['-R', normalizedPath])`
- Same fix for any `exec()` call with user-derived path strings

#### Fix weak path traversal in `/api/files/upload`
- **File:** `src/app/api/files/upload/route.ts`
- **Issue:** Only checks `normalize(relativePath).startsWith('..')` — insufficient
- **Fix:** `const fullPath = path.resolve(PROJECTS_BASE, normalizedPath); if (!fullPath.startsWith(path.resolve(PROJECTS_BASE))) throw`

#### Add `updated_by_agent_id` to Zod schema
- **File:** `src/lib/validation.ts`
- **Issue:** `updated_by_agent_id` accepted in PATCH body but bypasses Zod entirely
- **Fix:** Add `updated_by_agent_id: z.string().uuid().optional()` to `UpdateTaskSchema`

#### Confirm Tailscale-only access
- Verify port 4000 is bound to Tailscale interface only, or that host-level firewall blocks public access
- Document the security model in PRODUCTION_SETUP.md
- Run: `ssh -T openclaw "ss -tlnp | grep 4000"` to check binding

### 1.3 Observability

#### Heartbeat cron job
- Add to VPS crontab: `*/5 * * * * curl -sf http://localhost:4000/api/heartbeat?token=$MC_API_TOKEN > /dev/null`
- The orchestrator will then run unattended every 5 minutes
- Log output to a file for debugging: `>> /home/deploy/heartbeat.log 2>&1`

#### Uptime monitoring
- UptimeRobot free tier (or Better Uptime / Hetrixtools)
- Monitor the Tailscale IP + port 4000 health endpoint
- Alert via email/Slack on downtime

#### Structured logging for key events
- Create a `log()` helper that outputs JSON: `{ timestamp, level, event, data }`
- Apply to: task state changes, agent dispatches, heartbeat runs, errors
- Leave existing `console.log` for non-critical debug output
- JSON logs are parseable by `journalctl` + `jq`

### 1.4 Features

#### Per-session token/cost counter
- Add `token_usage` (integer) and `estimated_cost` (decimal) columns to `tasks` table
- Agent completion webhook already receives activity data — extract token counts
- Display in TaskModal and WorkspaceDashboard
- Aggregate per-workspace for a cost overview

---

## Phase 2: Version Control the Database

- Export current schema: `supabase db dump --schema public > supabase/schema.sql`
- Export RPCs (`get_task_by_id`, `get_events_with_details`): `supabase db dump --schema public --data-only=false`
- Set up `supabase/migrations/` directory with timestamped SQL files
- Workflow: `supabase db diff` → review → `supabase db push`
- Clean up stale docs: remove SQLite references from `docs/PRODUCTION_SETUP.md`

---

## Phase 3: Observability & Resilience

- Sentry integration for error tracking + alerting
- Langfuse (self-hosted) for LLM cost tracking per agent session
- OpenTelemetry instrumentation on agent events
- Document SSE single-process limitation in `src/lib/events.ts`
- Rate limiting middleware on write endpoints
- SSE reconnection improvements (client-side retry with exponential backoff)

---

## Phase 4: Agent Intelligence Features

- Approval gates for high-risk agent actions (configurable per task type)
- Autonomy levels: human-in-the-loop / human-on-the-loop / autonomous
- Multi-stage pipeline visualization in dashboard
- Agent performance analytics (success rate, avg completion time, cost per task)

---

## Decision Log

| Decision | Rationale |
|---|---|
| Stay with rsync + systemd | Low overhead, works well for single-operator dashboard. Docker/Kamal adds complexity without proportional benefit at current scale. |
| No nginx/TLS | Access is via Tailscale (encrypted tunnel). Adding nginx adds a moving part with no security benefit if Tailscale ACLs are correct. Must verify. |
| Phased approach | Each phase is self-contained and shippable. Avoids big-bang risk. |
| GitHub Actions over alternatives | Already using GitHub for source. Native integration, free tier sufficient. |
| SSE architecture unchanged | Industry consensus confirms SSE is correct for server-to-browser push. No change needed. |
| Custom dashboard over n8n | Specialized UI (Kanban, planning Q&A, SSE debug) and OpenClaw protocol integration cannot be replicated cleanly in n8n. |
