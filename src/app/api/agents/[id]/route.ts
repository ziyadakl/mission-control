import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import type { UpdateAgentRequest } from '@/lib/types';

// GET /api/agents/[id] - Get a single agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch agent:', error);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to fetch agent:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

// PATCH /api/agents/[id] - Update an agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body: UpdateAgentRequest = await request.json();

    const { data: existing, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch agent:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.description !== undefined) updates.description = body.description;
    if (body.avatar_emoji !== undefined) updates.avatar_emoji = body.avatar_emoji;
    if (body.status !== undefined) {
      updates.status = body.status;

      // Log status change event
      const now = new Date().toISOString();
      const { error: eventError } = await supabase
        .from('events')
        .insert({
          id: uuidv4(),
          type: 'agent_status_changed',
          agent_id: id,
          message: `${existing.name} is now ${body.status}`,
          created_at: now,
        });

      if (eventError) {
        console.error('Failed to log agent_status_changed event:', eventError);
      }
    }
    if (body.is_master !== undefined) updates.is_master = body.is_master;
    if (body.soul_md !== undefined) updates.soul_md = body.soul_md;
    if (body.user_md !== undefined) updates.user_md = body.user_md;
    if (body.agents_md !== undefined) updates.agents_md = body.agents_md;
    if (body.model !== undefined) updates.model = body.model;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: agent, error: updateError } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update agent:', updateError);
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to update agent:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: existing, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch agent:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Delete or nullify related records first (foreign key constraints)
    const { error: sessionsError } = await supabase
      .from('openclaw_sessions')
      .delete()
      .eq('agent_id', id);
    if (sessionsError) console.error('Failed to delete openclaw_sessions for agent:', sessionsError);

    const { error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('agent_id', id);
    if (eventsError) console.error('Failed to delete events for agent:', eventsError);

    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('sender_agent_id', id);
    if (messagesError) console.error('Failed to delete messages for agent:', messagesError);

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('agent_id', id);
    if (participantsError) console.error('Failed to delete conversation_participants for agent:', participantsError);

    const { error: assignedError } = await supabase
      .from('tasks')
      .update({ assigned_agent_id: null })
      .eq('assigned_agent_id', id);
    if (assignedError) console.error('Failed to nullify assigned_agent_id on tasks:', assignedError);

    const { error: createdByError } = await supabase
      .from('tasks')
      .update({ created_by_agent_id: null })
      .eq('created_by_agent_id', id);
    if (createdByError) console.error('Failed to nullify created_by_agent_id on tasks:', createdByError);

    const { error: activitiesError } = await supabase
      .from('task_activities')
      .update({ agent_id: null })
      .eq('agent_id', id);
    if (activitiesError) console.error('Failed to nullify agent_id on task_activities:', activitiesError);

    // Now delete the agent
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete agent:', deleteError);
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
