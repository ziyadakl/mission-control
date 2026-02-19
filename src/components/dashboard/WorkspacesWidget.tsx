'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceStats } from '@/lib/types';

export function WorkspacesWidget() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceStats[]>([]);

  useEffect(() => {
    fetch('/api/workspaces?stats=true')
      .then(res => res.ok ? res.json() : [])
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-2">
      {workspaces.slice(0, 5).map(ws => (
        <button
          key={ws.id}
          onClick={() => router.push(`/?workspace=${ws.slug}`)}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-mc-bg-tertiary transition-colors text-left"
        >
          <span className="text-sm truncate">{ws.name}</span>
          <span className="text-[10px] font-mono text-mc-text-secondary">
            {ws.taskCounts.total - ws.taskCounts.done} active
          </span>
        </button>
      ))}
      {workspaces.length === 0 && (
        <div className="text-mc-text-secondary text-sm">No workspaces</div>
      )}
    </div>
  );
}
