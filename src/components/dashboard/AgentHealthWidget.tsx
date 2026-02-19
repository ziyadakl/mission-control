'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Agent } from '@/lib/types';

export function AgentHealthWidget() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.ok ? res.json() : [])
      .then((data: Agent[]) => {
        const order: Record<string, number> = { working: 0, idle: 1, standby: 2, offline: 3 };
        data.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
        setAgents(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

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

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-mc-bg-tertiary animate-pulse" />
            <div className="space-y-1 flex-1">
              <div className="h-3 w-16 bg-mc-bg-tertiary rounded animate-pulse" />
              <div className="h-2 w-12 bg-mc-bg-tertiary rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

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
