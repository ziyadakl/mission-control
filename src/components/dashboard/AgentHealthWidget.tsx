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

  const dotColor: Record<string, string> = {
    working: 'bg-emerald-400',
    idle: 'bg-white/30',
    standby: 'bg-white/20',
    offline: 'bg-white/10',
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-white/[0.04] animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-14 bg-white/[0.04] rounded animate-pulse" />
              <div className="h-2 w-10 bg-white/[0.04] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return <div className="text-[13px] text-white/30">No agents found</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
      {agents.slice(0, 9).map(agent => (
        <button
          key={agent.id}
          onClick={() => router.push(`/?workspace=${encodeURIComponent(agent.workspace_id)}`)}
          className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors duration-200 text-left"
        >
          <div className="relative flex-shrink-0">
            <span className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] text-white/50 uppercase">
              {agent.name.slice(0, 2)}
            </span>
            <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${dotColor[agent.status] || 'bg-white/20'}`} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-white/70 truncate">{agent.name}</div>
            <div className="text-[11px] text-white/25 truncate">{agent.role}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
