'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, Task } from '@/lib/types';

interface AttentionItem {
  icon: React.ReactNode;
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

        // 1. Agents with offline status
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
