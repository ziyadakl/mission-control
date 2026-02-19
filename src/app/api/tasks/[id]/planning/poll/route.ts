import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { extractJSON, getMessagesFromOpenClaw } from '@/lib/planning-utils';
import { Task } from '@/lib/types';
import { getMissionControlUrl } from '@/lib/config';

// Planning timeout and poll interval configuration with validation
const PLANNING_TIMEOUT_MS = parseInt(process.env.PLANNING_TIMEOUT_MS || '30000', 10);
const PLANNING_POLL_INTERVAL_MS = parseInt(process.env.PLANNING_POLL_INTERVAL_MS || '2000', 10);

// Validate environment variables
if (isNaN(PLANNING_TIMEOUT_MS) || PLANNING_TIMEOUT_MS < 1000) {
  throw new Error('PLANNING_TIMEOUT_MS must be a valid number >= 1000ms');
}
if (isNaN(PLANNING_POLL_INTERVAL_MS) || PLANNING_POLL_INTERVAL_MS < 100) {
  throw new Error('PLANNING_POLL_INTERVAL_MS must be a valid number >= 100ms');
}

// Helper to handle planning completion with proper error handling
async function handlePlanningCompletion(taskId: string, parsed: any, messages: any[]) {
  const supabase = getSupabase();
  let dispatchError: string | null = null;
  let firstAgentId: string | null = null;

  // Set status to 'pending_dispatch' first and save planning data
  // Don't mark as complete until dispatch succeeds
  const { error: initialUpdateError } = await supabase
    .from('tasks')
    .update({
      planning_messages: messages,
      planning_spec: parsed.spec,
      planning_agents: parsed.agents,
      status: 'pending_dispatch',
      planning_dispatch_error: null,
    })
    .eq('id', taskId);

  if (initialUpdateError) {
    console.error('[Planning Poll] Failed to update task to pending_dispatch:', initialUpdateError);
  }

  // Create the agents in the workspace and track first agent for auto-assign
  if (parsed.agents && parsed.agents.length > 0) {
    // Get workspace_id for the task
    const { data: taskRow } = await supabase
      .from('tasks')
      .select('workspace_id')
      .eq('id', taskId)
      .maybeSingle();

    if (taskRow?.workspace_id) {
      for (const agent of parsed.agents) {
        const agentId = crypto.randomUUID();
        if (!firstAgentId) firstAgentId = agentId;

        const { error: agentError } = await supabase
          .from('agents')
          .insert({
            id: agentId,
            workspace_id: taskRow.workspace_id,
            name: agent.name,
            role: agent.role,
            description: agent.instructions || '',
            avatar_emoji: agent.avatar_emoji || '🤖',
            status: 'standby',
            soul_md: agent.soul_md || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (agentError) {
          console.error('[Planning Poll] Failed to create agent:', agent.name, agentError);
        }
      }
    }
  }

  // Re-check for other orchestrators before dispatching (prevents race condition)
  if (firstAgentId) {
    const { data: taskRow } = await supabase
      .from('tasks')
      .select('workspace_id')
      .eq('id', taskId)
      .maybeSingle();

    if (taskRow?.workspace_id) {
      const { data: defaultMaster } = await supabase
        .from('agents')
        .select('id')
        .eq('is_master', true)
        .eq('workspace_id', taskRow.workspace_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: otherOrchestrators } = await supabase
        .from('agents')
        .select('id, name')
        .eq('is_master', true)
        .eq('workspace_id', taskRow.workspace_id)
        .neq('id', defaultMaster?.id ?? '')
        .neq('status', 'offline');

      if (otherOrchestrators && otherOrchestrators.length > 0) {
        dispatchError = `Cannot auto-dispatch: ${otherOrchestrators.length} other orchestrator(s) available in workspace`;
        console.warn(`[Planning Poll] ${dispatchError}:`, otherOrchestrators.map((o: any) => o.name).join(', '));
        firstAgentId = null; // Don't dispatch
      }
    }
  }

  // Check if task is already assigned (idempotency - prevents duplicate dispatches from multiple polls)
  let skipDispatch = false;
  if (firstAgentId) {
    const { data: currentTask } = await supabase
      .from('tasks')
      .select('assigned_agent_id')
      .eq('id', taskId)
      .maybeSingle();

    if (currentTask?.assigned_agent_id) {
      console.log('[Planning Poll] Task already assigned to', currentTask.assigned_agent_id, ', skipping dispatch');
      firstAgentId = currentTask.assigned_agent_id;
      dispatchError = null;
      skipDispatch = true; // Skip the HTTP dispatch call, but still mark as complete
    }
  }

  // Trigger dispatch - use getMissionControlUrl so MISSION_CONTROL_URL env var is respected
  if (firstAgentId && !skipDispatch) {
    const baseUrl = getMissionControlUrl();
    const dispatchUrl = `${baseUrl}/api/tasks/${taskId}/dispatch`;
    console.log(`[Planning Poll] Triggering dispatch: ${dispatchUrl}`);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (process.env.MC_API_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.MC_API_TOKEN}`;
      }

      const dispatchRes = await fetch(dispatchUrl, {
        method: 'POST',
        headers,
      });

      if (dispatchRes.ok) {
        const dispatchData = await dispatchRes.json();
        console.log(`[Planning Poll] Dispatch successful:`, dispatchData);
      } else {
        const errorText = await dispatchRes.text();
        dispatchError = `Dispatch failed (${dispatchRes.status}): ${errorText}`;
        console.error(`[Planning Poll] ${dispatchError}`);
      }
    } catch (err) {
      dispatchError = `Dispatch error: ${(err as Error).message}`;
      console.error(`[Planning Poll] ${dispatchError}`);
    }
  }

  // Final update: mark as complete or store error for retry
  if (dispatchError) {
    // Store the error but don't mark as complete - user can retry
    await supabase
      .from('tasks')
      .update({
        planning_dispatch_error: dispatchError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  } else if (firstAgentId) {
    // Success - mark complete and assign
    await supabase
      .from('tasks')
      .update({
        planning_complete: true,
        assigned_agent_id: firstAgentId,
        status: 'inbox',
        planning_dispatch_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    console.log(`[Planning Poll] Planning complete and dispatched to agent ${firstAgentId}`);
  } else {
    // No agent to dispatch to, but planning is complete
    await supabase
      .from('tasks')
      .update({
        planning_complete: true,
        status: 'inbox',
        planning_dispatch_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }

  // Broadcast task update
  const { data: updatedTask } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (updatedTask) {
    broadcast({
      type: 'task_updated',
      payload: updatedTask as Task,
    });
  }

  return { firstAgentId, parsed, dispatchError };
}

// GET /api/tasks/[id]/planning/poll - Check for new messages from OpenClaw
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const supabase = getSupabase();

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, planning_session_key, planning_messages, planning_complete, planning_dispatch_error')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to poll for updates' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.planning_session_key) {
      return NextResponse.json({ hasUpdates: false, isComplete: false, messages: [] });
    }

    if (task.planning_complete) {
      return NextResponse.json({ hasUpdates: false, isComplete: true });
    }

    // Return dispatch error if present (allows user to see / retry failed dispatch)
    if (task.planning_dispatch_error) {
      return NextResponse.json({
        hasUpdates: true,
        dispatchError: task.planning_dispatch_error,
      });
    }

    // planning_messages is JSONB - already parsed by Supabase
    const messages: any[] = Array.isArray(task.planning_messages) ? task.planning_messages : [];
    // Count only assistant messages for comparison, since OpenClaw only returns assistant messages
    const initialAssistantCount = messages.filter((m: any) => m.role === 'assistant').length;

    console.log('[Planning Poll] Task', taskId, 'has', messages.length, 'total messages,', initialAssistantCount, 'assistant messages');

    // Check OpenClaw for new messages (lightweight check, not a loop)
    const openclawMessages = await getMessagesFromOpenClaw(task.planning_session_key);

    console.log('[Planning Poll] Comparison: stored_assistant=', initialAssistantCount, 'openclaw_assistant=', openclawMessages.length);

    if (openclawMessages.length > initialAssistantCount) {
      let currentQuestion = null;
      const newMessages = openclawMessages.slice(initialAssistantCount);
      console.log('[Planning Poll] Processing', newMessages.length, 'new messages');

      // Find new assistant messages
      for (const msg of newMessages) {
        console.log('[Planning Poll] Processing new message, role:', msg.role, 'content length:', msg.content?.length || 0);

        if (msg.role === 'assistant') {
          const lastMessage = { role: 'assistant', content: msg.content, timestamp: Date.now() };
          messages.push(lastMessage);

          // Check if this message contains completion status or a question
          const parsed = extractJSON(msg.content) as {
            status?: string;
            question?: string;
            options?: Array<{ id: string; label: string }>;
            spec?: object;
            agents?: Array<{
              name: string;
              role: string;
              avatar_emoji?: string;
              soul_md?: string;
              instructions?: string;
            }>;
            execution_plan?: object;
          } | null;

          console.log('[Planning Poll] Parsed message content:', {
            hasStatus: !!parsed?.status,
            hasQuestion: !!parsed?.question,
            hasOptions: !!parsed?.options,
            status: parsed?.status,
            question: parsed?.question?.substring(0, 50),
            rawPreview: msg.content?.substring(0, 200)
          });

          if (parsed && parsed.status === 'complete') {
            // Handle completion
            console.log('[Planning Poll] Planning complete, handling...');
            const { firstAgentId, parsed: fullParsed, dispatchError } = await handlePlanningCompletion(taskId, parsed, messages);

            return NextResponse.json({
              hasUpdates: true,
              complete: true,
              spec: fullParsed.spec,
              agents: fullParsed.agents,
              executionPlan: fullParsed.execution_plan,
              messages,
              autoDispatched: !!firstAgentId,
              dispatchError,
            });
          }

          // Extract current question if present
          if (parsed && parsed.question && parsed.options) {
            console.log('[Planning Poll] Found question with', parsed.options.length, 'options');
            currentQuestion = parsed;
          }
        }
      }

      console.log('[Planning Poll] Returning updates: currentQuestion =', currentQuestion ? 'YES' : 'NO');

      // Update database - pass array directly (JSONB)
      await supabase
        .from('tasks')
        .update({ planning_messages: messages })
        .eq('id', taskId);

      return NextResponse.json({
        hasUpdates: true,
        complete: false,
        messages,
        currentQuestion,
      });
    }

    console.log('[Planning Poll] No new messages found');
    return NextResponse.json({ hasUpdates: false });
  } catch (error) {
    console.error('Failed to poll for updates:', error);
    return NextResponse.json({ error: 'Failed to poll for updates' }, { status: 500 });
  }
}
