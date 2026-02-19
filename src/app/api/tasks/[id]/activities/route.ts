/**
 * Task Activities API
 * Endpoints for logging and retrieving task activities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { CreateActivitySchema } from '@/lib/validation';
import type { TaskActivity } from '@/lib/types';

/**
 * GET /api/tasks/[id]/activities
 * Retrieve all activities for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = getSupabase();

    // Get activities with agent info via PostgREST join
    const { data: activities, error } = await supabase
      .from('task_activities')
      .select('*, agents(id, name, avatar_emoji)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Transform to include agent object in the expected shape
    const result: TaskActivity[] = (activities ?? []).map((row: any) => ({
      id: row.id,
      task_id: row.task_id,
      agent_id: row.agent_id,
      activity_type: row.activity_type,
      message: row.message,
      metadata: row.metadata,
      created_at: row.created_at,
      agent: row.agents ? {
        id: row.agents.id,
        name: row.agents.name,
        avatar_emoji: row.agents.avatar_emoji,
        role: '',
        status: 'working' as const,
        is_master: false,
        workspace_id: 'default',
        description: '',
        created_at: '',
        updated_at: '',
      } : undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks/[id]/activities
 * Log a new activity for a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();

    // Validate input with Zod
    const validation = CreateActivitySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { activity_type, message, agent_id, metadata } = validation.data;

    const supabase = getSupabase();
    const id = crypto.randomUUID();

    // Insert activity
    const { error: insertError } = await supabase
      .from('task_activities')
      .insert({
        id,
        task_id: taskId,
        agent_id: agent_id || null,
        activity_type,
        message,
        metadata: metadata ?? null,
      });

    if (insertError) {
      console.error('Error creating activity:', insertError);
      return NextResponse.json(
        { error: 'Failed to create activity' },
        { status: 500 }
      );
    }

    // Get the created activity with agent info
    const { data: activity, error: fetchError } = await supabase
      .from('task_activities')
      .select('*, agents(id, name, avatar_emoji)')
      .eq('id', id)
      .single();

    if (fetchError || !activity) {
      console.error('Error fetching created activity:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch created activity' },
        { status: 500 }
      );
    }

    const result: TaskActivity = {
      id: activity.id,
      task_id: activity.task_id,
      agent_id: activity.agent_id,
      activity_type: activity.activity_type,
      message: activity.message,
      metadata: activity.metadata,
      created_at: activity.created_at,
      agent: activity.agents ? {
        id: activity.agents.id,
        name: activity.agents.name,
        avatar_emoji: activity.agents.avatar_emoji,
        role: '',
        status: 'working' as const,
        is_master: false,
        workspace_id: 'default',
        description: '',
        created_at: '',
        updated_at: '',
      } : undefined,
    };

    // Broadcast to SSE clients
    broadcast({
      type: 'activity_logged',
      payload: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}
