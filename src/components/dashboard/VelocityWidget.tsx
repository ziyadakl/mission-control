'use client';

import { useState, useEffect } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import type { Event } from '@/lib/types';

export function VelocityWidget() {
  const [dailyCounts, setDailyCounts] = useState<{ day: string; label: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVelocity = async () => {
      try {
        const res = await fetch('/api/events?limit=200');
        if (!res.ok) return;
        const events: Event[] = await res.json();

        const days: { day: string; label: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = startOfDay(subDays(new Date(), i));
          days.push({
            day: format(date, 'yyyy-MM-dd'),
            label: format(date, 'EEE'),
            count: 0,
          });
        }

        for (const event of events) {
          if (event.type !== 'task_completed') continue;
          const eventDay = format(new Date(event.created_at), 'yyyy-MM-dd');
          const match = days.find(d => d.day === eventDay);
          if (match) match.count++;
        }

        setDailyCounts(days);
      } catch {}
      setLoading(false);
    };

    loadVelocity();
  }, []);

  if (loading) {
    return (
      <div className="flex items-end justify-between gap-3 h-28">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full bg-white/[0.04] rounded-md flex-1 animate-pulse" />
            <div className="h-2 w-5 bg-white/[0.04] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);

  return (
    <div className="flex items-end justify-between gap-3 h-28">
      {dailyCounts.map((day, i) => {
        const heightPct = (day.count / maxCount) * 100;
        const isToday = i === dailyCounts.length - 1;

        return (
          <div key={day.day} className="flex-1 flex flex-col items-center gap-1.5 group">
            <span className="text-[11px] tabular-nums text-white/0 group-hover:text-white/40 transition-colors duration-200">
              {day.count}
            </span>
            <div className="w-full bg-white/[0.04] rounded-md flex-1 relative overflow-hidden">
              <div
                className={`absolute bottom-0 w-full rounded-md transition-all duration-500 ${
                  isToday ? 'bg-white/30' : 'bg-white/15'
                }`}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
              />
            </div>
            <span className={`text-[11px] tracking-wider ${isToday ? 'text-white/50' : 'text-white/20'}`}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
