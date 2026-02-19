import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { triggerAutoDispatch } from '@/lib/auto-dispatch';

/**
 * POST /api/tasks/[id]/planning/retry-dispatch
 *
 * Retries the auto-dispatch for a completed planning task
 * This endpoint allows users to retry failed dispatches from the UI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const supabase = getSupabase();

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, assigned_agent_id, workspace_id, planning_complete, planning_dispatch_error, status')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to retry dispatch' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if planning is complete
    if (!task.planning_complete) {
      return NextResponse.json({
        error: 'Cannot retry dispatch: planning is not complete'
      }, { status: 400 });
    }

    // Check if there's an assigned agent
    if (!task.assigned_agent_id) {
      return NextResponse.json({
        error: 'Cannot retry dispatch: no agent assigned'
      }, { status: 400 });
    }

    // Get agent name for logging
    const { data: agent } = await supabase
      .from('agents')
      .select('name')
      .eq('id', task.assigned_agent_id)
      .maybeSingle();

    // Trigger the dispatch
    const result = await triggerAutoDispatch({
      taskId: task.id,
      taskTitle: task.title,
      agentId: task.assigned_agent_id,
      agentName: agent?.name || 'Unknown Agent',
      workspaceId: task.workspace_id
    });

    if (result.success) {
      // Update task status on success
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: 'inbox',
          planning_dispatch_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('Failed to update task after successful dispatch:', updateError);
      }

      return NextResponse.json({
        success: true,
        message: 'Dispatch retry successful'
      });
    } else {
      // Store the error for display, keep as 'pending_dispatch'
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          planning_dispatch_error: result.error,
          status: 'pending_dispatch',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('Failed to store dispatch error:', updateError);
      }

      return NextResponse.json({
        error: 'Dispatch retry failed',
        details: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to retry dispatch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Store the error in the database for user display
    const supabase = getSupabase();
    await supabase
      .from('tasks')
      .update({
        planning_dispatch_error: `Retry error: ${errorMessage}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    return NextResponse.json({
      error: 'Failed to retry dispatch',
      details: errorMessage
    }, { status: 500 });
  }
}
