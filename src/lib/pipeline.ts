import { getSupabase } from '@/lib/db';
import { getMissionControlUrl } from '@/lib/config';
import { broadcast } from '@/lib/events';
import { v4 as uuidv4 } from 'uuid';

export interface PipelineAdvanceResult {
  advanced: boolean;
  nextStage?: number;
  nextAgentId?: string;
  nextAgentName?: string;
  pipelineComplete?: boolean;
  error?: string;
}

/**
 * Advance a pipeline task to its next stage after the current agent completes.
 *
 * Returns { advanced: true, nextStage, nextAgentId } if progression happened,
 * { advanced: false, pipelineComplete: true } if final stage completed,
 * { advanced: false, error } if something went wrong,
 * { advanced: false } if not a pipeline task.
 */
export async function advancePipelineStage(
  taskId: string,
  completingAgentId?: string,
  completionSummary?: string
): Promise<PipelineAdvanceResult> {
  const supabase = getSupabase();

  // 1. Fetch the task with its template slug
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*, workflow_template:workflow_templates(id, slug, name)')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return { advanced: false, error: `Task not found: ${taskError?.message}` };
  }

  // Not a pipeline task
  if (!task.workflow_template_id) {
    return { advanced: false };
  }

  // 2. Idempotency: if the completing agent doesn't match the current assignment,
  //    this task already advanced past this agent. Skip.
  if (completingAgentId && task.assigned_agent_id !== completingAgentId) {
    console.log(`[Pipeline] Task ${taskId} already advanced past agent ${completingAgentId}. Skipping.`);
    return { advanced: false };
  }

  // 3. Get all roles for this template, ordered by stage_order
  const { data: roles, error: rolesError } = await supabase
    .from('workflow_roles')
    .select('stage_order, role_slug, display_name')
    .eq('template_id', task.workflow_template_id)
    .order('stage_order');

  if (rolesError || !roles || roles.length === 0) {
    return { advanced: false, error: `No workflow roles found: ${rolesError?.message}` };
  }

  // 4. Find current stage index
  const currentStage = task.current_stage || roles[0].stage_order;
  const currentIndex = roles.findIndex(r => r.stage_order === currentStage);

  if (currentIndex === -1) {
    return { advanced: false, error: `Current stage ${currentStage} not found in roles` };
  }

  const now = new Date().toISOString();
  const prevRole = roles[currentIndex];

  // 5. Final stage -> pipeline complete
  if (currentIndex >= roles.length - 1) {
    await supabase
      .from('tasks')
      .update({ status: 'review', updated_at: now })
      .eq('id', taskId);

    await supabase.from('events').insert({
      id: uuidv4(),
      type: 'task_status_changed',
      task_id: taskId,
      message: `Pipeline complete: all ${roles.length} stages finished. Task moved to review.`,
      created_at: now,
    });

    await supabase.from('task_activities').insert({
      id: uuidv4(),
      task_id: taskId,
      activity_type: 'status_changed',
      message: `Pipeline complete (${roles.length}/${roles.length} stages). Ready for review.`,
      created_at: now,
    });

    const { data: updatedTask } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (updatedTask) {
      broadcast({ type: 'task_updated', payload: updatedTask });
    }

    return { advanced: false, pipelineComplete: true };
  }

  // 6. Advance to next stage
  const nextRole = roles[currentIndex + 1];
  const templateSlug = task.workflow_template?.slug;

  if (!templateSlug) {
    return { advanced: false, error: 'Template slug not found on task' };
  }

  // Look up agent by openclaw_agent_id ({template_slug}/{role_slug})
  // Agent table IDs may use abbreviated prefixes (e.g. "jh-enricher" instead of "job-hunt-mining-enricher")
  const openclawAgentId = `${templateSlug}/${nextRole.role_slug}`;

  const { data: nextAgent, error: agentError } = await supabase
    .from('agents')
    .select('id, name')
    .eq('openclaw_agent_id', openclawAgentId)
    .single();

  if (agentError || !nextAgent) {
    return {
      advanced: false,
      error: `Next stage agent with openclaw_agent_id "${openclawAgentId}" not found. Was the template deployed?`,
    };
  }

  const nextAgentId = nextAgent.id;

  // Update task: assign to next agent, advance stage
  await supabase
    .from('tasks')
    .update({
      assigned_agent_id: nextAgentId,
      current_stage: nextRole.stage_order,
      status: 'assigned',
      updated_at: now,
    })
    .eq('id', taskId);

  // Log the stage transition
  await supabase.from('events').insert({
    id: uuidv4(),
    type: 'task_assigned',
    agent_id: nextAgentId,
    task_id: taskId,
    message: `Pipeline stage ${nextRole.stage_order}/${roles.length}: "${task.title}" advanced from ${prevRole.display_name} to ${nextAgent.name}`,
    created_at: now,
  });

  await supabase.from('task_activities').insert({
    id: uuidv4(),
    task_id: taskId,
    agent_id: nextAgentId,
    activity_type: 'status_changed',
    message: `Stage ${prevRole.stage_order} (${prevRole.display_name}) completed. Advancing to stage ${nextRole.stage_order} (${nextRole.display_name}).${completionSummary ? ` Previous: ${completionSummary}` : ''}`,
    created_at: now,
  });

  // Broadcast the update
  const { data: updatedTask } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (updatedTask) {
    broadcast({ type: 'task_updated', payload: updatedTask });
  }

  // Auto-dispatch to next agent (fire-and-forget)
  const mcUrl = getMissionControlUrl();
  fetch(`${mcUrl}/api/tasks/${taskId}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(err => {
    console.error(`[Pipeline] Failed to auto-dispatch stage ${nextRole.stage_order}:`, err);
  });

  return {
    advanced: true,
    nextStage: nextRole.stage_order,
    nextAgentId,
    nextAgentName: nextAgent.name,
  };
}
