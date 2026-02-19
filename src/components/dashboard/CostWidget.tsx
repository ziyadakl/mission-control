'use client';

import { useState, useEffect } from 'react';

interface StatsData {
  todayCost: number;
  weekCost: number;
  weekTokens: number;
  daily: { date: string; cost: number }[];
}

export function CostWidget() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) setStats(await res.json());
      } catch {}
    };
    loadStats();
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <div className="text-mc-text-secondary text-sm">Loading...</div>;
  }

  const maxCost = Math.max(...stats.daily.map(d => d.cost), 0.01);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-bold text-mc-accent-green">${stats.todayCost.toFixed(2)}</div>
        <div className="text-[10px] text-mc-text-secondary uppercase">Today</div>
      </div>
      <div>
        <div className="text-sm font-bold">${stats.weekCost.toFixed(2)}</div>
        <div className="text-[10px] text-mc-text-secondary uppercase">This Week</div>
      </div>

      {/* Sparkline */}
      {stats.daily.length > 0 && (
        <svg className="w-full h-6" viewBox={`0 0 ${stats.daily.length * 10} 24`}>
          {stats.daily.map((d, i) => {
            const h = (d.cost / maxCost) * 20;
            return (
              <rect
                key={d.date}
                x={i * 10 + 1}
                y={22 - h}
                width={8}
                height={Math.max(h, 1)}
                rx={1}
                className="fill-mc-accent/60"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
