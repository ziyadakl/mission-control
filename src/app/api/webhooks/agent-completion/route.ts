import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabase } from '@/lib/db';
import type { Task, OpenClawSession } from '@/lib/types';

/**
 * Verify HMAC-SHA256 signature of webhook request
 */
function verifyWebhookSignature(signature: string, rawBody: string): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Dev mode - skip validation
    return true;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * POST /api/webhooks/agent-completion
 *
 * Receives completion notifications from agents.
 * Expected payload:
 * {
 *   "session_id": "mission-control-engineering",
 *   "message": "TASK_COMPLETE: Built the authentication system"
 * }
 *
 * Or can be called with task_id directly:
 * {
 *   "task_id": "uuid",
 *   "summary": "Completed the task successfully"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature if WEBHOOK_SECRET is set
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature');

      if (!signature || !verifyWebhookSignature(signature, rawBody)) {
        console.warn('[WEBHOOK] Invalid signature attempt');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const supabase = getSupabase();

    // Handle direct task_id completion
    if (body.task_id) {
      // Fetch task joined with assigned agent name
      const { data: taskRow, error: taskError } = await supabase
        .from('tasks')
        .select('*, agents!assigned_agent_id(name)')
        .eq('id', body.task_id)
        .maybeSingle();

      if (taskError) {
        console.error('Failed to fetch task:', taskError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if (!taskRow) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      // Flatten the joined agent name onto the task row
      const task = {
        ...(taskRow as Task),
        assigned_agent_name: (taskRow as any).agents?.name ?? null,
      };

      // Only move to testing if not already in testing, review, or done
      // (Don't overwrite user's approval or testing results)
      if (task.status !== 'testing' && task.status !== 'review' && task.status !== 'done') {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ status: 'testing', updated_at: now })
          .eq('id', task.id);

        if (updateError) {
          console.error('Failed to update task status:', updateError);
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      }

      // Log completion event
      const { error: eventError } = await supabase.from('events').insert({
        id: uuidv4(),
        type: 'task_completed',
        agent_id: task.assigned_agent_id,
        task_id: task.id,
        message: `${task.assigned_agent_name} completed: ${body.summary || 'Task finished'}`,
        created_at: now,
      });

      if (eventError) {
        console.error('Failed to insert completion event:', eventError);
        // Non-fatal — continue
      }

      // Set agent back to standby
      if (task.assigned_agent_id) {
        await supabase
          .from('agents')
          .update({ status: 'standby', updated_at: now })
          .eq('id', task.assigned_agent_id);
      }

      return NextResponse.json({
        success: true,
        task_id: task.id,
        new_status: 'testing',
        message: 'Task moved to testing for automated verification',
      });
    }

    // Handle session-based completion (from message parsing)
    if (body.session_id && body.message) {
      // Parse TASK_COMPLETE message
      const completionMatch = body.message.match(/TASK_COMPLETE:\s*(.+)/i);
      if (!completionMatch) {
        return NextResponse.json(
          { error: 'Invalid completion message format. Expected: TASK_COMPLETE: [summary]' },
          { status: 400 }
        );
      }

      const summary = completionMatch[1].trim();

      // Find agent by session
      const { data: session, error: sessionError } = await supabase
        .from('openclaw_sessions')
        .select('*')
        .eq('openclaw_session_id', body.session_id)
        .eq('status', 'active')
        .maybeSingle();

      if (sessionError) {
        console.error('Failed to fetch session:', sessionError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found or inactive' },
          { status: 404 }
        );
      }

      // Find active task for this agent (most recently updated)
      const { data: taskRow, error: taskError } = await supabase
        .from('tasks')
        .select('*, agents!assigned_agent_id(name)')
        .eq('assigned_agent_id', (session as OpenClawSession).agent_id)
        .in('status', ['assigned', 'in_progress'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (taskError) {
        console.error('Failed to fetch active task:', taskError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if (!taskRow) {
        return NextResponse.json(
          { error: 'No active task found for this agent' },
          { status: 404 }
        );
      }

      // Flatten joined agent name
      const task = {
        ...(taskRow as Task),
        assigned_agent_name: (taskRow as any).agents?.name ?? null,
      };

      // Only move to testing if not already in testing, review, or done
      // (Don't overwrite user's approval or testing results)
      if (task.status !== 'testing' && task.status !== 'review' && task.status !== 'done') {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ status: 'testing', updated_at: now })
          .eq('id', task.id);

        if (updateError) {
          console.error('Failed to update task status:', updateError);
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      }

      // Log completion with summary
      const { error: eventError } = await supabase.from('events').insert({
        id: uuidv4(),
        type: 'task_completed',
        agent_id: (session as OpenClawSession).agent_id,
        task_id: task.id,
        message: `${task.assigned_agent_name} completed: ${summary}`,
        created_at: now,
      });

      if (eventError) {
        console.error('Failed to insert completion event:', eventError);
        // Non-fatal — continue
      }

      // Set agent back to standby
      const { error: agentError } = await supabase
        .from('agents')
        .update({ status: 'standby', updated_at: now })
        .eq('id', (session as OpenClawSession).agent_id);

      if (agentError) {
        console.error('Failed to update agent status:', agentError);
        // Non-fatal — continue
      }

      return NextResponse.json({
        success: true,
        task_id: task.id,
        agent_id: (session as OpenClawSession).agent_id,
        summary,
        new_status: 'testing',
        message: 'Task moved to testing for automated verification',
      });
    }

    return NextResponse.json(
      { error: 'Invalid payload. Provide either task_id or session_id + message' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Agent completion webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/agent-completion
 *
 * Returns webhook status and recent completions
 */
export async function GET() {
  try {
    const supabase = getSupabase();

    // Use the RPC that already JOINs events with agents and tasks
    const { data: recentCompletions, error } = await supabase.rpc('get_events_with_details', {
      p_since: null,
      p_limit: 10,
    });

    if (error) {
      console.error('Failed to fetch recent completions:', error);
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    // Filter to only task_completed events (RPC returns all types)
    const completions = (recentCompletions ?? []).filter(
      (e: { type: string }) => e.type === 'task_completed'
    );

    return NextResponse.json({
      status: 'active',
      recent_completions: completions,
      endpoint: '/api/webhooks/agent-completion',
    });
  } catch (error) {
    console.error('Failed to fetch completion status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
