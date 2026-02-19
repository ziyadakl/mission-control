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
    return (
      <div className="space-y-4">
        <div>
          <div className="h-8 w-20 bg-white/[0.04] rounded-lg animate-pulse" />
          <div className="h-3 w-10 bg-white/[0.04] rounded animate-pulse mt-2" />
        </div>
        <div>
          <div className="h-5 w-16 bg-white/[0.04] rounded animate-pulse" />
          <div className="h-3 w-10 bg-white/[0.04] rounded animate-pulse mt-2" />
        </div>
      </div>
    );
  }

  const maxCost = Math.max(...stats.daily.map(d => d.cost), 0.01);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-3xl font-light tracking-tight">${stats.todayCost.toFixed(2)}</div>
        <div className="text-[11px] uppercase tracking-widest text-white/30 mt-1">Today</div>
      </div>
      <div>
        <div className="text-lg font-light tracking-tight text-white/60">${stats.weekCost.toFixed(2)}</div>
        <div className="text-[11px] uppercase tracking-widest text-white/30 mt-1">This week</div>
      </div>

      {stats.daily.length > 0 && (
        <svg className="w-full h-5" viewBox={`0 0 ${stats.daily.length * 10} 20`}>
          {stats.daily.map((d, i) => {
            const h = (d.cost / maxCost) * 16;
            return (
              <rect
                key={d.date}
                x={i * 10 + 1}
                y={18 - h}
                width={8}
                height={Math.max(h, 1)}
                rx={2}
                className="fill-white/15"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
