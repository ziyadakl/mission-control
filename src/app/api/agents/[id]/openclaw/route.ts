import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id]/openclaw - Get the agent's OpenClaw session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (agentError) {
      console.error('Failed to fetch agent:', agentError);
      return NextResponse.json({ error: 'Failed to get OpenClaw session' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('agent_id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (sessionError) {
      console.error('Failed to fetch OpenClaw session:', sessionError);
      return NextResponse.json({ error: 'Failed to get OpenClaw session' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ linked: false, session: null });
    }

    return NextResponse.json({ linked: true, session });
  } catch (error) {
    console.error('Failed to get OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Failed to get OpenClaw session' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/openclaw - Link agent to OpenClaw (creates session)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (agentError) {
      console.error('Failed to fetch agent:', agentError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if already linked
    const { data: existingSession, error: sessionFetchError } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('agent_id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (sessionFetchError) {
      console.error('Failed to fetch existing session:', sessionFetchError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (existingSession) {
      return NextResponse.json(
        { error: 'Agent is already linked to an OpenClaw session', session: existingSession },
        { status: 409 }
      );
    }

    // Connect to OpenClaw Gateway
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json(
          { error: 'Failed to connect to OpenClaw Gateway' },
          { status: 503 }
        );
      }
    }

    // OpenClaw creates sessions automatically when messages are sent
    // Just verify connection works by listing sessions
    try {
      await client.listSessions();
    } catch (err) {
      console.error('Failed to verify OpenClaw connection:', err);
      return NextResponse.json(
        { error: 'Connected but failed to communicate with OpenClaw Gateway' },
        { status: 503 }
      );
    }

    // Store the link in our database - session ID will be set when first message is sent
    // For now, use agent name as the session identifier
    const sessionId = uuidv4();
    const openclawSessionId = `mission-control-${id}-${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
    const now = new Date().toISOString();

    const { error: insertSessionError } = await supabase
      .from('openclaw_sessions')
      .insert({
        id: sessionId,
        agent_id: id,
        openclaw_session_id: openclawSessionId,
        channel: 'mission-control',
        status: 'active',
        created_at: now,
        updated_at: now,
      });

    if (insertSessionError) {
      console.error('Failed to insert OpenClaw session:', insertSessionError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Log event
    const { error: eventError } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        type: 'agent_status_changed',
        agent_id: id,
        message: `${agent.name} connected to OpenClaw Gateway`,
        created_at: now,
      });

    if (eventError) {
      console.error('Failed to log OpenClaw connect event:', eventError);
    }

    const { data: session, error: fetchSessionError } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchSessionError) {
      console.error('Failed to fetch newly created session:', fetchSessionError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ linked: true, session }, { status: 201 });
  } catch (error) {
    console.error('Failed to link agent to OpenClaw:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/openclaw - Unlink agent from OpenClaw
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (agentError) {
      console.error('Failed to fetch agent:', agentError);
      return NextResponse.json({ error: 'Failed to unlink agent from OpenClaw' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { data: existingSession, error: sessionFetchError } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('agent_id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (sessionFetchError) {
      console.error('Failed to fetch existing session:', sessionFetchError);
      return NextResponse.json({ error: 'Failed to unlink agent from OpenClaw' }, { status: 500 });
    }

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Agent is not linked to an OpenClaw session' },
        { status: 404 }
      );
    }

    // Mark the session as inactive
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('openclaw_sessions')
      .update({ status: 'inactive', updated_at: now })
      .eq('id', existingSession.id);

    if (updateError) {
      console.error('Failed to deactivate OpenClaw session:', updateError);
      return NextResponse.json({ error: 'Failed to unlink agent from OpenClaw' }, { status: 500 });
    }

    // Log event
    const { error: eventError } = await supabase
      .from('events')
      .insert({
        id: uuidv4(),
        type: 'agent_status_changed',
        agent_id: id,
        message: `${agent.name} disconnected from OpenClaw Gateway`,
        created_at: now,
      });

    if (eventError) {
      console.error('Failed to log OpenClaw disconnect event:', eventError);
    }

    return NextResponse.json({ linked: false, success: true });
  } catch (error) {
    console.error('Failed to unlink agent from OpenClaw:', error);
    return NextResponse.json(
      { error: 'Failed to unlink agent from OpenClaw' },
      { status: 500 }
    );
  }
}
