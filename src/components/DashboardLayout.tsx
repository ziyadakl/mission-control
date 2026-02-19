'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { AgentsSidebar } from './AgentsSidebar';
import { MissionQueue } from './MissionQueue';
import { LiveFeed } from './LiveFeed';
import { SSEDebugPanel } from './SSEDebugPanel';
import { StatsTray } from './StatsTray';
import { useMissionControl } from '@/lib/store';
import { useSSE } from '@/hooks/useSSE';
import type { Task, Workspace } from '@/lib/types';
import { BarChart2, Users, Activity, Menu, Zap, ChevronLeft } from 'lucide-react';
import { DashboardOverview } from './dashboard/DashboardOverview';

function WorkspaceContent({ slug }: { slug: string }) {
  const router = useRouter();
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
          <p className="text-mc-text-secondary">&quot;{slug}&quot; doesn&apos;t exist.</p>
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
          <button onClick={() => router.push('/')} className="p-1 -ml-1 rounded hover:bg-white/[0.04] transition-colors text-white/40 hover:text-white/70">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg">{workspace.icon}</span>
          <span className="font-medium">{workspace.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="text-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{workingAgents}</span>
              <span className="text-[9px] text-white/30 ml-1 uppercase tracking-wider">agt</span>
            </div>
            <div className="text-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{tasksInQueue}</span>
              <span className="text-[9px] text-white/30 ml-1 uppercase tracking-wider">queue</span>
            </div>
            <div className="text-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{donePercent}%</span>
              <span className="text-[9px] text-white/30 ml-1 uppercase tracking-wider">done</span>
            </div>
            <div className="hidden md:block text-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{pipelineCount}</span>
              <span className="text-[9px] text-white/30 ml-1 uppercase tracking-wider">pip</span>
            </div>
            <div className="hidden md:block text-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{todayCount}</span>
              <span className="text-[9px] text-white/30 ml-1 uppercase tracking-wider">today</span>
            </div>
          </div>
          <div className="flex md:hidden items-center gap-1 ml-1">
            <button onClick={() => { setShowFeedDrawer(false); setShowAgentsDrawer(true); }} className="p-1.5 text-white/40 hover:text-white/70">
              <Users className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowAgentsDrawer(false); setShowFeedDrawer(true); }} className="p-1.5 text-white/40 hover:text-white/70">
              <Activity className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowStatsTray(v => !v)} className={`hidden md:block p-1.5 rounded ${showStatsTray ? 'bg-white/[0.06] text-white/70' : 'text-white/40 hover:text-white/70'}`}>
            <BarChart2 className="w-4 h-4" />
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const activeWorkspace = searchParams.get('workspace');

  if (activeWorkspace) {
    return <WorkspaceContent slug={activeWorkspace} />;
  }

  return <DashboardOverview />;
}

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
}
