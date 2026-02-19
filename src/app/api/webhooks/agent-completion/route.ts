import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabase } from '@/lib/db';
import { processPipelineCompletion } from '@/lib/pipeline-handoff';
import { advancePipelineStage } from '@/lib/pipeline';
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
 * Check completion quality and set alert_reason if issues detected.
 * Called after task status is set to 'testing'.
 */
async function checkCompletionQuality(
  supabase: ReturnType<typeof getSupabase>,
  taskId: string,
  summary: string
): Promise<void> {
  try {
    // Fetch all deliverables for this task
    const { data: deliverables } = await supabase
      .from('task_deliverables')
      .select('id, title, deliverable_type, path, url, content')
      .eq('task_id', taskId);

    const allDeliverables = deliverables ?? [];

    // Count deliverables with accessible content (not just local file paths)
    const accessibleCount = allDeliverables.filter(
      (d: { content?: string | null; url?: string | null; path?: string | null }) =>
        d.content || d.url || (d.path && (d.path.startsWith('http://') || d.path.startsWith('https://')))
    ).length;

    // Check summary for failure signals
    const summaryLower = (summary || '').toLowerCase();
    const failurePatterns = [
      '0 jobs', 'no results', 'no jobs found', 'found 0',
      'unavailable', 'not available', 'no api key', 'failed to',
      'no matches', 'empty results', 'could not find',
    ];
    const hasFailureSignal = failurePatterns.some(p => summaryLower.includes(p));

    // Build alert reason
    const reasons: string[] = [];

    if (allDeliverables.length === 0) {
      reasons.push('No deliverables registered.');
    } else if (accessibleCount === 0) {
      reasons.push(
        `${allDeliverables.length} deliverable(s) registered but none have accessible content (only local file paths).`
      );
    }

    if (hasFailureSignal) {
      // Truncate summary to 200 chars for the alert
      const truncated = summary.length > 200 ? summary.slice(0, 200) + '...' : summary;
      reasons.push(`Agent summary suggests failure: "${truncated}"`);
    }

    if (reasons.length > 0) {
      const alertReason = reasons.join(' ');
      await supabase
        .from('tasks')
        .update({ alert_reason: alertReason })
        .eq('id', taskId);

      console.warn(`[WEBHOOK] Quality alert set for task ${taskId}: ${alertReason}`);
    }
  } catch (err) {
    // Non-fatal — don't block completion for quality check failures
    console.error('[WEBHOOK] Quality check error:', err);
  }
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

      // Quality gate: check deliverables and summary for issues
      await checkCompletionQuality(supabase, task.id, body.summary || 'Task finished');

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

      // Pipeline stage advancement: advance to next stage if not final
      let pipelineResult = null;
      let handoffResult = null;
      if (task.workflow_template_id) {
        pipelineResult = await advancePipelineStage(
          task.id,
          task.assigned_agent_id ?? undefined,
          body.summary
        );
        // Only check cross-pipeline handoff if pipeline is complete (final stage)
        if (pipelineResult.pipelineComplete) {
          handoffResult = await processPipelineCompletion(
            task.id,
            task.workflow_template_id
          );
        }
      }

      return NextResponse.json({
        success: true,
        task_id: task.id,
        new_status: pipelineResult?.advanced ? 'assigned' : 'testing',
        message: pipelineResult?.advanced
          ? `Pipeline advanced to stage ${pipelineResult.nextStage} (${pipelineResult.nextAgentName})`
          : 'Task moved to testing for automated verification',
        pipeline: pipelineResult,
        handoff: handoffResult,
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

      // Quality gate: check deliverables and summary for issues
      await checkCompletionQuality(supabase, task.id, summary);

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

      // Pipeline stage advancement: advance to next stage if not final
      let pipelineResult = null;
      let handoffResult = null;
      if (task.workflow_template_id) {
        pipelineResult = await advancePipelineStage(
          task.id,
          (session as OpenClawSession).agent_id,
          summary
        );
        // Only check cross-pipeline handoff if pipeline is complete (final stage)
        if (pipelineResult.pipelineComplete) {
          handoffResult = await processPipelineCompletion(
            task.id,
            task.workflow_template_id
          );
        }
      }

      return NextResponse.json({
        success: true,
        task_id: task.id,
        agent_id: (session as OpenClawSession).agent_id,
        summary,
        new_status: pipelineResult?.advanced ? 'assigned' : 'testing',
        message: pipelineResult?.advanced
          ? `Pipeline advanced to stage ${pipelineResult.nextStage} (${pipelineResult.nextAgentName})`
          : 'Task moved to testing for automated verification',
        pipeline: pipelineResult,
        handoff: handoffResult,
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
