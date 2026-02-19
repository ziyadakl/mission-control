'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Settings, ChevronLeft, LayoutGrid, BarChart2 } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { format } from 'date-fns';
import type { Workspace } from '@/lib/types';

interface HeaderProps {
  workspace?: Workspace;
  showStatsTray?: boolean;
  onToggleStats?: () => void;
}

export function Header({ workspace, showStatsTray, onToggleStats }: HeaderProps) {
  const router = useRouter();
  const { agents, tasks, isOnline } = useMissionControl();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSubAgents, setActiveSubAgents] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active sub-agent count
  useEffect(() => {
    const loadSubAgentCount = async () => {
      try {
        const res = await fetch('/api/openclaw/sessions?session_type=subagent&status=active');
        if (res.ok) {
          const sessions = await res.json();
          setActiveSubAgents(sessions.length);
        }
      } catch (error) {
        console.error('Failed to load sub-agent count:', error);
      }
    };

    loadSubAgentCount();

    // Poll every 30 seconds (reduced from 10s to reduce load)
    const interval = setInterval(loadSubAgentCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const workingAgents = agents.filter((a) => a.status === 'working').length;
  const activeAgents = workingAgents + activeSubAgents;
  const tasksInQueue = tasks.filter((t) => t.status !== 'done' && t.status !== 'review').length;

  // todayMidnight only changes once per day — key on datestring, not the full timestamp
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime.toDateString()]);

  // Recompute stats only when tasks list or the calendar day changes (not every clock tick)
  const { doneCount, nonPlanningCount, donePercent, pipelineCount, todayCount } = useMemo(() => {
    let done = 0, nonPlanning = 0, pipeline = 0, today = 0;
    for (const t of tasks) {
      if (t.status !== 'planning') nonPlanning++;
      if (t.status === 'done') {
        done++;
        if (new Date(t.updated_at) >= todayMidnight) today++;
      }
      if (t.workflow_template_id && t.status !== 'done' && t.status !== 'review') pipeline++;
    }
    return {
      doneCount: done,
      nonPlanningCount: nonPlanning,
      donePercent: nonPlanning > 0 ? Math.round((done / nonPlanning) * 100) : 0,
      pipelineCount: pipeline,
      todayCount: today,
    };
  }, [tasks, todayMidnight]);

  return (
    <header className="h-14 bg-mc-bg-secondary border-b border-mc-border flex items-center justify-between px-4">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-mc-accent-cyan" />
          <span className="font-semibold text-mc-text uppercase tracking-wider text-sm">
            Mission Control
          </span>
        </div>

        {/* Workspace indicator or back to dashboard */}
        {workspace ? (
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1 text-mc-text-secondary hover:text-mc-accent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <LayoutGrid className="w-4 h-4" />
            </Link>
            <span className="text-mc-text-secondary">/</span>
            <div className="flex items-center gap-2 px-3 py-1 bg-mc-bg-tertiary rounded">
              <span className="text-lg">{workspace.icon}</span>
              <span className="font-medium">{workspace.name}</span>
            </div>
          </div>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1 bg-mc-bg-tertiary rounded hover:bg-mc-bg transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-sm">All Workspaces</span>
          </Link>
        )}
      </div>

      {/* Center: Stats - only show in workspace view */}
      {workspace && (
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-mc-accent-cyan">{activeAgents}</div>
            <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider font-mono">Agents Active</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-mc-accent-purple">{tasksInQueue}</div>
            <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider font-mono">Queue</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-mc-accent-green">{donePercent}%</div>
            <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider font-mono">Done %</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-mc-accent-yellow">{pipelineCount}</div>
            <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider font-mono">Pipelines</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-mc-accent-pink">{todayCount}</div>
            <div className="text-[10px] text-mc-text-secondary uppercase tracking-wider font-mono">Today</div>
          </div>
          <button
            onClick={onToggleStats}
            className={`p-1.5 rounded transition-colors ${
              showStatsTray
                ? 'bg-mc-accent/20 text-mc-accent'
                : 'text-mc-text-secondary hover:text-mc-text'
            }`}
            title="Toggle Stats"
            aria-label="Toggle Stats"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right: Time & Status */}
      <div className="flex items-center gap-4">
        <span className="text-mc-text-secondary text-sm font-mono">
          {format(currentTime, 'HH:mm:ss')}
        </span>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border text-sm font-medium ${
            isOnline
              ? 'bg-mc-accent-green/20 border-mc-accent-green text-mc-accent-green'
              : 'bg-mc-accent-red/20 border-mc-accent-red text-mc-accent-red'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'
            }`}
          />
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
        <button
          onClick={() => router.push('/settings')}
          className="p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
