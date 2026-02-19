'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
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
        <div className="flex gap-6 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-5 w-8 bg-white/[0.04] rounded animate-pulse" />
              <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-full bg-white/[0.04] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentEvents = events.filter(e => new Date(e.created_at).getTime() > dayAgo);

  const completed = recentEvents.filter(e => e.type === 'task_completed').length;
  const created = recentEvents.filter(e => e.type === 'task_created').length;
  const assigned = recentEvents.filter(e => e.type === 'task_assigned').length;
  const errors = recentEvents.filter(e => e.type === 'system' && e.message.toLowerCase().includes('error')).length;

  const stats = [
    { label: 'Done', value: completed },
    { label: 'Created', value: created },
    { label: 'Dispatched', value: assigned },
    { label: 'Errors', value: errors },
  ];

  return (
    <div>
      <div className="flex gap-6 mb-4">
        {stats.map(s => (
          <div key={s.label}>
            <div className="text-lg font-light tabular-nums">{s.value}</div>
            <div className="text-[11px] uppercase tracking-widest text-white/30">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2 max-h-28 overflow-y-auto">
        {events.slice(0, 6).map(event => (
          <div key={event.id} className="flex items-baseline gap-3 text-[13px]">
            <span className="text-white/20 flex-shrink-0 text-[11px] tabular-nums">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </span>
            <span className="text-white/50 truncate">{event.message}</span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-[13px] text-white/30">No recent activity</div>
        )}
      </div>
    </div>
  );
}
