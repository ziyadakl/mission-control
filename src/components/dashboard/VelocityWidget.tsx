'use client';

import { useState, useEffect } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import type { Event } from '@/lib/types';

export function VelocityWidget() {
  const [dailyCounts, setDailyCounts] = useState<{ day: string; label: string; count: number }[]>([]);

  useEffect(() => {
    const loadVelocity = async () => {
      try {
        const res = await fetch('/api/events?limit=200');
        if (!res.ok) return;
        const events: Event[] = await res.json();

        // Build last 7 days
        const days: { day: string; label: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = startOfDay(subDays(new Date(), i));
          days.push({
            day: format(date, 'yyyy-MM-dd'),
            label: format(date, 'EEE'),
            count: 0,
          });
        }

        // Count task_completed events per day
        for (const event of events) {
          if (event.type !== 'task_completed') continue;
          const eventDay = format(new Date(event.created_at), 'yyyy-MM-dd');
          const match = days.find(d => d.day === eventDay);
          if (match) match.count++;
        }

        setDailyCounts(days);
      } catch {}
    };

    loadVelocity();
  }, []);

  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-28">
      {dailyCounts.map((day, i) => {
        const heightPct = (day.count / maxCount) * 100;
        const isToday = i === dailyCounts.length - 1;

        return (
          <div key={day.day} className="flex-1 flex flex-col items-center gap-1 group">
            {/* Count tooltip on hover */}
            <span className="text-[10px] font-mono text-mc-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
              {day.count}
            </span>
            {/* Bar with gradient fade + glow on today */}
            <div className="w-full bg-mc-bg-tertiary rounded-t flex-1 relative">
              <div
                className={`absolute bottom-0 w-full rounded-t transition-all duration-300 ${
                  isToday ? 'bg-gradient-to-t from-mc-accent to-mc-accent/30' : 'bg-gradient-to-t from-mc-accent/50 to-mc-accent/10'
                }`}
                style={{
                  height: `${Math.max(heightPct, 4)}%`,
                  ...(isToday && day.count > 0 ? { boxShadow: '0 0 8px rgba(88, 166, 255, 0.4)' } : {}),
                }}
              />
            </div>
            {/* Day label */}
            <span className={`text-[10px] font-mono ${isToday ? 'text-mc-accent font-bold' : 'text-mc-text-secondary'}`}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
