'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface HealthStatus {
  gatewayConnected: boolean;
  sessionCount: number;
  lastHeartbeat: string | null;
  heartbeatOk: boolean;
}

export function SystemHealthWidget() {
  const [health, setHealth] = useState<HealthStatus>({
    gatewayConnected: false,
    sessionCount: 0,
    lastHeartbeat: null,
    heartbeatOk: false,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const [statusRes, heartbeatRes] = await Promise.all([
          fetch('/api/openclaw/status').catch(() => null),
          fetch('/api/heartbeat').catch(() => null),
        ]);

        const status = statusRes?.ok ? await statusRes.json() : null;
        const heartbeat = heartbeatRes?.ok ? await heartbeatRes.json() : null;

        setHealth({
          gatewayConnected: status?.connected ?? false,
          sessionCount: status?.sessions_count ?? 0,
          lastHeartbeat: heartbeat?.runAt ?? null,
          heartbeatOk: heartbeat && !heartbeat.error,
        });
      } catch {}
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    {
      label: 'Gateway',
      value: health.gatewayConnected ? 'Connected' : 'Disconnected',
      dot: health.gatewayConnected ? 'bg-emerald-400' : 'bg-red-400',
    },
    {
      label: 'Sessions',
      value: String(health.sessionCount),
      dot: health.sessionCount > 0 ? 'bg-white/60' : 'bg-white/20',
    },
    {
      label: 'Heartbeat',
      value: health.lastHeartbeat
        ? formatDistanceToNow(new Date(health.lastHeartbeat), { addSuffix: true })
        : 'Unknown',
      dot: health.heartbeatOk ? 'bg-emerald-400' : 'bg-amber-400',
    },
  ];

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
            <span className="text-[11px] text-white/30 uppercase tracking-widest">{item.label}</span>
          </div>
          <span className="text-[13px] text-white/70">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
