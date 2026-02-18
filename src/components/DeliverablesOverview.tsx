/**
 * DeliverablesOverview Component
 * Collapsible panel showing the last 15 deliverables across a workspace.
 * Sits between the MissionQueue header bar and the Kanban columns.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { FileText, Link2, Package, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { TaskDeliverable, Task } from '@/lib/types';

// The API returns deliverables with a nested task join object
interface DeliverableWithTask extends TaskDeliverable {
  task: Pick<Task, 'id' | 'title' | 'status' | 'workspace_id'>;
}

interface DeliverablesOverviewProps {
  workspaceId: string;
}

export function DeliverablesOverview({ workspaceId }: DeliverablesOverviewProps) {
  const [deliverables, setDeliverables] = useState<DeliverableWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDeliverables = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/deliverables?workspace_id=${workspaceId}&limit=15`
      );
      if (res.ok) {
        const data = await res.json();
        setDeliverables(data);
      }
    } catch (error) {
      console.error('Failed to load deliverables overview:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Fetch on mount, then refetch every 30 seconds
  useEffect(() => {
    fetchDeliverables();

    intervalRef.current = setInterval(fetchDeliverables, 30_000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchDeliverables]);

  if (loading) {
    return (
      <div className="max-h-[200px] border-b border-mc-border bg-mc-bg-secondary flex items-center justify-center py-4">
        <span className="text-sm text-mc-text-secondary">Loading deliverables...</span>
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div className="max-h-[200px] border-b border-mc-border bg-mc-bg-secondary flex items-center justify-center py-4">
        <span className="text-sm text-mc-text-secondary">No deliverables yet</span>
      </div>
    );
  }

  return (
    <div className="max-h-[200px] overflow-y-auto border-b border-mc-border bg-mc-bg-secondary">
      {deliverables.map((deliverable) => {
        const isUrl = deliverable.deliverable_type === 'url';
        const isFile = deliverable.deliverable_type === 'file';

        return (
          <div
            key={deliverable.id}
            className={`group flex items-center gap-3 px-4 py-2 hover:bg-mc-bg-tertiary border-b border-mc-border/30 last:border-b-0 ${isFile ? 'cursor-default' : ''}`}
            title={isFile && deliverable.path ? deliverable.path : undefined}
          >
            {/* Type icon */}
            {isFile && (
              <FileText className="w-4 h-4 text-mc-accent-cyan flex-shrink-0" />
            )}
            {isUrl && (
              <Link2 className="w-4 h-4 text-mc-accent flex-shrink-0" />
            )}
            {deliverable.deliverable_type === 'artifact' && (
              <Package className="w-4 h-4 text-mc-accent-purple flex-shrink-0" />
            )}

            {/* Title + task name */}
            <div className="flex-1 min-w-0">
              <span className="text-sm truncate block">{deliverable.title}</span>
              <span className="text-[10px] text-mc-text-secondary truncate block">
                from: {deliverable.task.title}
              </span>
            </div>

            {/* Relative timestamp */}
            <span className="text-[10px] text-mc-text-secondary/60 flex-shrink-0 whitespace-nowrap">
              {formatDistanceToNow(new Date(deliverable.created_at), {
                addSuffix: true,
              })}
            </span>

            {/* External link icon for URLs — visible on row hover */}
            {isUrl && deliverable.path && (
              <a
                href={deliverable.path}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3 text-mc-text-secondary" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
