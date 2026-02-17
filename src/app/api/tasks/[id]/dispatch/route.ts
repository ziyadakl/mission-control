import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { getProjectsPath, getMissionControlUrl } from '@/lib/config';
import type { Task, Agent, OpenClawSession } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/dispatch
 *
 * Dispatches a task to its assigned agent's OpenClaw session.
 * Creates session if needed, sends task details to agent.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    // Get task with agent info
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_agent_info:agents!assigned_agent_id(name, is_master)
      `)
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.assigned_agent_id) {
      return NextResponse.json(
        { error: 'Task has no assigned agent' },
        { status: 400 }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', task.assigned_agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Assigned agent not found' }, { status: 404 });
    }

    // Check if dispatching to the master agent while there are other orchestrators available
    if (agent.is_master) {
      // Check for other master agents in the same workspace (excluding this one)
      const { data: otherOrchestrators } = await supabase
        .from('agents')
        .select('id, name, role')
        .eq('is_master', true)
        .neq('id', agent.id)
        .eq('workspace_id', task.workspace_id)
        .neq('status', 'offline');

      if (otherOrchestrators && otherOrchestrators.length > 0) {
        return NextResponse.json({
          success: false,
          warning: 'Other orchestrators available',
          message: `There ${otherOrchestrators.length === 1 ? 'is' : 'are'} ${otherOrchestrators.length} other orchestrator${otherOrchestrators.length === 1 ? '' : 's'} available in this workspace: ${otherOrchestrators.map(o => o.name).join(', ')}. Consider assigning this task to them instead.`,
          otherOrchestrators,
        }, { status: 409 }); // 409 Conflict - indicating there's an alternative
      }
    }

    // Connect to OpenClaw Gateway
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch (err) {
        console.error('Failed to connect to OpenClaw Gateway:', err);
        return NextResponse.json(
          { error: 'Failed to connect to OpenClaw Gateway' },
          { status: 503 }
        );
      }
    }

    // Get or create OpenClaw session for this agent
    const { data: existingSession } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('agent_id', agent.id)
      .eq('status', 'active')
      .single();

    let session = existingSession;
    const now = new Date().toISOString();

    if (!session) {
      // Create session record
      const sessionId = uuidv4();
      const openclawSessionId = `mission-control-task-${task.id}`;

      const { error: sessionInsertError } = await supabase.from('openclaw_sessions').insert({
        id: sessionId,
        agent_id: agent.id,
        openclaw_session_id: openclawSessionId,
        channel: 'mission-control',
        status: 'active',
        created_at: now,
        updated_at: now,
      });

      if (sessionInsertError) {
        console.error('Failed to create session:', sessionInsertError);
        return NextResponse.json(
          { error: 'Failed to create agent session' },
          { status: 500 }
        );
      }

      const { data: newSession } = await supabase
        .from('openclaw_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      session = newSession;

      // Log session creation
      await supabase.from('events').insert({
        id: uuidv4(),
        type: 'agent_status_changed',
        agent_id: agent.id,
        message: `${agent.name} session created`,
        created_at: now,
      });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create agent session' },
        { status: 500 }
      );
    }

    // Build task message for agent
    const priorityMap: Record<string, string> = {
      low: '\u{1F535}',
      normal: '\u26AA',
      high: '\u{1F7E1}',
      urgent: '\u{1F534}'
    };
    const priorityEmoji = priorityMap[task.priority as string] || '\u26AA';

    // Get project path for deliverables
    const projectsPath = getProjectsPath();
    const projectDir = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const taskProjectDir = `${projectsPath}/${projectDir}`;
    const missionControlUrl = getMissionControlUrl();

    // If assigned to a pipeline agent, tell Bob which pipeline to use
    let pipelineHint = '';
    let stageInfo = '';
    if (agent.openclaw_agent_id && !agent.is_master && agent.openclaw_agent_id !== 'worker') {
      pipelineHint = `\n**ROUTE TO PIPELINE:** ${agent.openclaw_agent_id}\n`;
    }

    // Stage tracking: if task has a workflow template, determine current stage
    if (task.workflow_template_id) {
      const { data: roles } = await supabase
        .from('workflow_roles')
        .select('stage_order, role_slug, display_name')
        .eq('template_id', task.workflow_template_id)
        .order('stage_order');

      if (roles && roles.length > 0) {
        // Find the stage matching the assigned agent's role
        const agentRoleSlug = agent.openclaw_agent_id?.split('/')[1];
        const matchedRole = roles.find(r => r.role_slug === agentRoleSlug);
        const currentStage = matchedRole ? matchedRole.stage_order : roles[0].stage_order;

        // Update current_stage on the task
        await supabase.from('tasks').update({ current_stage: currentStage }).eq('id', id);

        // Build stage info for the dispatch message
        const totalStages = roles.length;
        const stageList = roles.map(r =>
          r.stage_order === currentStage ? `**→ ${r.stage_order}. ${r.display_name}**` : `  ${r.stage_order}. ${r.display_name}`
        ).join('\n');
        stageInfo = `\n**PIPELINE STAGE:** ${currentStage}/${totalStages}\n${stageList}\n`;
      }
    }

    const taskMessage = `${priorityEmoji} **NEW TASK ASSIGNED**

**Title:** ${task.title}
${task.description ? `**Description:** ${task.description}\n` : ''}
**Priority:** ${task.priority.toUpperCase()}
${task.due_date ? `**Due:** ${task.due_date}\n` : ''}
**Task ID:** ${task.id}${pipelineHint}${stageInfo}

**OUTPUT DIRECTORY:** ${taskProjectDir}
Create this directory and save all deliverables there.

**IMPORTANT:** After completing work, you MUST call these APIs:
1. Log activity: POST ${missionControlUrl}/api/tasks/${task.id}/activities
   Body: {"activity_type": "completed", "message": "Description of what was done"}
2. Register deliverable: POST ${missionControlUrl}/api/tasks/${task.id}/deliverables
   Body: {"deliverable_type": "file", "title": "File name", "path": "${taskProjectDir}/filename.html"}
3. Update status: PATCH ${missionControlUrl}/api/tasks/${task.id}
   Body: {"status": "review"}

When complete, reply with:
\`TASK_COMPLETE: [brief summary of what you did]\`

If you need help or clarification, ask the orchestrator.`;

    // Send message to agent's session using chat.send
    try {
      // Use sessionKey for routing to the agent's session
      // Format: agent:main:{openclaw_session_id}
      // Route through the assigned agent's OpenClaw ID. Pipeline agents can't be
      // dispatched directly, so non-master agents still route through 'main'.
      const routeAgentId = agent.is_master ? (agent.openclaw_agent_id || 'main') : 'main';
      const sessionKey = `agent:${routeAgentId}:${session.openclaw_session_id}`;
      await client.call('chat.send', {
        sessionKey,
        message: taskMessage,
        idempotencyKey: `dispatch-${task.id}-${Date.now()}`
      });

      // Update task status to in_progress
      await supabase
        .from('tasks')
        .update({ status: 'in_progress', updated_at: now })
        .eq('id', id);

      // Broadcast task update
      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (updatedTask) {
        broadcast({
          type: 'task_updated',
          payload: updatedTask,
        });
      }

      // Update agent status to working
      await supabase
        .from('agents')
        .update({ status: 'working', updated_at: now })
        .eq('id', agent.id);

      // Log dispatch event to events table
      const eventId = uuidv4();
      await supabase.from('events').insert({
        id: eventId,
        type: 'task_dispatched',
        agent_id: agent.id,
        task_id: task.id,
        message: `Task "${task.title}" dispatched to ${agent.name}`,
        created_at: now,
      });

      // Log dispatch activity to task_activities table (for Activity tab)
      const activityId = crypto.randomUUID();
      await supabase.from('task_activities').insert({
        id: activityId,
        task_id: task.id,
        agent_id: agent.id,
        activity_type: 'status_changed',
        message: `Task dispatched to ${agent.name} - Agent is now working on this task`,
        created_at: now,
      });

      return NextResponse.json({
        success: true,
        task_id: task.id,
        agent_id: agent.id,
        session_id: session.openclaw_session_id,
        message: 'Task dispatched to agent'
      });
    } catch (err) {
      console.error('Failed to send message to agent:', err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to dispatch task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
