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
    return (
      <div>
        <div className="flex gap-3 mb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-16 bg-mc-bg-tertiary rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 w-full bg-mc-bg-tertiary rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
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
