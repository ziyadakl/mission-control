'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceStats } from '@/lib/types';

export function WorkspacesWidget() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workspaces?stats=true')
      .then(res => res.ok ? res.json() : [])
      .then(setWorkspaces)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2">
            <div className="h-4 w-24 bg-mc-bg-tertiary rounded animate-pulse" />
            <div className="h-3 w-12 bg-mc-bg-tertiary rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

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
