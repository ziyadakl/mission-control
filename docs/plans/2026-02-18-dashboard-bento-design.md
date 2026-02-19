# Dashboard Bento Box — Design Document

**Date:** 2026-02-18
**Status:** Approved
**Approach:** Static bento grid at `/dashboard` with 8 widgets

---

## Context

Mission Control's current home page (`/`) shows workspace cards with minimal data. The workspace view (`/workspace/[slug]`) has a Kanban board, agent sidebar, and live feed — good for task execution, but lacks a high-level operational overview.

Research into AI agent orchestration dashboards (Langfuse, LangGraph Studio, AutoGen Studio, Vercel, Grafana, Linear) and industry trends shows the best dashboards reduce time-to-decision by surfacing: agent health, cost, velocity, and items needing attention — all at a glance.

The user wants a "command center" feel: agent health, activity summary, attention items, velocity, weather, cost, and workspace navigation.

---

## Architecture

**Route:** `/dashboard` — new Next.js page, linked from the header navigation.

**Layout:** CSS Grid bento box. No chart libraries or drag-and-drop dependencies. Charts built with pure CSS/SVG. Responsive: 4 columns (desktop), 2 columns (tablet), 1 column (mobile).

**Data strategy:** Fetch on mount via existing API endpoints. Real-time updates via SSE (reuse existing `useSSE` hook). Weather cached 30 min via a thin API proxy route. Cost data from a new `daily_stats` Supabase table aggregated from the agent completion webhook.

**No new dependencies.** All charts are SVG/CSS. Weather via Open-Meteo (free, no API key).

---

## Layout

```
Desktop (4 cols):
┌──────────────────┬──────────┬──────────┐
│  Agent Health     │ Weather  │ System   │
│  Grid (2 cols)    │ + Time   │ Health   │
│                   │ (1 col)  │ (1 col)  │
├──────────────────┼──────────┴──────────┤
│  Needs Attention  │  Weekly Velocity    │
│  (2 cols)         │  Chart (2 cols)     │
├──────────────────┼──────────┬──────────┤
│  Activity Summary │ Token/   │Workspace │
│  (2 cols)         │ Cost     │Shortcuts │
│                   │ (1 col)  │ (1 col)  │
└──────────────────┴──────────┴──────────┘

Tablet (2 cols):
Widgets flow naturally in 2-column grid, each widget
taking 1 or 2 columns as specified above.

Mobile (1 col):
All widgets stack vertically in a single column.
```

---

## Widget Specifications

### 1. Agent Health Grid (2-col wide)

Compact grid of agent cards showing operational status at a glance.

Each card:
- Initials circle (reuse existing pattern from AgentsSidebar)
- Name + role (single line, truncated)
- Status badge: `working` (green pulse), `idle` (gray), `error` (red), `offline` (dim)
- Last activity: relative time ("3m ago")
- Active tasks count: number badge

Sort order: working first, then idle, then error/offline. Click navigates to the agent's workspace with the agent selected.

**Data:** `GET /api/agents` (all workspaces) + SSE `agent_status_changed` events for real-time updates.

### 2. Weather + Time (1-col)

- Current temperature + condition icon (sun, cloud, rain, snow)
- City name (from browser geolocation or hardcoded fallback)
- Live clock (HH:mm format, updates per minute)
- Today's date (e.g., "Tuesday, Feb 18")

**Data:** Open-Meteo free API via `/api/dashboard/weather` proxy (avoids CORS, caches 30 minutes server-side). No API key required.

### 3. System Health (1-col)

- OpenClaw Gateway: green/red dot + "Connected"/"Disconnected"
- Last heartbeat: relative time + success/fail indicator
- Active OpenClaw sessions count
- Uptime indicator

**Data:** `GET /api/openclaw/status` + `GET /api/heartbeat` (cached result). 60-second polling.

### 4. Needs Attention (2-col wide)

Prioritized list of action items requiring human intervention. Max 5 shown.

Item types (in priority order):
1. Agents with error status
2. Tasks stuck in `in_progress` > 2 hours with no activity
3. Tasks in `review` status awaiting approval
4. Heartbeat failures or stale heartbeat (> 10 min)

Each item: priority-colored icon + description + action link (navigates to task/agent). Empty state: green checkmark with "All clear — nothing needs your attention."

**Data:** Computed client-side from `GET /api/agents`, `GET /api/tasks`, heartbeat status. Refreshed via SSE events + 60-second poll fallback.

### 5. Weekly Velocity Chart (2-col wide)

Simple bar chart: tasks completed per day, last 7 days.

- 7 vertical bars with day-of-week labels (Mon, Tue, ...)
- Hover/tap shows exact count
- Built with pure SVG (no chart library)
- Current day's bar uses accent color, past days use muted color

**Data:** `GET /api/events?type=task_completed&since=7d` grouped by `created_at` date. Fetched on mount only.

### 6. Activity Summary (2-col wide)

Overview of the last 24 hours.

Top section (stat pills):
- Tasks completed count
- Tasks created count
- Agent dispatches count
- Errors count

Bottom section: scrollable list of last 10 events in compact format (icon + message + relative time). Same rendering as LiveFeed but no filters.

**Data:** `GET /api/events?since=24h` for the list. Stats computed from event types. SSE for real-time updates.

### 7. Token/Cost Tracker (1-col)

- Today's estimated cost: `$X.XX`
- This week total: `$XX.XX`
- 7-day sparkline (tiny inline SVG, ~30px tall)

**Data:** New `daily_stats` Supabase table with columns: `date`, `total_tokens`, `estimated_cost`, `tasks_completed`, `workspace_id`. Aggregated from the existing agent completion webhook (`/api/webhooks/agent-completion`) which already receives activity data. New API route: `GET /api/dashboard/stats`.

### 8. Workspace Shortcuts (1-col)

- Compact list of workspaces
- Each: workspace name + task count badge (colored by status distribution)
- Click navigates to `/workspace/[slug]`
- Max 5 shown, "View all" link if more

**Data:** `GET /api/workspaces?stats=true` (existing endpoint). Fetched on mount.

---

## New Backend Requirements

### 1. `daily_stats` Supabase table

```sql
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id),
  total_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,4) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, workspace_id)
);
```

### 2. `GET /api/dashboard/stats`

Returns aggregated stats for the cost widget. Query: last 7 days of `daily_stats`, summed.

### 3. `GET /api/dashboard/weather`

Thin proxy to Open-Meteo API. Accepts `lat` and `lon` query params. Caches response for 30 minutes using in-memory cache (simple Map with TTL). Returns `{ temp, condition, city }`.

### 4. Update webhook to log token usage

In `/api/webhooks/agent-completion`, after processing the completion event, upsert into `daily_stats` with the token count and estimated cost from the webhook payload.

---

## Navigation

Add "Dashboard" link to the Header component:
- Desktop: text link next to "Mission Control" title
- Mobile: icon in the header bar
- The `/` home page remains unchanged (workspace cards)

---

## Decision Log

| Decision | Rationale |
|---|---|
| Static bento layout, no drag-and-drop | Single-operator dashboard. Opinionated layout > customization complexity. Can add later. |
| No chart library | Only need bar chart + sparkline. Pure SVG keeps bundle small, no new dependency. |
| Open-Meteo for weather | Free, no API key, reliable. Proxy route avoids CORS. |
| `daily_stats` table for cost | Incrementally updated from existing webhook. No new data pipeline. Simple aggregation. |
| CSS Grid over flexbox | Bento layout is inherently a grid problem. CSS Grid handles asymmetric sizes naturally. |
| Per-minute clock, not per-second | Reduces unnecessary re-renders. Per-second clock on the dashboard is visual noise. |
