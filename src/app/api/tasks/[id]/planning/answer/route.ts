import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { extractJSON } from '@/lib/planning-utils';

// POST /api/tasks/[id]/planning/answer - Submit an answer and get next question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { answer, otherText } = body;

    if (!answer) {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, description, planning_session_key, planning_messages')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to submit answer: ' + taskError.message }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.planning_session_key) {
      return NextResponse.json({ error: 'Planning not started' }, { status: 400 });
    }

    // Build the answer message
    const answerText = answer === 'other' && otherText
      ? `Other: ${otherText}`
      : answer;

    const answerPrompt = `User's answer: ${answerText}

Based on this answer and the conversation so far, either:
1. Ask your next question (if you need more information)
2. Complete the planning (if you have enough information)

For another question, respond with JSON:
{
  "question": "Your next question?",
  "options": [
    {"id": "A", "label": "Option A"},
    {"id": "B", "label": "Option B"},
    {"id": "other", "label": "Other"}
  ]
}

If planning is complete, respond with JSON:
{
  "status": "complete",
  "spec": {
    "title": "Task title",
    "summary": "Summary of what needs to be done",
    "deliverables": ["List of deliverables"],
    "success_criteria": ["How we know it's done"],
    "constraints": {}
  },
  "agents": [
    {
      "name": "Agent Name",
      "role": "Agent role",
      "avatar_emoji": "🎯",
      "soul_md": "Agent personality...",
      "instructions": "Specific instructions..."
    }
  ],
  "execution_plan": {
    "approach": "How to execute",
    "steps": ["Step 1", "Step 2"]
  }
}`;

    // planning_messages is JSONB - already parsed by Supabase, no JSON.parse needed
    const messages = Array.isArray(task.planning_messages) ? task.planning_messages : [];
    messages.push({ role: 'user', content: answerText, timestamp: Date.now() });

    // Connect to OpenClaw and send the answer
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      console.log('[Planning Answer] Connecting to OpenClaw...');
      await client.connect();
    }

    console.log('[Planning Answer] Sending answer to OpenClaw, session:', task.planning_session_key);
    console.log('[Planning Answer] Answer text:', answerText);

    try {
      const sendResult = await client.call('chat.send', {
        sessionKey: task.planning_session_key,
        message: answerPrompt,
        idempotencyKey: `planning-answer-${taskId}-${Date.now()}`,
      });
      console.log('[Planning Answer] Send successful, result:', sendResult);
    } catch (sendError) {
      console.error('[Planning Answer] Failed to send to OpenClaw:', sendError);
      return NextResponse.json({ error: 'Failed to send answer to orchestrator: ' + (sendError as Error).message }, { status: 500 });
    }

    // Update messages in DB - pass as object directly (JSONB auto-serializes)
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ planning_messages: messages })
      .eq('id', taskId);

    if (updateError) {
      console.error('[Planning Answer] Failed to update messages:', updateError);
    }

    // Poll for response via OpenClaw API - removed aggressive polling
    // Return immediately and let frontend poll for updates
    // This eliminates 30 OpenClaw API calls per answer submission

    return NextResponse.json({
      success: true,
      messages,
      note: 'Answer submitted. Poll GET endpoint for updates.',
    });
  } catch (error) {
    console.error('Failed to submit answer:', error);
    return NextResponse.json({ error: 'Failed to submit answer: ' + (error as Error).message }, { status: 500 });
  }
}
