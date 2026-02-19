# Dashboard Bento Box — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current two-page layout (home + workspace) with a unified single-page dashboard featuring a persistent sidebar for navigation and a swappable content area that shows either a bento widget overview or a workspace Kanban view.

**Architecture:** A new `DashboardLayout` component at the root (`/`) renders an `AppSidebar` (always visible) alongside a content area. URL search params (`?view=overview` or `?workspace=<slug>`) control which view is active. Existing workspace components (`MissionQueue`, `AgentsSidebar`, `LiveFeed`) are reused inside the content area. The bento overview uses CSS Grid with 8 widget cards built in pure Tailwind/SVG.

**Tech Stack:** Next.js 14.2 (App Router), React 18.2, TypeScript 5.7, Tailwind CSS 3.4, Zustand 5.0, Open-Meteo API (weather), Supabase (new `daily_stats` table)

**Visual Direction:** "Deep Space Ops" — pushes the existing GitHub-dark + JetBrains Mono aesthetic into command-center territory. Light is signal: in the darkness, only important things glow. Widget cards use colored top-border accents (matching Kanban column pattern), subtle inner gradient tints, and a scan-line shimmer animation on healthy cards. No box-shadows — depth comes from border-glow effects. Data density maximized. Color = meaning (every accent already has semantics). Animation restrained to two motions: scan-line shimmer (alive signal) and slide-in (data load).

---

### Task 0: Add dashboard CSS animations and WidgetCard visual foundation

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/dashboard/WidgetCard.tsx`

This task establishes the visual foundation all widgets inherit.

**Step 1: Add dashboard animations to globals.css**

Add after the existing `animate-slide-in` keyframe:

```css
/* Dashboard scan-line shimmer — "this system is alive" */
@keyframes scan-line {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-scan-line {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(88, 166, 255, 0.08) 40%,
    rgba(88, 166, 255, 0.15) 50%,
    rgba(88, 166, 255, 0.08) 60%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: scan-line 4s ease-in-out infinite;
}

/* Accent-colored scan-line variants */
.scan-green  { --scan-rgb: 63, 185, 80; }
.scan-yellow { --scan-rgb: 210, 153, 34; }
.scan-red    { --scan-rgb: 248, 81, 73; }
.scan-purple { --scan-rgb: 163, 113, 247; }
.scan-pink   { --scan-rgb: 219, 97, 162; }
.scan-cyan   { --scan-rgb: 57, 211, 83; }

.scan-green .animate-scan-line,
.scan-yellow .animate-scan-line,
.scan-red .animate-scan-line,
.scan-purple .animate-scan-line,
.scan-pink .animate-scan-line,
.scan-cyan .animate-scan-line {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(var(--scan-rgb), 0.08) 40%,
    rgba(var(--scan-rgb), 0.15) 50%,
    rgba(var(--scan-rgb), 0.08) 60%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: scan-line 4s ease-in-out infinite;
}

/* Widget card glow-on-hover */
.widget-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.widget-card:hover {
  border-color: rgba(88, 166, 255, 0.3);
  box-shadow: 0 0 15px rgba(88, 166, 255, 0.05), inset 0 1px 0 rgba(88, 166, 255, 0.06);
}
```

**Step 2: Create the WidgetCard component with visual polish**

`src/components/dashboard/WidgetCard.tsx`:

```tsx
interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Semantic accent color for the top border. Matches Kanban column color system. */
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'cyan';
}

const ACCENT_BORDER: Record<string, string> = {
  blue:   'border-t-mc-accent',
  green:  'border-t-mc-accent-green',
  yellow: 'border-t-mc-accent-yellow',
  red:    'border-t-mc-accent-red',
  purple: 'border-t-mc-accent-purple',
  pink:   'border-t-mc-accent-pink',
  cyan:   'border-t-mc-accent-cyan',
};

const ACCENT_TINT: Record<string, string> = {
  blue:   'from-mc-accent/5',
  green:  'from-mc-accent-green/5',
  yellow: 'from-mc-accent-yellow/5',
  red:    'from-mc-accent-red/5',
  purple: 'from-mc-accent-purple/5',
  pink:   'from-mc-accent-pink/5',
  cyan:   'from-mc-accent-cyan/5',
};

export function WidgetCard({ title, children, className = '', accent = 'blue' }: WidgetCardProps) {
  return (
    <div className={`widget-card relative bg-mc-bg-secondary border border-mc-border rounded-xl overflow-hidden ${className}`}>
      {/* Colored top border — same pattern as Kanban column headers */}
      <div className={`h-0.5 border-t-2 ${ACCENT_BORDER[accent]}`} />

      {/* Scan-line shimmer overlay */}
      <div className="animate-scan-line absolute inset-0 pointer-events-none rounded-xl" />

      {/* Inner content with subtle accent tint gradient */}
      <div className={`relative bg-gradient-to-b ${ACCENT_TINT[accent]} to-transparent p-4`}>
        <h3 className="text-[10px] uppercase tracking-wider text-mc-text-secondary font-mono mb-3">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
```

**Step 3: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 4: Commit**

```bash
git add src/app/globals.css src/components/dashboard/WidgetCard.tsx
git commit -m "feat: add dashboard visual foundation — scan-line shimmer, widget card with accent borders"
```

---

### Task 1: Create the DashboardLayout shell and AppSidebar

**Files:**
- Create: `src/components/AppSidebar.tsx`
- Create: `src/components/DashboardLayout.tsx`
- Modify: `src/app/page.tsx`

This task creates the structural foundation. The sidebar shows Overview + workspace list. The content area renders a placeholder for now.

**Step 1: Create `src/components/AppSidebar.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Zap, BarChart2, Plus, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { WorkspaceStats } from '@/lib/types';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeWorkspace = searchParams.get('workspace');
  const activeView = searchParams.get('view') || (activeWorkspace ? null : 'overview');

  const [workspaces, setWorkspaces] = useState<WorkspaceStats[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetch('/api/workspaces?stats=true')
      .then(res => res.ok ? res.json() : [])
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const data = await res.json();
          setIsOnline(data.connected);
        }
      } catch { setIsOnline(false); }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const navigate = (params: string) => {
    router.push(`/${params}`);
  };

  if (collapsed) {
    return (
      <aside className="w-14 bg-mc-bg-secondary border-r border-mc-border flex flex-col items-center py-3 gap-2 flex-shrink-0">
        <button onClick={onToggle} className="p-2 hover:bg-mc-bg-tertiary rounded" title="Expand sidebar">
          <ChevronRight className="w-4 h-4 text-mc-text-secondary" />
        </button>
        <Zap className="w-5 h-5 text-mc-accent-cyan mt-1" />
        <div className="mt-4">
          <button
            onClick={() => navigate('?view=overview')}
            className={`p-2 rounded ${activeView === 'overview' ? 'bg-mc-accent/20 text-mc-accent' : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'}`}
            title="Overview"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
        </div>
        <div className="w-8 border-t border-mc-border my-2" />
        {workspaces.map(ws => (
          <button
            key={ws.id}
            onClick={() => navigate(`?workspace=${ws.slug}`)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${
              activeWorkspace === ws.slug ? 'bg-mc-accent text-mc-bg' : 'bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text'
            }`}
            title={ws.name}
          >
            {ws.name.slice(0, 1)}
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button onClick={() => router.push('/settings')} className="p-2 text-mc-text-secondary hover:bg-mc-bg-tertiary rounded" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-mc-accent-green' : 'bg-mc-accent-red'}`} title={isOnline ? 'Online' : 'Offline'} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-60 bg-mc-bg-secondary border-r border-mc-border flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mc-border">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-mc-accent-cyan" />
          <span className="font-semibold text-sm uppercase tracking-wider">Mission Control</span>
        </div>
        <button onClick={onToggle} className="p-1 hover:bg-mc-bg-tertiary rounded" title="Collapse sidebar">
          <ChevronLeft className="w-4 h-4 text-mc-text-secondary" />
        </button>
      </div>

      {/* Overview */}
      <div className="px-2 pt-3">
        <button
          onClick={() => navigate('?view=overview')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
            activeView === 'overview'
              ? 'bg-mc-accent/20 text-mc-accent'
              : 'text-mc-text-secondary hover:bg-mc-bg-tertiary hover:text-mc-text'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Overview
        </button>
      </div>

      {/* Workspaces */}
      <div className="px-2 pt-4">
        <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-mc-text-secondary font-mono">
          Workspaces
        </div>
        <div className="space-y-0.5">
          {workspaces.map(ws => {
            const activeCount = ws.taskCounts.total - ws.taskCounts.done;
            return (
              <button
                key={ws.id}
                onClick={() => navigate(`?workspace=${ws.slug}`)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                  activeWorkspace === ws.slug
                    ? 'bg-mc-bg-tertiary text-mc-text'
                    : 'text-mc-text-secondary hover:bg-mc-bg-tertiary hover:text-mc-text'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">{ws.icon || '📁'}</span>
                  <span className="truncate">{ws.name}</span>
                </div>
                {activeCount > 0 && (
                  <span className="text-[10px] font-mono bg-mc-bg px-1.5 py-0.5 rounded">{activeCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => navigate('?view=overview')} // TODO: hook up create modal
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-mc-text-secondary hover:bg-mc-bg-tertiary mt-1"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-mc-border px-4 py-3">
        <button
          onClick={() => router.push('/settings')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-mc-text-secondary hover:bg-mc-bg-tertiary mb-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <div className="flex items-center justify-between text-xs text-mc-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <span className="font-mono">{format(currentTime, 'HH:mm')}</span>
        </div>
      </div>
    </aside>
  );
}
```

**Step 2: Create `src/components/DashboardLayout.tsx`**

```tsx
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppSidebar } from './AppSidebar';

function DashboardContent() {
  const searchParams = useSearchParams();
  const activeWorkspace = searchParams.get('workspace');
  const activeView = searchParams.get('view') || (activeWorkspace ? null : 'overview');

  if (activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center text-mc-text-secondary">
        Workspace: {activeWorkspace} (coming in Task 2)
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center text-mc-text-secondary">
      Overview (coming in Task 3)
    </div>
  );
}

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex bg-mc-bg overflow-hidden">
      <Suspense fallback={null}>
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
      </Suspense>
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="text-4xl animate-pulse">🦞</div>
          </div>
        }>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
```

Note: `useSearchParams()` requires a `<Suspense>` boundary in Next.js 14.

**Step 3: Update `src/app/page.tsx`**

Replace the entire file:

```tsx
'use client';

import { DashboardLayout } from '@/components/DashboardLayout';

export default function HomePage() {
  return <DashboardLayout />;
}
```

**Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass. The app now loads at `/` with a sidebar and placeholder content area.

**Step 5: Commit**

```bash
git add src/components/AppSidebar.tsx src/components/DashboardLayout.tsx src/app/page.tsx
git commit -m "feat: add AppSidebar and DashboardLayout shell for unified dashboard"
```

---

### Task 2: Embed workspace view in content area

**Files:**
- Modify: `src/components/DashboardLayout.tsx`
- Modify: `src/components/Header.tsx` (adapt for embedded use)

This task makes clicking a workspace in the sidebar load the full Kanban + agents + live feed in the content area, reusing existing components.

**Step 1: Create WorkspaceContent component inside DashboardLayout**

In `src/components/DashboardLayout.tsx`, replace the placeholder workspace content with an embedded version of the workspace page logic. The key difference from the standalone `/workspace/[slug]` page: no separate `Header` component (the sidebar handles navigation), and the workspace name + stats appear as a thin bar above the Kanban.

Replace the `DashboardContent` function with:

```tsx
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { AgentsSidebar } from './AgentsSidebar';
import { MissionQueue } from './MissionQueue';
import { LiveFeed } from './LiveFeed';
import { SSEDebugPanel } from './SSEDebugPanel';
import { StatsTray } from './StatsTray';
import { useMissionControl } from '@/lib/store';
import { useSSE } from '@/hooks/useSSE';
import type { Task, Workspace } from '@/lib/types';
import { BarChart2, Users, Activity } from 'lucide-react';

function WorkspaceContent({ slug }: { slug: string }) {
  const {
    setAgents, setTasks, setEvents, setTemplates,
    setIsOnline, setIsLoading, isLoading,
    agents, tasks,
  } = useMissionControl();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showStatsTray, setShowStatsTray] = useState(false);
  const [showAgentsDrawer, setShowAgentsDrawer] = useState(false);
  const [showFeedDrawer, setShowFeedDrawer] = useState(false);

  useSSE();

  useEffect(() => {
    setIsLoading(true);
    setWorkspace(null);
    setNotFound(false);

    fetch(`/api/workspaces/${slug}`)
      .then(res => {
        if (res.ok) return res.json();
        if (res.status === 404) { setNotFound(true); setIsLoading(false); }
        return null;
      })
      .then(data => { if (data) setWorkspace(data); })
      .catch(() => { setNotFound(true); setIsLoading(false); });
  }, [slug, setIsLoading]);

  useEffect(() => {
    if (!workspace) return;
    const workspaceId = workspace.id;

    async function loadData() {
      try {
        const [agentsRes, tasksRes, eventsRes, templatesRes] = await Promise.all([
          fetch(`/api/agents?workspace_id=${workspaceId}`),
          fetch(`/api/tasks?workspace_id=${workspaceId}`),
          fetch('/api/events'),
          fetch('/api/templates?deployed=true'),
        ]);
        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (eventsRes.ok) setEvents(await eventsRes.json());
        if (templatesRes.ok) setTemplates(await templatesRes.json());
      } catch (error) {
        console.error('Failed to load workspace data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    async function checkOpenClaw() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/openclaw/status', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) { const status = await res.json(); setIsOnline(status.connected); }
      } catch { setIsOnline(false); }
    }

    loadData();
    checkOpenClaw();

    const eventPoll = setInterval(async () => {
      try { const res = await fetch('/api/events?limit=20'); if (res.ok) setEvents(await res.json()); } catch {}
    }, 30000);
    const taskPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?workspace_id=${workspaceId}`);
        if (res.ok) {
          const newTasks: Task[] = await res.json();
          const currentTasks = useMissionControl.getState().tasks;
          const hasChanges = newTasks.length !== currentTasks.length || newTasks.some(t => {
            const current = currentTasks.find(ct => ct.id === t.id);
            return !current || current.status !== t.status;
          });
          if (hasChanges) setTasks(newTasks);
        }
      } catch {}
    }, 60000);
    const connectionCheck = setInterval(async () => {
      try { const res = await fetch('/api/openclaw/status'); if (res.ok) { const s = await res.json(); setIsOnline(s.connected); } } catch { setIsOnline(false); }
    }, 30000);

    return () => { clearInterval(eventPoll); clearInterval(taskPoll); clearInterval(connectionCheck); };
  }, [workspace, setAgents, setTasks, setEvents, setTemplates, setIsOnline, setIsLoading]);

  // Stats (same logic as Header.tsx)
  const workingAgents = agents.filter(a => a.status === 'working').length;
  const tasksInQueue = tasks.filter(t => t.status !== 'done' && t.status !== 'review').length;
  const todayMidnight = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const { donePercent, pipelineCount, todayCount } = useMemo(() => {
    let done = 0, nonPlanning = 0, pipeline = 0, today = 0;
    for (const t of tasks) {
      if (t.status !== 'planning') nonPlanning++;
      if (t.status === 'done') { done++; if (new Date(t.updated_at) >= todayMidnight) today++; }
      if (t.workflow_template_id && t.status !== 'done' && t.status !== 'review') pipeline++;
    }
    return { donePercent: nonPlanning > 0 ? Math.round((done / nonPlanning) * 100) : 0, pipelineCount: pipeline, todayCount: today };
  }, [tasks, todayMidnight]);

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Workspace not found</h2>
          <p className="text-mc-text-secondary">"{slug}" doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-4xl animate-pulse">🦞</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Workspace header bar */}
      <div className="h-12 bg-mc-bg-secondary border-b border-mc-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{workspace.icon}</span>
          <span className="font-medium">{workspace.name}</span>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="text-center">
            <span className="text-sm font-bold text-mc-accent-cyan">{workingAgents}</span>
            <span className="text-[9px] text-mc-text-secondary ml-1 uppercase font-mono">agt</span>
          </div>
          <div className="text-center">
            <span className="text-sm font-bold text-mc-accent-purple">{tasksInQueue}</span>
            <span className="text-[9px] text-mc-text-secondary ml-1 uppercase font-mono">queue</span>
          </div>
          <div className="text-center">
            <span className="text-sm font-bold text-mc-accent-green">{donePercent}%</span>
            <span className="text-[9px] text-mc-text-secondary ml-1 uppercase font-mono">done</span>
          </div>
          <div className="text-center">
            <span className="text-sm font-bold text-mc-accent-yellow">{pipelineCount}</span>
            <span className="text-[9px] text-mc-text-secondary ml-1 uppercase font-mono">pip</span>
          </div>
          <div className="text-center">
            <span className="text-sm font-bold text-mc-accent-pink">{todayCount}</span>
            <span className="text-[9px] text-mc-text-secondary ml-1 uppercase font-mono">today</span>
          </div>
          <button onClick={() => setShowStatsTray(v => !v)} className={`p-1.5 rounded ${showStatsTray ? 'bg-mc-accent/20 text-mc-accent' : 'text-mc-text-secondary hover:text-mc-text'}`}>
            <BarChart2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex md:hidden items-center gap-2">
          <button onClick={() => { setShowFeedDrawer(false); setShowAgentsDrawer(true); }} className="p-2 text-mc-text-secondary">
            <Users className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowAgentsDrawer(false); setShowFeedDrawer(true); }} className="p-2 text-mc-text-secondary">
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showStatsTray && <StatsTray />}

      {/* Main workspace layout */}
      <div className="flex-1 flex overflow-hidden">
        <AgentsSidebar workspaceId={workspace.id} isDrawerOpen={showAgentsDrawer} onDrawerClose={() => setShowAgentsDrawer(false)} />
        <MissionQueue workspaceId={workspace.id} />
        <LiveFeed isDrawerOpen={showFeedDrawer} onDrawerClose={() => setShowFeedDrawer(false)} />
      </div>
      <SSEDebugPanel />
    </div>
  );
}
```

Update `DashboardContent` to use `WorkspaceContent`:

```tsx
function DashboardContent() {
  const searchParams = useSearchParams();
  const activeWorkspace = searchParams.get('workspace');

  if (activeWorkspace) {
    return <WorkspaceContent slug={activeWorkspace} />;
  }

  return (
    <div className="flex-1 flex items-center justify-center text-mc-text-secondary">
      Overview (coming in Task 3)
    </div>
  );
}
```

**Step 2: Verify the old `/workspace/[slug]` route still works**

The old route continues to work in parallel. We'll remove it after confirming the new layout is fully functional. Do NOT delete it yet.

**Step 3: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass. Navigating to `/?workspace=openclaw` loads the Kanban view inside the sidebar layout.

**Step 4: Commit**

```bash
git add src/components/DashboardLayout.tsx
git commit -m "feat: embed workspace Kanban view in dashboard content area"
```

---

### Task 3: Create the bento grid overview with widget card scaffolds

**Files:**
- Create: `src/components/dashboard/DashboardOverview.tsx`
- Create: `src/components/dashboard/WidgetCard.tsx`
- Modify: `src/components/DashboardLayout.tsx` (import overview)

**Step 1: Create the WidgetCard wrapper component**

`src/components/dashboard/WidgetCard.tsx`:

```tsx
interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, children, className = '' }: WidgetCardProps) {
  return (
    <div className={`bg-mc-bg-secondary border border-mc-border rounded-xl p-4 ${className}`}>
      <h3 className="text-[10px] uppercase tracking-wider text-mc-text-secondary font-mono mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
```

**Step 2: Create the DashboardOverview component**

`src/components/dashboard/DashboardOverview.tsx`:

```tsx
'use client';

import { WidgetCard } from './WidgetCard';

export function DashboardOverview() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Row 1 */}
        <WidgetCard title="Agent Health" accent="cyan" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 5</div>
        </WidgetCard>
        <WidgetCard title="Weather & Time" accent="yellow">
          <div className="text-mc-text-secondary text-sm">Coming in Task 4</div>
        </WidgetCard>
        <WidgetCard title="System Health" accent="green">
          <div className="text-mc-text-secondary text-sm">Coming in Task 5</div>
        </WidgetCard>

        {/* Row 2 */}
        <WidgetCard title="Needs Attention" accent="red" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 6</div>
        </WidgetCard>
        <WidgetCard title="Weekly Velocity" accent="blue" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 7</div>
        </WidgetCard>

        {/* Row 3 */}
        <WidgetCard title="Activity (24h)" accent="purple" className="lg:col-span-2">
          <div className="text-mc-text-secondary text-sm">Coming in Task 6</div>
        </WidgetCard>
        <WidgetCard title="Token / Cost" accent="green">
          <div className="text-mc-text-secondary text-sm">Coming in Task 8</div>
        </WidgetCard>
        <WidgetCard title="Workspaces" accent="pink">
          <div className="text-mc-text-secondary text-sm">Coming in Task 8</div>
        </WidgetCard>
      </div>
    </div>
  );
}
```

**Step 3: Wire DashboardOverview into DashboardLayout**

In `src/components/DashboardLayout.tsx`, import `DashboardOverview` and replace the overview placeholder:

```tsx
import { DashboardOverview } from './dashboard/DashboardOverview';

// In DashboardContent, replace the overview placeholder:
if (activeWorkspace) {
  return <WorkspaceContent slug={activeWorkspace} />;
}
return <DashboardOverview />;
```

**Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass. Navigating to `/` or `/?view=overview` shows the bento grid of placeholder cards.

**Step 5: Commit**

```bash
git add src/components/dashboard/DashboardOverview.tsx src/components/dashboard/WidgetCard.tsx src/components/DashboardLayout.tsx
git commit -m "feat: add bento grid overview layout with widget card scaffolds"
```

---

### Task 4: Weather & Time widget + weather API proxy

**Files:**
- Create: `src/app/api/dashboard/weather/route.ts`
- Create: `src/components/dashboard/WeatherWidget.tsx`
- Modify: `src/components/dashboard/DashboardOverview.tsx`

**Step 1: Create the weather API proxy**

`src/app/api/dashboard/weather/route.ts`:

```tsx
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
let weatherCache: { data: unknown; expiresAt: number } | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat') || '25.2048'; // Default: Dubai
  const lon = searchParams.get('lon') || '55.2708';

  // Return cached if valid
  if (weatherCache && Date.now() < weatherCache.expiresAt) {
    return NextResponse.json(weatherCache.data);
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
      { next: { revalidate: 1800 } } // 30 min
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
    }

    const raw = await res.json();
    const current = raw.current;

    const data = {
      temp: Math.round(current.temperature_2m),
      unit: raw.current_units?.temperature_2m || '°C',
      weatherCode: current.weather_code,
      condition: weatherCodeToCondition(current.weather_code),
      timezone: raw.timezone,
    };

    weatherCache = { data, expiresAt: Date.now() + 30 * 60 * 1000 };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 502 });
  }
}

function weatherCodeToCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}
```

Note: Update the default lat/lon coordinates to match the user's location.

**Step 2: Create the WeatherWidget component**

`src/components/dashboard/WeatherWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Cloud, Sun, CloudRain, Snowflake, CloudLightning, CloudDrizzle, CloudFog } from 'lucide-react';

interface WeatherData {
  temp: number;
  unit: string;
  condition: string;
  weatherCode: number;
}

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="w-8 h-8 text-mc-accent-yellow" />;
  if (code <= 3) return <Cloud className="w-8 h-8 text-mc-text-secondary" />;
  if (code <= 48) return <CloudFog className="w-8 h-8 text-mc-text-secondary" />;
  if (code <= 57) return <CloudDrizzle className="w-8 h-8 text-mc-accent-cyan" />;
  if (code <= 67) return <CloudRain className="w-8 h-8 text-mc-accent-cyan" />;
  if (code <= 77) return <Snowflake className="w-8 h-8 text-white" />;
  if (code <= 86) return <Snowflake className="w-8 h-8 text-white" />;
  if (code <= 99) return <CloudLightning className="w-8 h-8 text-mc-accent-yellow" />;
  return <Cloud className="w-8 h-8 text-mc-text-secondary" />;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Try geolocation, fallback to defaults
    const fetchWeather = async (lat?: number, lon?: number) => {
      const params = lat && lon ? `?lat=${lat}&lon=${lon}` : '';
      try {
        const res = await fetch(`/api/dashboard/weather${params}`);
        if (res.ok) setWeather(await res.json());
      } catch {}
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather() // fallback on deny
      );
    } else {
      fetchWeather();
    }

    // Refresh weather every 30 min
    const weatherInterval = setInterval(() => fetchWeather(), 30 * 60 * 1000);
    // Update clock every minute
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 60000);

    return () => { clearInterval(weatherInterval); clearInterval(clockInterval); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      {weather ? (
        <>
          {getWeatherIcon(weather.weatherCode)}
          <div className="text-2xl font-bold">{weather.temp}{weather.unit}</div>
          <div className="text-xs text-mc-text-secondary">{weather.condition}</div>
        </>
      ) : (
        <div className="text-mc-text-secondary text-sm">Loading...</div>
      )}
      <div className="mt-2 text-center">
        <div className="text-lg font-mono font-bold">{format(currentTime, 'HH:mm')}</div>
        <div className="text-xs text-mc-text-secondary">{format(currentTime, 'EEEE, MMM d')}</div>
      </div>
    </div>
  );
}
```

**Step 3: Replace placeholder in DashboardOverview**

In `src/components/dashboard/DashboardOverview.tsx`, import and use the WeatherWidget:

```tsx
import { WeatherWidget } from './WeatherWidget';

// Replace the "Weather & Time" WidgetCard content:
<WidgetCard title="Weather & Time" accent="yellow">
  <WeatherWidget />
</WidgetCard>
```

**Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 5: Commit**

```bash
git add src/app/api/dashboard/weather/route.ts src/components/dashboard/WeatherWidget.tsx src/components/dashboard/DashboardOverview.tsx
git commit -m "feat: add weather API proxy and Weather & Time widget"
```

---

### Task 5: Agent Health Grid + System Health widgets

**Files:**
- Create: `src/components/dashboard/AgentHealthWidget.tsx`
- Create: `src/components/dashboard/SystemHealthWidget.tsx`
- Modify: `src/components/dashboard/DashboardOverview.tsx`

**Step 1: Create the AgentHealthWidget**

`src/components/dashboard/AgentHealthWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { Agent } from '@/lib/types';

export function AgentHealthWidget() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.ok ? res.json() : [])
      .then((data: Agent[]) => {
        // Sort: working first, then idle, then standby, then offline
        const order: Record<string, number> = { working: 0, idle: 1, standby: 2, offline: 3 };
        data.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
        setAgents(data);
      })
      .catch(() => {});

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data: Agent[] = await res.json();
          const order: Record<string, number> = { working: 0, idle: 1, standby: 2, offline: 3 };
          data.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
          setAgents(data);
        }
      } catch {}
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const statusColor: Record<string, string> = {
    working: 'bg-mc-accent-green',
    idle: 'bg-mc-text-secondary',
    standby: 'bg-mc-text-secondary',
    offline: 'bg-mc-bg-tertiary',
  };

  const statusPulse: Record<string, string> = {
    working: 'animate-pulse',
  };

  if (agents.length === 0) {
    return <div className="text-mc-text-secondary text-sm">No agents found</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {agents.slice(0, 9).map(agent => (
        <button
          key={agent.id}
          onClick={() => router.push(`/?workspace=${encodeURIComponent(agent.workspace_id)}`)}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-mc-bg-tertiary transition-colors text-left"
        >
          <div className="relative flex-shrink-0">
            <span className="w-8 h-8 rounded-full bg-mc-bg-tertiary border border-mc-border/50 flex items-center justify-center text-xs font-bold text-mc-accent uppercase">
              {agent.name.slice(0, 2)}
            </span>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-mc-bg-secondary ${statusColor[agent.status] || 'bg-mc-text-secondary'} ${statusPulse[agent.status] || ''}`} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{agent.name}</div>
            <div className="text-[10px] text-mc-text-secondary truncate">{agent.role}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

Note: The workspace_id in agents is a UUID, not a slug. To navigate correctly, we need the workspace slug. The simplest approach: fetch workspace list on mount (already in the sidebar), or change the click handler to use the workspace ID as a query param. For now, use the agent's workspace_id and adjust once integrated.

**Step 2: Create the SystemHealthWidget**

`src/components/dashboard/SystemHealthWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface HealthStatus {
  gatewayConnected: boolean;
  sessionCount: number;
  lastHeartbeat: string | null;
  heartbeatOk: boolean;
}

export function SystemHealthWidget() {
  const [health, setHealth] = useState<HealthStatus>({
    gatewayConnected: false,
    sessionCount: 0,
    lastHeartbeat: null,
    heartbeatOk: false,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const [statusRes, heartbeatRes] = await Promise.all([
          fetch('/api/openclaw/status').catch(() => null),
          fetch('/api/heartbeat').catch(() => null),
        ]);

        const status = statusRes?.ok ? await statusRes.json() : null;
        const heartbeat = heartbeatRes?.ok ? await heartbeatRes.json() : null;

        setHealth({
          gatewayConnected: status?.connected ?? false,
          sessionCount: status?.sessions_count ?? 0,
          lastHeartbeat: heartbeat?.runAt ?? null,
          heartbeatOk: heartbeat && !heartbeat.error,
        });
      } catch {}
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    {
      label: 'Gateway',
      value: health.gatewayConnected ? 'Connected' : 'Disconnected',
      color: health.gatewayConnected ? 'text-mc-accent-green' : 'text-mc-accent-red',
      dot: health.gatewayConnected ? 'bg-mc-accent-green' : 'bg-mc-accent-red',
    },
    {
      label: 'Sessions',
      value: String(health.sessionCount),
      color: 'text-mc-text',
      dot: health.sessionCount > 0 ? 'bg-mc-accent-cyan' : 'bg-mc-text-secondary',
    },
    {
      label: 'Heartbeat',
      value: health.lastHeartbeat
        ? formatDistanceToNow(new Date(health.lastHeartbeat), { addSuffix: true })
        : 'Unknown',
      color: health.heartbeatOk ? 'text-mc-accent-green' : 'text-mc-accent-yellow',
      dot: health.heartbeatOk ? 'bg-mc-accent-green' : 'bg-mc-accent-yellow',
    },
  ];

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${item.dot}`} />
            <span className="text-xs text-mc-text-secondary">{item.label}</span>
          </div>
          <span className={`text-xs font-medium ${item.color}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Wire widgets into DashboardOverview**

Import and replace placeholders:

```tsx
import { AgentHealthWidget } from './AgentHealthWidget';
import { SystemHealthWidget } from './SystemHealthWidget';

// Replace Agent Health placeholder:
<WidgetCard title="Agent Health" accent="cyan" className="lg:col-span-2">
  <AgentHealthWidget />
</WidgetCard>

// Replace System Health placeholder:
<WidgetCard title="System Health" accent="green">
  <SystemHealthWidget />
</WidgetCard>
```

**Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 5: Commit**

```bash
git add src/components/dashboard/AgentHealthWidget.tsx src/components/dashboard/SystemHealthWidget.tsx src/components/dashboard/DashboardOverview.tsx
git commit -m "feat: add Agent Health Grid and System Health widgets"
```

---

### Task 6: Needs Attention + Activity Summary widgets

**Files:**
- Create: `src/components/dashboard/NeedsAttentionWidget.tsx`
- Create: `src/components/dashboard/ActivitySummaryWidget.tsx`
- Modify: `src/components/dashboard/DashboardOverview.tsx`

**Step 1: Create NeedsAttentionWidget**

`src/components/dashboard/NeedsAttentionWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, Task } from '@/lib/types';

interface AttentionItem {
  icon: React.ReactNode;
  message: string;
  action?: string; // URL param to navigate
  severity: 'error' | 'warning' | 'info';
}

export function NeedsAttentionWidget() {
  const router = useRouter();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAttention = async () => {
      const attention: AttentionItem[] = [];

      try {
        const [agentsRes, tasksRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/tasks'),
        ]);

        const agents: Agent[] = agentsRes.ok ? await agentsRes.json() : [];
        const tasks: Task[] = tasksRes.ok ? await tasksRes.json() : [];

        // 1. Agents with error/offline status
        const errorAgents = agents.filter(a => a.status === 'offline');
        for (const agent of errorAgents.slice(0, 2)) {
          attention.push({
            icon: <XCircle className="w-4 h-4 text-mc-accent-red" />,
            message: `${agent.name} is offline`,
            severity: 'error',
          });
        }

        // 2. Tasks stuck in_progress > 2 hours
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const stuckTasks = tasks.filter(t =>
          t.status === 'in_progress' && new Date(t.updated_at).getTime() < twoHoursAgo
        );
        for (const task of stuckTasks.slice(0, 2)) {
          attention.push({
            icon: <Clock className="w-4 h-4 text-mc-accent-yellow" />,
            message: `"${task.title}" stuck for ${formatDistanceToNow(new Date(task.updated_at))}`,
            severity: 'warning',
          });
        }

        // 3. Tasks in review
        const reviewTasks = tasks.filter(t => t.status === 'review');
        if (reviewTasks.length > 0) {
          attention.push({
            icon: <AlertTriangle className="w-4 h-4 text-mc-accent-purple" />,
            message: `${reviewTasks.length} task${reviewTasks.length > 1 ? 's' : ''} awaiting review`,
            severity: 'info',
          });
        }

        setItems(attention.slice(0, 5));
      } catch {}
      setLoading(false);
    };

    checkAttention();
    const interval = setInterval(checkAttention, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-mc-text-secondary text-sm">Checking...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-mc-accent-green">
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm font-medium">All clear — nothing needs your attention</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-mc-bg/50">
          {item.icon}
          <span className="text-sm truncate">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create ActivitySummaryWidget**

`src/components/dashboard/ActivitySummaryWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare, PlusCircle, Zap, AlertTriangle, Clock } from 'lucide-react';
import type { Event } from '@/lib/types';

export function ActivitySummaryWidget() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events?limit=50');
        if (res.ok) setEvents(await res.json());
      } catch {}
      setLoading(false);
    };

    loadEvents();
    const interval = setInterval(loadEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-mc-text-secondary text-sm">Loading...</div>;
  }

  // Filter to last 24h
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentEvents = events.filter(e => new Date(e.created_at).getTime() > dayAgo);

  const completed = recentEvents.filter(e => e.type === 'task_completed').length;
  const created = recentEvents.filter(e => e.type === 'task_created').length;
  const assigned = recentEvents.filter(e => e.type === 'task_assigned').length;
  const errors = recentEvents.filter(e => e.type === 'system' && e.message.toLowerCase().includes('error')).length;

  const stats = [
    { icon: <CheckSquare className="w-3.5 h-3.5" />, label: 'Done', value: completed, color: 'text-mc-accent-green' },
    { icon: <PlusCircle className="w-3.5 h-3.5" />, label: 'Created', value: created, color: 'text-mc-accent-pink' },
    { icon: <Zap className="w-3.5 h-3.5" />, label: 'Dispatched', value: assigned, color: 'text-mc-accent-cyan' },
    { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Errors', value: errors, color: 'text-mc-accent-red' },
  ];

  return (
    <div>
      {/* Stat pills */}
      <div className="flex gap-3 mb-3">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={s.color}>{s.icon}</span>
            <span className="text-sm font-bold">{s.value}</span>
            <span className="text-[10px] text-mc-text-secondary uppercase">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Recent events list */}
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {events.slice(0, 8).map(event => (
          <div key={event.id} className="flex items-center gap-2 text-xs">
            <span className="text-mc-text-secondary flex-shrink-0">
              <Clock className="w-3 h-3 inline" />{' '}
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </span>
            <span className="truncate">{event.message}</span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-mc-text-secondary text-sm">No recent activity</div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Wire into DashboardOverview**

Import and replace:

```tsx
import { NeedsAttentionWidget } from './NeedsAttentionWidget';
import { ActivitySummaryWidget } from './ActivitySummaryWidget';

<WidgetCard title="Needs Attention" accent="red" className="lg:col-span-2">
  <NeedsAttentionWidget />
</WidgetCard>

<WidgetCard title="Activity (24h)" accent="purple" className="lg:col-span-2">
  <ActivitySummaryWidget />
</WidgetCard>
```

**Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 5: Commit**

```bash
git add src/components/dashboard/NeedsAttentionWidget.tsx src/components/dashboard/ActivitySummaryWidget.tsx src/components/dashboard/DashboardOverview.tsx
git commit -m "feat: add Needs Attention and Activity Summary widgets"
```

---

### Task 7: Weekly Velocity Chart widget (SVG bar chart)

**Files:**
- Create: `src/components/dashboard/VelocityWidget.tsx`
- Modify: `src/components/dashboard/DashboardOverview.tsx`

**Step 1: Create the VelocityWidget**

`src/components/dashboard/VelocityWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import type { Event } from '@/lib/types';

export function VelocityWidget() {
  const [dailyCounts, setDailyCounts] = useState<{ day: string; label: string; count: number }[]>([]);

  useEffect(() => {
    const loadVelocity = async () => {
      try {
        const res = await fetch('/api/events?limit=200');
        if (!res.ok) return;
        const events: Event[] = await res.json();

        // Build last 7 days
        const days: { day: string; label: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = startOfDay(subDays(new Date(), i));
          days.push({
            day: format(date, 'yyyy-MM-dd'),
            label: format(date, 'EEE'),
            count: 0,
          });
        }

        // Count task_completed events per day
        for (const event of events) {
          if (event.type !== 'task_completed') continue;
          const eventDay = format(new Date(event.created_at), 'yyyy-MM-dd');
          const match = days.find(d => d.day === eventDay);
          if (match) match.count++;
        }

        setDailyCounts(days);
      } catch {}
    };

    loadVelocity();
  }, []);

  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-28">
      {dailyCounts.map((day, i) => {
        const heightPct = (day.count / maxCount) * 100;
        const isToday = i === dailyCounts.length - 1;

        return (
          <div key={day.day} className="flex-1 flex flex-col items-center gap-1 group">
            {/* Count tooltip on hover */}
            <span className="text-[10px] font-mono text-mc-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
              {day.count}
            </span>
            {/* Bar with gradient fade + glow on today */}
            <div className="w-full bg-mc-bg-tertiary rounded-t flex-1 relative">
              <div
                className={`absolute bottom-0 w-full rounded-t transition-all duration-300 ${
                  isToday ? 'bg-gradient-to-t from-mc-accent to-mc-accent/30' : 'bg-gradient-to-t from-mc-accent/50 to-mc-accent/10'
                }`}
                style={{
                  height: `${Math.max(heightPct, 4)}%`,
                  ...(isToday && day.count > 0 ? { boxShadow: '0 0 8px rgba(88, 166, 255, 0.4)' } : {}),
                }}
              />
            </div>
            {/* Day label */}
            <span className={`text-[10px] font-mono ${isToday ? 'text-mc-accent font-bold' : 'text-mc-text-secondary'}`}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Wire into DashboardOverview**

```tsx
import { VelocityWidget } from './VelocityWidget';

<WidgetCard title="Weekly Velocity" accent="blue" className="lg:col-span-2">
  <VelocityWidget />
</WidgetCard>
```

**Step 3: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 4: Commit**

```bash
git add src/components/dashboard/VelocityWidget.tsx src/components/dashboard/DashboardOverview.tsx
git commit -m "feat: add Weekly Velocity bar chart widget"
```

---

### Task 8: Token/Cost Tracker + Workspace Shortcuts widgets + daily_stats migration

**Files:**
- Create: `src/components/dashboard/CostWidget.tsx`
- Create: `src/components/dashboard/WorkspacesWidget.tsx`
- Create: `src/app/api/dashboard/stats/route.ts`
- Modify: `src/components/dashboard/DashboardOverview.tsx`

This task creates the final two widgets. The Token/Cost widget requires a new Supabase `daily_stats` table and API route. Since no token data exists yet (the completion webhook doesn't log tokens), the widget will show `$0.00` initially — it becomes useful once the webhook is updated to log costs (a separate follow-up task, not part of this plan).

**Step 1: Create the daily_stats Supabase table**

Apply migration via Supabase MCP:

```sql
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,4) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, workspace_id)
);
```

**Step 2: Create the stats API route**

`src/app/api/dashboard/stats/route.ts`:

```tsx
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function GET() {
  try {
    const supabase = getSupabase();

    // Last 7 days of stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Failed to fetch daily stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Aggregate
    const today = new Date().toISOString().split('T')[0];
    const todayStats = (data || []).filter(d => d.date === today);
    const todayCost = todayStats.reduce((sum, d) => sum + Number(d.estimated_cost), 0);
    const weekCost = (data || []).reduce((sum, d) => sum + Number(d.estimated_cost), 0);
    const weekTokens = (data || []).reduce((sum, d) => sum + d.total_tokens, 0);

    // Daily breakdown for sparkline
    const daily = (data || []).map(d => ({
      date: d.date,
      cost: Number(d.estimated_cost),
      tokens: d.total_tokens,
    }));

    return NextResponse.json({
      todayCost,
      weekCost,
      weekTokens,
      daily,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Step 3: Create the CostWidget**

`src/components/dashboard/CostWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

interface StatsData {
  todayCost: number;
  weekCost: number;
  weekTokens: number;
  daily: { date: string; cost: number }[];
}

export function CostWidget() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) setStats(await res.json());
      } catch {}
    };
    loadStats();
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <div className="text-mc-text-secondary text-sm">Loading...</div>;
  }

  const maxCost = Math.max(...stats.daily.map(d => d.cost), 0.01);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-bold text-mc-accent-green">${stats.todayCost.toFixed(2)}</div>
        <div className="text-[10px] text-mc-text-secondary uppercase">Today</div>
      </div>
      <div>
        <div className="text-sm font-bold">${stats.weekCost.toFixed(2)}</div>
        <div className="text-[10px] text-mc-text-secondary uppercase">This Week</div>
      </div>

      {/* Sparkline */}
      {stats.daily.length > 0 && (
        <svg className="w-full h-6" viewBox={`0 0 ${stats.daily.length * 10} 24`}>
          {stats.daily.map((d, i) => {
            const h = (d.cost / maxCost) * 20;
            return (
              <rect
                key={d.date}
                x={i * 10 + 1}
                y={22 - h}
                width={8}
                height={Math.max(h, 1)}
                rx={1}
                className="fill-mc-accent/60"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
```

**Step 4: Create the WorkspacesWidget**

`src/components/dashboard/WorkspacesWidget.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceStats } from '@/lib/types';

export function WorkspacesWidget() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceStats[]>([]);

  useEffect(() => {
    fetch('/api/workspaces?stats=true')
      .then(res => res.ok ? res.json() : [])
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-2">
      {workspaces.slice(0, 5).map(ws => (
        <button
          key={ws.id}
          onClick={() => router.push(`/?workspace=${ws.slug}`)}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-mc-bg-tertiary transition-colors text-left"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm">{ws.icon || '📁'}</span>
            <span className="text-sm truncate">{ws.name}</span>
          </div>
          <span className="text-[10px] font-mono text-mc-text-secondary">
            {ws.taskCounts.total - ws.taskCounts.done} active
          </span>
        </button>
      ))}
      {workspaces.length === 0 && (
        <div className="text-mc-text-secondary text-sm">No workspaces</div>
      )}
    </div>
  );
}
```

**Step 5: Wire into DashboardOverview**

Import and replace the final two placeholders:

```tsx
import { CostWidget } from './CostWidget';
import { WorkspacesWidget } from './WorkspacesWidget';

<WidgetCard title="Token / Cost" accent="green">
  <CostWidget />
</WidgetCard>
<WidgetCard title="Workspaces" accent="pink">
  <WorkspacesWidget />
</WidgetCard>
```

**Step 6: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 7: Commit**

```bash
git add src/components/dashboard/CostWidget.tsx src/components/dashboard/WorkspacesWidget.tsx src/app/api/dashboard/stats/route.ts src/components/dashboard/DashboardOverview.tsx
git commit -m "feat: add Token/Cost and Workspace Shortcuts widgets with daily_stats API"
```

---

### Task 9: Mobile responsive sidebar + polish

**Files:**
- Modify: `src/components/DashboardLayout.tsx` (add mobile drawer)
- Modify: `src/components/AppSidebar.tsx` (add mobile drawer mode)
- Modify: `src/components/dashboard/DashboardOverview.tsx` (responsive tweaks)

**Step 1: Add mobile sidebar drawer to DashboardLayout**

In `DashboardLayout`, add a hamburger button for mobile and render the sidebar as a drawer overlay on small screens.

At the top of the `DashboardLayout` component:

```tsx
import { Menu, X } from 'lucide-react';

// Inside DashboardLayout:
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
```

Wrap the return JSX:

```tsx
return (
  <div className="h-screen flex bg-mc-bg overflow-hidden">
    {/* Desktop sidebar */}
    <div className="hidden md:flex">
      <Suspense fallback={null}>
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
      </Suspense>
    </div>

    {/* Mobile drawer overlay */}
    {mobileDrawerOpen && (
      <div className="fixed inset-0 z-50 md:hidden">
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileDrawerOpen(false)} />
        <div className="relative w-60 h-full">
          <Suspense fallback={null}>
            <AppSidebar collapsed={false} onToggle={() => setMobileDrawerOpen(false)} />
          </Suspense>
        </div>
      </div>
    )}

    {/* Main content */}
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mobile header bar */}
      <div className="h-12 bg-mc-bg-secondary border-b border-mc-border flex md:hidden items-center px-4 gap-3 flex-shrink-0">
        <button onClick={() => setMobileDrawerOpen(true)} className="p-1">
          <Menu className="w-5 h-5 text-mc-text-secondary" />
        </button>
        <Zap className="w-4 h-4 text-mc-accent-cyan" />
        <span className="font-semibold text-sm uppercase tracking-wider">Mission Control</span>
      </div>

      <main className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="text-4xl animate-pulse">🦞</div>
          </div>
        }>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  </div>
);
```

Add `Zap` to the imports from `lucide-react`.

**Step 2: Responsive tweaks in DashboardOverview**

Verify the bento grid works at mobile breakpoints. The existing `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` should handle it. Test by resizing the browser.

Ensure widgets that use `grid-cols-2 sm:grid-cols-3` (like AgentHealthWidget) degrade to 1 column on very small screens.

**Step 3: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 4: Manual testing checklist**

- [ ] `/` loads overview with all 8 widgets
- [ ] Clicking a workspace in sidebar loads Kanban
- [ ] Sidebar collapse/expand works on desktop
- [ ] Mobile: hamburger opens sidebar drawer
- [ ] Mobile: bento grid stacks to 1 column
- [ ] Mobile: workspace view shows agents/feed drawer buttons
- [ ] Weather widget loads and shows temp/clock
- [ ] System health shows gateway status
- [ ] Agent health shows all agents across workspaces
- [ ] Needs Attention shows empty state or items

**Step 5: Commit**

```bash
git add src/components/DashboardLayout.tsx src/components/AppSidebar.tsx src/components/dashboard/DashboardOverview.tsx
git commit -m "feat: add mobile responsive sidebar drawer and polish"
```

---

## Summary

| Task | Category | Effort |
|------|----------|--------|
| 0. Visual foundation (CSS + WidgetCard) | Design | Small |
| 1. DashboardLayout + AppSidebar shell | Layout | Medium |
| 2. Embed workspace view in content area | Layout | Medium |
| 3. Bento grid with widget scaffolds | Layout | Small |
| 4. Weather & Time widget + API proxy | Widget | Small |
| 5. Agent Health + System Health widgets | Widget | Medium |
| 6. Needs Attention + Activity Summary | Widget | Medium |
| 7. Weekly Velocity Chart (SVG) | Widget | Small |
| 8. Token/Cost + Workspaces + daily_stats | Widget + Backend | Medium |
| 9. Mobile responsive + polish | Polish | Small |

**Total: 10 tasks.**

**Dependencies:** Task 0 must be done first (CSS + WidgetCard foundation). Task 1 depends on Task 0. Task 2 depends on Task 1. Task 3 depends on Task 0 + Task 1. Tasks 4-8 each depend on Task 3 (need bento grid to exist) but are independent of each other. Task 9 depends on all previous tasks.

**What's NOT in this plan (follow-up work):**
- Token tracking in the agent-completion webhook (needs the webhook to actually send token data)
- Removing the old `/workspace/[slug]` route (do this after confirming new layout works)
- New Workspace creation from sidebar (currently navigates to overview as placeholder)
- Workspace slug resolution for AgentHealthWidget navigation
