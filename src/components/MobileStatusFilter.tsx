'use client';

import type { TaskStatus } from '@/lib/types';

const STATUS_CONFIG: { id: TaskStatus; label: string; color: string; activeBg: string }[] = [
  { id: 'planning', label: 'PLANNING', color: 'text-mc-accent-purple', activeBg: 'bg-mc-accent-purple/20 border-mc-accent-purple' },
  { id: 'inbox', label: 'INBOX', color: 'text-mc-accent-pink', activeBg: 'bg-mc-accent-pink/20 border-mc-accent-pink' },
  { id: 'assigned', label: 'ASSIGNED', color: 'text-mc-accent-yellow', activeBg: 'bg-mc-accent-yellow/20 border-mc-accent-yellow' },
  { id: 'in_progress', label: 'IN PROGRESS', color: 'text-mc-accent', activeBg: 'bg-mc-accent/20 border-mc-accent' },
  { id: 'testing', label: 'TESTING', color: 'text-mc-accent-cyan', activeBg: 'bg-mc-accent-cyan/20 border-mc-accent-cyan' },
  { id: 'review', label: 'REVIEW', color: 'text-mc-accent-purple', activeBg: 'bg-mc-accent-purple/20 border-mc-accent-purple' },
  { id: 'done', label: 'DONE', color: 'text-mc-accent-green', activeBg: 'bg-mc-accent-green/20 border-mc-accent-green' },
];

interface MobileStatusFilterProps {
  activeStatus: TaskStatus;
  counts: Record<TaskStatus, number>;
  onChange: (status: TaskStatus) => void;
}

export function MobileStatusFilter({ activeStatus, counts, onChange }: MobileStatusFilterProps) {
  return (
    <div className="flex overflow-x-auto gap-2 p-3 border-b border-mc-border snap-x snap-mandatory scrollbar-hide">
      {STATUS_CONFIG.map((status) => {
        const isActive = activeStatus === status.id;
        const count = counts[status.id] || 0;
        return (
          <button
            key={status.id}
            onClick={() => onChange(status.id)}
            className={`snap-start flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium uppercase tracking-wider transition-colors ${
              isActive
                ? status.activeBg
                : 'border-mc-border/50 text-mc-text-secondary hover:border-mc-border'
            }`}
          >
            <span className={isActive ? status.color : ''}>{status.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              isActive ? 'bg-white/10' : 'bg-mc-bg-tertiary'
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
