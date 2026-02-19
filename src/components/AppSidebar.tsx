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
                <span className="truncate">{ws.name}</span>
                {activeCount > 0 && (
                  <span className="text-[10px] font-mono bg-mc-bg px-1.5 py-0.5 rounded">{activeCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => navigate('?view=overview')}
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
