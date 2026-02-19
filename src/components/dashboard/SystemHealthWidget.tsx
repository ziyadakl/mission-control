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
      color: health.gatewayConnected ? 'text-mc-accent-green' : 'text-mc-accent-red',
      dot: health.gatewayConnected ? 'bg-mc-accent-green' : 'bg-mc-accent-red',
    },
    {
      label: 'Sessions',
      value: String(health.sessionCount),
      color: 'text-mc-text',
      dot: health.sessionCount > 0 ? 'bg-mc-accent-cyan' : 'bg-mc-text-secondary',
    },
    {
      label: 'Heartbeat',
      value: health.lastHeartbeat
        ? formatDistanceToNow(new Date(health.lastHeartbeat), { addSuffix: true })
        : 'Unknown',
      color: health.heartbeatOk ? 'text-mc-accent-green' : 'text-mc-accent-yellow',
      dot: health.heartbeatOk ? 'bg-mc-accent-green' : 'bg-mc-accent-yellow',
    },
  ];

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${item.dot}`} />
            <span className="text-xs text-mc-text-secondary">{item.label}</span>
          </div>
          <span className={`text-xs font-medium ${item.color}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
