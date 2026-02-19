import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { extractJSON } from '@/lib/planning-utils';
// File system imports removed - using OpenClaw API instead

// Planning session prefix for OpenClaw (must match agent:main: format)
const PLANNING_SESSION_PREFIX = 'agent:main:planning:';

// GET /api/tasks/[id]/planning - Get planning state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const supabase = getSupabase();

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, description, status, planning_session_key, planning_messages, planning_complete, planning_spec, planning_agents')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to get planning state' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // planning_messages is stored as JSONB, auto-parsed by Supabase
    const messages = task.planning_messages ?? [];

    // Find the latest question (last assistant message with question structure)
    const lastAssistantMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'assistant');
    let currentQuestion = null;

    if (lastAssistantMessage) {
      // Use extractJSON to handle code blocks and surrounding text
      const parsed = extractJSON(lastAssistantMessage.content);
      if (parsed && 'question' in parsed) {
        currentQuestion = parsed;
      }
    }

    return NextResponse.json({
      taskId,
      sessionKey: task.planning_session_key,
      messages,
      currentQuestion,
      isComplete: !!task.planning_complete,
      spec: task.planning_spec ?? null,
      agents: task.planning_agents ?? null,
      isStarted: messages.length > 0,
    });
  } catch (error) {
    console.error('Failed to get planning state:', error);
    return NextResponse.json({ error: 'Failed to get planning state' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/planning - Start planning session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const supabase = getSupabase();

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, description, status, workspace_id, planning_session_key, planning_messages')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to start planning: ' + taskError.message }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if planning already started
    if (task.planning_session_key) {
      return NextResponse.json({ error: 'Planning already started', sessionKey: task.planning_session_key }, { status: 400 });
    }

    // Get the default master agent for this workspace
    const { data: defaultMaster } = await supabase
      .from('agents')
      .select('id')
      .eq('is_master', true)
      .eq('workspace_id', task.workspace_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Check if there are other orchestrators available before starting planning
    const { data: otherOrchestrators } = await supabase
      .from('agents')
      .select('id, name, role')
      .eq('is_master', true)
      .eq('workspace_id', task.workspace_id)
      .neq('id', defaultMaster?.id ?? '')
      .neq('status', 'offline');

    if (otherOrchestrators && otherOrchestrators.length > 0) {
      return NextResponse.json({
        error: 'Other orchestrators available',
        message: `There ${otherOrchestrators.length === 1 ? 'is' : 'are'} ${otherOrchestrators.length} other orchestrator${otherOrchestrators.length === 1 ? '' : 's'} available in this workspace: ${otherOrchestrators.map(o => o.name).join(', ')}. Please assign this task to them directly.`,
        otherOrchestrators,
      }, { status: 409 }); // 409 Conflict
    }

    // Create session key for this planning task
    const sessionKey = `${PLANNING_SESSION_PREFIX}${taskId}`;

    // Build the initial planning prompt
    const planningPrompt = `PLANNING REQUEST

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

You are starting a planning session for this task. Read PLANNING.md for your protocol.

Generate your FIRST question to understand what the user needs. Remember:
- Questions must be multiple choice
- Include an "Other" option
- Be specific to THIS task, not generic

Respond with ONLY valid JSON in this format:
{
  "question": "Your question here?",
  "options": [
    {"id": "A", "label": "First option"},
    {"id": "B", "label": "Second option"},
    {"id": "C", "label": "Third option"},
    {"id": "other", "label": "Other"}
  ]
}`;

    // Connect to OpenClaw and send the planning request
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      await client.connect();
    }

    // Send planning request to the planning session
    await client.call('chat.send', {
      sessionKey: sessionKey,
      message: planningPrompt,
      idempotencyKey: `planning-start-${taskId}-${Date.now()}`,
    });

    // Store the session key and initial message
    // planning_messages is JSONB - pass as object directly, no JSON.stringify
    const messages = [{ role: 'user', content: planningPrompt, timestamp: Date.now() }];

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        planning_session_key: sessionKey,
        planning_messages: messages,
        status: 'planning',
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('Failed to update task with planning session:', updateError);
      return NextResponse.json({ error: 'Failed to start planning: ' + updateError.message }, { status: 500 });
    }

    // Return immediately - frontend will poll for updates
    // This eliminates the aggressive polling loop that was making 30+ OpenClaw API calls
    return NextResponse.json({
      success: true,
      sessionKey,
      messages,
      note: 'Planning started. Poll GET endpoint for updates.',
    });
  } catch (error) {
    console.error('Failed to start planning:', error);
    return NextResponse.json({ error: 'Failed to start planning: ' + (error as Error).message }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]/planning - Cancel planning session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const supabase = getSupabase();

    // Get task to check it exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, planning_session_key, status')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to cancel planning: ' + taskError.message }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Clear planning-related fields
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        planning_session_key: null,
        planning_messages: null,
        planning_complete: false,
        planning_spec: null,
        planning_agents: null,
        status: 'inbox',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('Failed to cancel planning:', updateError);
      return NextResponse.json({ error: 'Failed to cancel planning: ' + updateError.message }, { status: 500 });
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
        payload: updatedTask as any, // Cast to any to satisfy SSEEvent payload union type
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel planning:', error);
    return NextResponse.json({ error: 'Failed to cancel planning: ' + (error as Error).message }, { status: 500 });
  }
}
