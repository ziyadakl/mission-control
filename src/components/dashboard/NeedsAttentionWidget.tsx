'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, Task } from '@/lib/types';

interface AttentionItem {
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function NeedsAttentionWidget() {
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

        const errorAgents = agents.filter(a => a.status === 'offline');
        for (const agent of errorAgents.slice(0, 2)) {
          attention.push({
            message: `${agent.name} is offline`,
            severity: 'error',
          });
        }

        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const stuckTasks = tasks.filter(t =>
          t.status === 'in_progress' && new Date(t.updated_at).getTime() < twoHoursAgo
        );
        for (const task of stuckTasks.slice(0, 2)) {
          attention.push({
            message: `"${task.title}" stuck for ${formatDistanceToNow(new Date(task.updated_at))}`,
            severity: 'warning',
          });
        }

        const reviewTasks = tasks.filter(t => t.status === 'review');
        if (reviewTasks.length > 0) {
          attention.push({
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

  const dotColor: Record<string, string> = {
    error: 'bg-red-400',
    warning: 'bg-amber-400',
    info: 'bg-white/30',
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-48 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-4 w-36 bg-white/[0.04] rounded animate-pulse" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-[13px] text-white/30">Nothing needs your attention</div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[item.severity]}`} />
          <span className="text-[13px] text-white/60 truncate">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
