# Dashboard Bento Box — Design Document

**Date:** 2026-02-18
**Status:** Approved (v2 — revised from separate page to unified sidebar layout)
**Approach:** Single-page app with persistent sidebar + swappable content area

---

## Context

Mission Control currently has two separate pages: a home page (`/`) with workspace cards, and a workspace page (`/workspace/[slug]`) with Kanban + agents + live feed. Navigating between them loses context and feels disconnected.

Research into AI agent orchestration dashboards (Langfuse, LangGraph Studio, Vercel, Linear, Grafana) shows the best dashboards use a persistent sidebar for navigation with a content area that switches views — like Slack, Discord, or Linear.

The user wants a unified "command center" feel: one page with a sidebar listing Overview + workspaces. Overview shows a bento widget grid with cross-workspace aggregate data. Clicking a workspace shows that workspace's Kanban + agents + live feed.

---

## Architecture

**Single-page layout** replacing both `/` and `/workspace/[slug]`. The root `/` renders the unified dashboard. URL updates via shallow routing to track active view (e.g., `/?view=overview` or `/?workspace=openclaw`).

**Layout structure:**
```
┌────────────┬─────────────────────────────────────┐
│            │                                     │
│  Sidebar   │        Content Area                 │
│  (fixed)   │        (swaps based on selection)   │
│            │                                     │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

**Data strategy:** Fetch on mount via existing API endpoints. Real-time updates via SSE (reuse existing `useSSE` hook). Weather cached 30 min via a thin API proxy route. Cost data from a new `daily_stats` Supabase table.

**No new dependencies.** All charts are SVG/CSS. Weather via Open-Meteo (free, no API key).

---

## Sidebar

Always visible on desktop (collapsible to icon rail). Slide-in drawer on mobile (triggered by hamburger).

```
Desktop (expanded):              Desktop (collapsed):
┌────────────────────┐           ┌────┐
│ ⚡ Mission Control  │           │ ⚡  │
│                    │           │    │
│ 📊 Overview         │           │ 📊  │
│                    │           │    │
│ WORKSPACES         │           │ ── │
│  ● OpenClaw    (5) │           │ O  │
│  ● Beta        (2) │           │ B  │
│  + New             │           │ +  │
│                    │           │    │
│ ──────────────     │           │ ── │
│ ⚙ Settings         │           │ ⚙  │
│                    │           │    │
│ 🟢 Online  12:34   │           │ 🟢  │
└────────────────────┘           └────┘
```

**Elements:**
- **App logo + title** — top, clickable to go to Overview
- **Overview** — always first, highlighted when active. Cross-workspace aggregate view.
- **WORKSPACES section** — lists all workspaces with active task count badge. Selected workspace is highlighted. Each workspace item shows: name + non-done task count.
- **+ New Workspace** — inline creation trigger
- **Settings** — bottom section, links to existing settings page
- **Status footer** — online/offline dot + clock (moved from current header)

**Mobile:** Hamburger icon in a thin top bar opens sidebar as a slide-in drawer overlay. Same pattern as current AgentsSidebar mobile drawer.

---

## Content Area: Overview (Bento Grid)

When **Overview** is selected in the sidebar, the content area shows a bento widget grid with cross-workspace aggregate data.

**Layout (CSS Grid, 4 columns):**
```
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

Tablet: 2 columns. Mobile: 1 column stacked.
```

---

## Content Area: Workspace View

When a **workspace** is selected in the sidebar, the content area shows the existing workspace layout — Kanban board, agents panel, and live feed. These are the existing components (`MissionQueue`, `AgentsSidebar` as an inline panel, `LiveFeed`) reused in the content area.

```
┌──────────────────────────────────────────────────┐
│  [Header bar: workspace name + 5 stat counters]  │
│  ┌─────────┬────────────────────┬──────────┐     │
│  │ Agents  │  Kanban Board      │ Live     │     │
│  │ Panel   │  (MissionQueue)    │ Feed     │     │
│  │         │                    │          │     │
│  │         │                    │          │     │
│  └─────────┴────────────────────┴──────────┘     │
└──────────────────────────────────────────────────┘
```

The agents panel and live feed are collapsible within the content area (same as today), independent of the main sidebar.

---

## Widget Specifications

### 1. Agent Health Grid (2-col wide)

Compact grid of agent cards showing operational status across ALL workspaces.

Each card:
- Initials circle (reuse existing pattern from AgentsSidebar)
- Name + role (single line, truncated)
- Status badge: `working` (green pulse), `idle` (gray), `error` (red), `offline` (dim)
- Last activity: relative time ("3m ago")
- Active tasks count: number badge

Sort: working first, then idle, then error/offline. Click switches sidebar to that agent's workspace and selects the agent.

**Data:** `GET /api/agents` (no workspace filter — all agents) + SSE for real-time updates.

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

Item types (priority order):
1. Agents with error status
2. Tasks stuck in `in_progress` > 2 hours with no activity
3. Tasks in `review` status awaiting approval
4. Heartbeat failures or stale heartbeat (> 10 min)

Each item: priority-colored icon + description + action link (clicks navigate to the relevant workspace + task/agent). Empty state: green checkmark "All clear."

**Data:** Computed client-side from `GET /api/agents`, `GET /api/tasks`, heartbeat status. SSE + 60s poll.

### 5. Weekly Velocity Chart (2-col wide)

Bar chart: tasks completed per day, last 7 days.

- 7 vertical bars with day-of-week labels
- Hover/tap shows exact count
- Built with pure SVG (no chart library)
- Current day bar uses accent color

**Data:** `GET /api/events?limit=200` filtered client-side for `type=task_completed`, grouped by date. Fetched on mount.

### 6. Activity Summary (2-col wide)

Last 24 hours overview.

Top: stat pills (tasks completed, created, dispatched, errors).
Bottom: scrollable list of last 10 events (icon + message + relative time). Same rendering as LiveFeed, no filters.

**Data:** `GET /api/events?limit=50`. Stats computed from event types. SSE for real-time.

### 7. Token/Cost Tracker (1-col)

- Today's estimated cost: `$X.XX`
- This week total: `$XX.XX`
- 7-day sparkline (tiny inline SVG, ~30px tall)

**Data:** New `daily_stats` Supabase table. New API route: `GET /api/dashboard/stats`.

### 8. Workspace Shortcuts (1-col)

- Compact list of workspaces with task count badges
- Click switches the sidebar selection to that workspace (loads its Kanban)
- Mirrors the sidebar workspace list but with richer stats

**Data:** `GET /api/workspaces?stats=true` (existing endpoint).

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

Thin proxy to Open-Meteo API. Accepts `lat` and `lon` query params. Caches 30 min in-memory. Returns `{ temp, condition, city }`.

### 4. Update webhook to log token usage

In `/api/webhooks/agent-completion`, upsert into `daily_stats` with token count and estimated cost from the webhook payload.

---

## Routing

**URL scheme:** Single root page at `/`.
- `/?view=overview` — Overview bento grid (default)
- `/?workspace=<slug>` — Workspace Kanban view
- `/?workspace=<slug>&task=<id>` — Workspace view with TaskModal open

The sidebar selection syncs with URL params via `useSearchParams()`. Browser back/forward works naturally. The Settings page (`/settings`) remains a separate route.

---

## Migration from Current Layout

**Removed:**
- `/` home page (WorkspaceDashboard component) — replaced by sidebar + overview
- `/workspace/[slug]` page — workspace view is now rendered in the content area
- Current `Header.tsx` breadcrumb navigation — replaced by sidebar

**Reused (embedded in content area):**
- `MissionQueue` component — Kanban board (unchanged)
- `AgentsSidebar` component — agents panel within workspace content area (not the main sidebar)
- `LiveFeed` component — event feed within workspace content area
- `TaskModal` component — task detail modal (unchanged)
- `StatsTray` component — togglable stats in workspace header bar

**New components:**
- `AppSidebar` — the main navigation sidebar
- `DashboardOverview` — bento widget grid
- `DashboardLayout` — root layout with sidebar + content area
- Individual widget components (8 widgets)

---

## Decision Log

| Decision | Rationale |
|---|---|
| Unified single-page vs separate routes | User wants one dashboard, not two pages. Reduces context switching. |
| Sidebar + content area pattern | Industry standard (Linear, Slack, Discord). Persistent nav with swappable views. |
| URL search params for view state | Preserves browser history/bookmarks without adding route complexity. |
| Reuse existing workspace components | MissionQueue, AgentsSidebar, LiveFeed already work well. No need to rebuild. |
| Static bento layout, no drag-and-drop | Single-operator. Opinionated layout beats customization complexity. |
| No chart library | Only need bar chart + sparkline. Pure SVG keeps bundle small. |
| Open-Meteo for weather | Free, no API key, reliable. Proxy route avoids CORS. |
| `daily_stats` table for cost | Incrementally updated from existing webhook. Simple aggregation. |
