import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { CreateTaskSchema } from '@/lib/validation';
import type { CreateTaskRequest } from '@/lib/types';

// GET /api/tasks - List all tasks with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const businessId = searchParams.get('business_id');
    const workspaceId = searchParams.get('workspace_id');
    const assignedAgentId = searchParams.get('assigned_agent_id');

    const rawLimit = parseInt(searchParams.get('limit') || '200', 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 200);

    // Use the RPC function that returns tasks with joined agent info
    const { data: tasks, error } = await supabase.rpc('get_tasks_with_agents', {
      p_workspace_id: workspaceId || null,
      p_business_id: businessId || null,
      p_status: status || null,
      p_assigned_agent_id: assignedAgentId || null,
      p_priority: priority || null,
    });

    if (error) {
      console.error('Failed to fetch tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    // Apply the limit client-side since the RPC may not support it directly
    const limitedTasks = (tasks ?? []).slice(0, limit);

    return NextResponse.json(limitedTasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body: CreateTaskRequest = await request.json();
    // Validate input with Zod
    const validation = CreateTaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validation.data;
    const id = uuidv4();
    const now = new Date().toISOString();

    const workspaceId = validatedData.workspace_id || 'default';
    const status = validatedData.status || 'inbox';

    const { error: insertError } = await supabase
      .from('tasks')
      .insert({
        id,
        title: validatedData.title,
        description: validatedData.description || null,
        status,
        priority: validatedData.priority || 'normal',
        assigned_agent_id: validatedData.assigned_agent_id || null,
        created_by_agent_id: validatedData.created_by_agent_id || null,
        workspace_id: workspaceId,
        due_date: validatedData.due_date || null,
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      console.error('Failed to create task:', insertError);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    // Log event
    let eventMessage = `New task: ${validatedData.title}`;
    if (validatedData.created_by_agent_id) {
      const { data: creator } = await supabase
        .from('agents')
        .select('name')
        .eq('id', validatedData.created_by_agent_id)
        .maybeSingle();
      if (creator) {
        eventMessage = `${creator.name} created task: ${validatedData.title}`;
      }
    }

    const { error: eventError } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        type: 'task_created',
        agent_id: body.created_by_agent_id || null,
        task_id: id,
        message: eventMessage,
        created_at: now,
      });

    if (eventError) {
      console.error('Failed to log task_created event:', eventError);
    }

    // Fetch created task with all joined fields via RPC
    const { data: taskResult, error: fetchError } = await supabase.rpc('get_task_by_id', {
      p_task_id: id,
    });

    if (fetchError || !taskResult) {
      console.error('Failed to fetch created task via RPC, returning minimal response:', fetchError);
      return NextResponse.json({ id, title: validatedData.title, status, workspace_id: workspaceId, created_at: now, updated_at: now }, { status: 201 });
    }

    const task = Array.isArray(taskResult) ? taskResult[0] : taskResult;

    // Broadcast task creation via SSE
    if (task) {
      broadcast({
        type: 'task_created',
        payload: task,
      });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
