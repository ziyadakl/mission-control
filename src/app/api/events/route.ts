import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import { CreateEventSchema } from '@/lib/validation';
import type { Event } from '@/lib/types';

// GET /api/events - List events (live feed)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const since = searchParams.get('since'); // ISO timestamp for polling

    const supabase = getSupabase();

    // Use the RPC that returns events joined with agent and task info
    const { data: events, error } = await supabase.rpc('get_events_with_details', {
      p_since: since ?? null,
      p_limit: limit,
    });

    if (error) {
      console.error('Failed to fetch events via RPC:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Transform to include nested agent/task objects (RPC returns flat rows)
    const transformedEvents = (events as Array<Event & { agent_name?: string; agent_emoji?: string; task_title?: string }>).map((event) => ({
      ...event,
      agent: event.agent_id
        ? {
            id: event.agent_id,
            name: event.agent_name,
            avatar_emoji: event.agent_emoji,
          }
        : undefined,
      task: event.task_id
        ? {
            id: event.task_id,
            title: event.task_title,
          }
        : undefined,
    }));

    return NextResponse.json(transformedEvents);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST /api/events - Create a manual event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = CreateEventSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validation.data;
    const id = uuidv4();
    const now = new Date().toISOString();

    const supabase = getSupabase();

    const { error } = await supabase.from('events').insert({
      id,
      type: validatedData.type,
      agent_id: validatedData.agent_id ?? null,
      task_id: validatedData.task_id ?? null,
      message: validatedData.message,
      // JSONB column — pass object directly, not JSON.stringify
      metadata: validatedData.metadata ?? null,
      created_at: now,
    });

    if (error) {
      console.error('Failed to insert event:', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json(
      { id, type: validatedData.type, message: validatedData.message, created_at: now },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
