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
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2.5">
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-3 w-8 bg-white/[0.04] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {workspaces.slice(0, 5).map(ws => (
        <button
          key={ws.id}
          onClick={() => router.push(`/?workspace=${ws.slug}`)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors duration-200 text-left"
        >
          <span className="text-[13px] text-white/70 truncate">{ws.name}</span>
          <span className="text-[11px] text-white/25 tabular-nums">
            {ws.taskCounts.total - ws.taskCounts.done}
          </span>
        </button>
      ))}
      {workspaces.length === 0 && (
        <div className="text-[13px] text-white/30 p-2.5">No workspaces</div>
      )}
    </div>
  );
}
