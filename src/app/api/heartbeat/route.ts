import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getMissionControlUrl } from '@/lib/config';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const STALE_MINUTES = 30;
const MAX_ACTIONS_PER_RUN = 5;

interface HeartbeatAction {
  taskId: string;
  taskTitle: string;
  action: 'dispatch' | 'test' | 'skipped' | 'stuck';
  reason: string;
  success?: boolean;
  error?: string;
}

interface HeartbeatResult {
  runAt: string;
  durationMs: number;
  tasksFound: number;
  tasksProcessed: number;
  actions: HeartbeatAction[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const runAt = new Date().toISOString();
  const actions: HeartbeatAction[] = [];

  logger.info('heartbeat.run', { runAt });

  try {
    const supabase = getSupabase();
    const baseUrl = getMissionControlUrl();

    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = process.env.MC_API_TOKEN;
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_agent_id, updated_at')
      .in('status', ['testing', 'inbox', 'assigned', 'in_progress'])
      .order('updated_at', { ascending: true });

    if (tasksError) {
      logger.error('heartbeat.query_failed', { error: tasksError.message });
      return NextResponse.json({ error: 'Failed to query tasks' }, { status: 500 });
    }

    const allTasks = tasks || [];
    console.log(`[Heartbeat] Found ${allTasks.length} active task(s)`);

    const testingTasks = allTasks.filter(t => t.status === 'testing');
    const dispatchableTasks = allTasks.filter(
      t => (t.status === 'inbox' || t.status === 'assigned') && t.assigned_agent_id
    );
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress');

    let actionsRemaining = MAX_ACTIONS_PER_RUN;

    // Process testing tasks
    for (const task of testingTasks) {
      if (actionsRemaining <= 0) break;

      console.log(`[Heartbeat] Testing task ${task.id} "${task.title}"`);

      try {
        const res = await fetch(`${baseUrl}/api/tasks/${task.id}/test`, {
          method: 'POST',
          headers: authHeaders,
        });

        const success = res.ok;
        const action: HeartbeatAction = {
          taskId: task.id,
          taskTitle: task.title,
          action: 'test',
          reason: 'Task is in testing status',
          success,
        };

        if (!success) {
          action.error = `HTTP ${res.status}`;
          console.warn(`[Heartbeat] Test failed for task ${task.id}: HTTP ${res.status}`);
        } else {
          console.log(`[Heartbeat] Test triggered for task ${task.id}`);
        }

        actions.push(action);
        actionsRemaining--;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Heartbeat] Error testing task ${task.id}:`, errMsg);
        actions.push({
          taskId: task.id,
          taskTitle: task.title,
          action: 'test',
          reason: 'Task is in testing status',
          success: false,
          error: errMsg,
        });
        actionsRemaining--;
      }
    }

    // Batch-fetch active sessions for all agents that have dispatchable tasks (avoids N+1)
    const agentIds = Array.from(new Set(dispatchableTasks.map(t => t.assigned_agent_id).filter(Boolean)));
    const sessionByAgent = new Map<string, { id: string; openclaw_session_id: string }>();

    if (agentIds.length > 0) {
      const { data: activeSessions } = await supabase
        .from('openclaw_sessions')
        .select('id, openclaw_session_id, agent_id')
        .in('agent_id', agentIds)
        .eq('status', 'active');

      for (const session of activeSessions ?? []) {
        // Keep only the first (most recent) session per agent if duplicates exist
        if (!sessionByAgent.has(session.agent_id)) {
          sessionByAgent.set(session.agent_id, { id: session.id, openclaw_session_id: session.openclaw_session_id });
        }
      }
    }

    // Process inbox/assigned tasks with an assigned agent
    for (const task of dispatchableTasks) {
      if (actionsRemaining <= 0) break;

      const activeSession = sessionByAgent.get(task.assigned_agent_id) ?? null;

      if (activeSession) {
        // Task is inbox/assigned but agent has an "active" session — session is orphaned.
        // Clean it up so we can re-dispatch.
        console.warn(
          `[Heartbeat] Task ${task.id} "${task.title}" is ${task.status} but agent has stale session ${activeSession.openclaw_session_id} — cleaning up`
        );
        await supabase
          .from('openclaw_sessions')
          .delete()
          .eq('id', activeSession.id);
        sessionByAgent.delete(task.assigned_agent_id);
        // Fall through to dispatch below
      }

      console.log(`[Heartbeat] Dispatching task ${task.id} "${task.title}" (status: ${task.status})`);

      try {
        const res = await fetch(`${baseUrl}/api/tasks/${task.id}/dispatch`, {
          method: 'POST',
          headers: authHeaders,
        });

        const success = res.ok;
        const action: HeartbeatAction = {
          taskId: task.id,
          taskTitle: task.title,
          action: 'dispatch',
          reason: `Task is ${task.status} with assigned agent, no active session`,
          success,
        };

        if (!success) {
          action.error = `HTTP ${res.status}`;
          console.warn(`[Heartbeat] Dispatch failed for task ${task.id}: HTTP ${res.status}`);
        } else {
          console.log(`[Heartbeat] Dispatch triggered for task ${task.id}`);
        }

        actions.push(action);
        actionsRemaining--;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Heartbeat] Error dispatching task ${task.id}:`, errMsg);
        actions.push({
          taskId: task.id,
          taskTitle: task.title,
          action: 'dispatch',
          reason: `Task is ${task.status} with assigned agent, no active session`,
          success: false,
          error: errMsg,
        });
        actionsRemaining--;
      }
    }

    // Check in_progress tasks for staleness
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

    // Batch-fetch latest activity timestamps for all in_progress tasks (avoids N+1)
    const inProgressTaskIds = inProgressTasks.map(t => t.id);
    const lastActivityByTask = new Map<string, string>();

    if (inProgressTaskIds.length > 0) {
      const { data: recentActivities } = await supabase
        .from('task_activities')
        .select('task_id, created_at')
        .in('task_id', inProgressTaskIds)
        .order('created_at', { ascending: false });

      // Results are ordered desc; first occurrence of each task_id is its latest activity
      for (const activity of recentActivities ?? []) {
        if (!lastActivityByTask.has(activity.task_id)) {
          lastActivityByTask.set(activity.task_id, activity.created_at);
        }
      }
    }

    for (const task of inProgressTasks) {
      const lastActiveAt = lastActivityByTask.get(task.id) ?? task.updated_at;
      const isStale = lastActiveAt < staleThreshold;

      if (isStale) {
        const minutesAgo = Math.round(
          (Date.now() - new Date(lastActiveAt).getTime()) / 60000
        );
        console.warn(
          `[Heartbeat] Task ${task.id} "${task.title}" appears stuck — last activity ${minutesAgo} minutes ago`
        );

        // Set alert_reason on the task so UI surfaces it (only if not already set)
        const alertMsg = `No activity for ${minutesAgo} minutes — agent may be stuck or unresponsive.`;
        const { error: alertError } = await supabase
          .from('tasks')
          .update({ alert_reason: alertMsg })
          .eq('id', task.id)
          .is('alert_reason', null);  // only set if not already alerted

        if (alertError) {
          console.error(`[Heartbeat] Failed to set alert on task ${task.id}:`, alertError.message);
        }

        actions.push({
          taskId: task.id,
          taskTitle: task.title,
          action: 'stuck',
          reason: `No activity for ${minutesAgo} minutes (threshold: ${STALE_MINUTES} min) — alert set on task`,
        });
      }
    }

    const result: HeartbeatResult = {
      runAt,
      durationMs: Date.now() - startTime,
      tasksFound: allTasks.length,
      tasksProcessed: actions.length,
      actions,
    };

    logger.info('heartbeat.complete', { durationMs: result.durationMs, tasksProcessed: result.tasksProcessed });

    return NextResponse.json(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Heartbeat] Unhandled error:', errMsg);
    return NextResponse.json(
      {
        runAt,
        durationMs: Date.now() - startTime,
        error: errMsg,
      },
      { status: 500 }
    );
  }
}
