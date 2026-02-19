import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { getMissionControlUrl } from '@/lib/config';
import { UpdateTaskSchema } from '@/lib/validation';
import type { UpdateTaskRequest } from '@/lib/types';

// GET /api/tasks/[id] - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: taskResult, error } = await supabase.rpc('get_task_by_id', {
      p_task_id: id,
    });

    if (error) {
      console.error('Failed to fetch task:', error);
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
    }

    const task = Array.isArray(taskResult) ? taskResult[0] : taskResult;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to fetch task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body: UpdateTaskRequest & { updated_by_agent_id?: string } = await request.json();

    // Validate input with Zod
    const validation = UpdateTaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    const { data: existing, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch task:', fetchError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const now = new Date().toISOString();

    // Workflow enforcement for agent-initiated approvals
    // If an agent is trying to move review→done, they must be a master agent
    // User-initiated moves (no agent ID) are allowed
    if (validatedData.status === 'done' && existing.status === 'review' && validatedData.updated_by_agent_id) {
      const { data: updatingAgent, error: agentFetchError } = await supabase
        .from('agents')
        .select('is_master')
        .eq('id', validatedData.updated_by_agent_id)
        .maybeSingle();

      if (agentFetchError) {
        console.error('Failed to fetch updating agent:', agentFetchError);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
      }

      if (!updatingAgent || !updatingAgent.is_master) {
        return NextResponse.json(
          { error: 'Forbidden: only the master agent can approve tasks' },
          { status: 403 }
        );
      }
    }

    if (validatedData.title !== undefined) updates.title = validatedData.title;
    if (validatedData.description !== undefined) updates.description = validatedData.description;
    if (validatedData.priority !== undefined) updates.priority = validatedData.priority;
    if (validatedData.due_date !== undefined) updates.due_date = validatedData.due_date;
    if (validatedData.workflow_template_id !== undefined) {
      updates.workflow_template_id = validatedData.workflow_template_id;
      // Reset current_stage when template changes (including first assignment)
      if (validatedData.workflow_template_id && validatedData.workflow_template_id !== existing.workflow_template_id) {
        updates.current_stage = 1;
      }
      // Clear current_stage when template is removed
      if (!validatedData.workflow_template_id) {
        updates.current_stage = null;
      }
    }
    if (validatedData.current_stage !== undefined) updates.current_stage = validatedData.current_stage;

    // Track if we need to dispatch task
    let shouldDispatch = false;

    // Handle status change
    if (validatedData.status !== undefined && validatedData.status !== existing.status) {
      updates.status = validatedData.status;

      // Auto-dispatch when moving to assigned
      if (validatedData.status === 'assigned' && existing.assigned_agent_id) {
        shouldDispatch = true;
      }

      // Log status change event
      const eventType = validatedData.status === 'done' ? 'task_completed' : 'task_status_changed';
      const { error: eventError } = await supabase
        .from('events')
        .insert({
          id: uuidv4(),
          type: eventType,
          task_id: id,
          message: `Task "${existing.title}" moved to ${validatedData.status}`,
          created_at: now,
        });

      if (eventError) {
        console.error('Failed to log status change event:', eventError);
      }
    }

    // Handle assignment change
    if (validatedData.assigned_agent_id !== undefined && validatedData.assigned_agent_id !== existing.assigned_agent_id) {
      updates.assigned_agent_id = validatedData.assigned_agent_id;

      if (validatedData.assigned_agent_id) {
        const { data: agent } = await supabase
          .from('agents')
          .select('name')
          .eq('id', validatedData.assigned_agent_id)
          .maybeSingle();

        if (agent) {
          const { error: eventError } = await supabase
            .from('events')
            .insert({
              id: uuidv4(),
              type: 'task_assigned',
              agent_id: validatedData.assigned_agent_id,
              task_id: id,
              message: `"${existing.title}" assigned to ${agent.name}`,
              created_at: now,
            });

          if (eventError) {
            console.error('Failed to log task_assigned event:', eventError);
          }

          // Auto-dispatch if already in assigned status or being assigned now
          if (existing.status === 'assigned' || validatedData.status === 'assigned') {
            shouldDispatch = true;
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.updated_at = now;

    const { error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    // Fetch updated task with all joined fields via RPC
    const { data: taskResult, error: fetchUpdatedError } = await supabase.rpc('get_task_by_id', {
      p_task_id: id,
    });

    if (fetchUpdatedError || !taskResult) {
      console.error('Failed to fetch updated task via RPC, returning minimal response:', fetchUpdatedError);
      return NextResponse.json({ id, ...updates }, { status: 200 });
    }

    const task = Array.isArray(taskResult) ? taskResult[0] : taskResult;

    // Broadcast task update via SSE
    if (task) {
      broadcast({
        type: 'task_updated',
        payload: task,
      });
    }

    // Trigger auto-dispatch if needed
    if (shouldDispatch) {
      // Call dispatch endpoint asynchronously (don't wait for response)
      const missionControlUrl = getMissionControlUrl();
      fetch(`${missionControlUrl}/api/tasks/${id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => {
        console.error('Auto-dispatch failed:', err);
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: existing, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch task:', fetchError);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Delete or nullify related records first (foreign key constraints)
    // Note: task_activities and task_deliverables have ON DELETE CASCADE
    const { error: sessionsError } = await supabase
      .from('openclaw_sessions')
      .delete()
      .eq('task_id', id);
    if (sessionsError) console.error('Failed to delete openclaw_sessions for task:', sessionsError);

    const { error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('task_id', id);
    if (eventsError) console.error('Failed to delete events for task:', eventsError);

    // Conversations reference tasks - nullify or delete
    const { error: convsError } = await supabase
      .from('conversations')
      .update({ task_id: null })
      .eq('task_id', id);
    if (convsError) console.error('Failed to nullify task_id on conversations:', convsError);

    // Now delete the task (cascades to task_activities and task_deliverables)
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete task:', deleteError);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    // Broadcast deletion via SSE
    broadcast({
      type: 'task_deleted',
      payload: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
