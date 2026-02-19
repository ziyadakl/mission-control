import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import { CreateAgentSchema } from '@/lib/validation';
import type { CreateAgentRequest } from '@/lib/types';

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const workspaceId = request.nextUrl.searchParams.get('workspace_id');

    let query = supabase
      .from('agents')
      .select('*')
      .order('is_master', { ascending: false })
      .order('name', { ascending: true })
      .limit(100);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: agents, error } = await query;

    if (error) {
      console.error('Failed to fetch agents:', error);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body: CreateAgentRequest = await request.json();

    // Validate input with Zod
    const validation = CreateAgentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validation.data;
    const id = uuidv4();
    const now = new Date().toISOString();

    const { data: agent, error: insertError } = await supabase
      .from('agents')
      .insert({
        id,
        name: validatedData.name,
        role: validatedData.role,
        description: validatedData.description || null,
        avatar_emoji: validatedData.avatar_emoji || '🤖',
        is_master: validatedData.is_master ?? false,
        workspace_id: validatedData.workspace_id || 'default',
        soul_md: validatedData.soul_md || null,
        user_md: validatedData.user_md || null,
        agents_md: validatedData.agents_md || null,
        model: validatedData.model || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create agent:', insertError);
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
    }

    // Log event
    const { error: eventError } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        type: 'agent_joined',
        agent_id: id,
        message: `${validatedData.name} joined the team`,
        created_at: now,
      });

    if (eventError) {
      console.error('Failed to log agent_joined event:', eventError);
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
