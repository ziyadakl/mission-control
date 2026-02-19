'use client';

import { useMissionControl } from '@/lib/store';
import type { TaskStatus } from '@/lib/types';

const STATUSES: TaskStatus[] = [
  'planning',
  'inbox',
  'assigned',
  'in_progress',
  'testing',
  'review',
  'done',
];

const STATUS_BG: Record<TaskStatus, string> = {
  planning: 'bg-mc-accent-purple',
  inbox: 'bg-mc-accent-pink',
  assigned: 'bg-mc-accent-yellow',
  in_progress: 'bg-mc-accent',
  testing: 'bg-mc-accent-cyan',
  review: 'bg-mc-accent-purple',
  done: 'bg-mc-accent-green',
};

const ACTIVE_STATUSES = new Set<TaskStatus>([
  'planning',
  'inbox',
  'assigned',
  'in_progress',
  'testing',
  'review',
]);

export function StatsTray() {
  const { tasks, agents } = useMissionControl();

  // --- Left: Status Breakdown ---
  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length])
  ) as Record<TaskStatus, number>;

  const maxCount = Math.max(...Object.values(statusCounts), 1);

  // --- Right: Agent Workload ---
  const agentStats = agents
    .map((agent) => {
      const agentTasks = tasks.filter((t) => t.assigned_agent_id === agent.id);
      const active = agentTasks.filter((t) => ACTIVE_STATUSES.has(t.status)).length;
      const done = agentTasks.filter((t) => t.status === 'done').length;
      return { agent, active, done };
    })
    .filter(({ active, done }) => active > 0 || done > 0)
    .sort((a, b) => b.active - a.active)
    .slice(0, 5);

  return (
    <div className="bg-mc-bg-secondary border-b border-mc-border px-4 py-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {/* Left: Status Breakdown */}
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-mc-text-secondary mb-2">
            Status Breakdown
          </h3>
          <div className="space-y-1.5">
            {STATUSES.map((status) => {
              const count = statusCounts[status];
              const widthPct = (count / maxCount) * 100;
              const label = status.replace(/_/g, ' ');
              return (
                <div key={status} className="flex items-center gap-2">
                  {/* Status label */}
                  <span className="text-xs font-mono text-mc-text-secondary uppercase w-24 flex-shrink-0 truncate">
                    {label}
                  </span>
                  {/* Bar track */}
                  <div className="flex-1 bg-mc-bg-tertiary rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${STATUS_BG[status]}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  {/* Count */}
                  <span className="text-xs font-mono text-mc-text-secondary w-4 text-right flex-shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Agent Workload */}
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-mc-text-secondary mb-2">
            Agent Workload
          </h3>
          {agentStats.length === 0 ? (
            <p className="text-xs font-mono text-mc-text-secondary/50">No active agents</p>
          ) : (
            <div className="space-y-1.5">
              {agentStats.map(({ agent, active, done }) => (
                <div key={agent.id} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-mc-bg-tertiary border border-mc-border/50 flex items-center justify-center text-[9px] font-bold text-mc-accent uppercase flex-shrink-0">{agent.name.slice(0, 2)}</span>
                  <span className="text-xs font-mono text-mc-text truncate flex-1">
                    {agent.name}
                  </span>
                  <span className="text-xs font-mono text-mc-accent font-bold flex-shrink-0">
                    {active}
                  </span>
                  <span className="text-xs font-mono text-mc-text-secondary flex-shrink-0">/</span>
                  <span className="text-xs font-mono text-mc-accent-green flex-shrink-0">
                    {done}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
