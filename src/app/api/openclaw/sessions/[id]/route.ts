import { NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { getSupabase } from '@/lib/db';
import { broadcast } from '@/lib/events';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/openclaw/sessions/[id] - Get session details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // List sessions and find the one with matching ID
    const sessions = await client.listSessions();
    const session = sessions.find((s) => s.id === id);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Failed to get OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/openclaw/sessions/[id] - Send a message to the session
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

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

    // Prefix message with [Mission Control] so the agent knows the source
    const prefixedContent = `[Mission Control] ${content}`;
    await client.sendMessage(id, prefixedContent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send message to OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/openclaw/sessions/[id] - Update session status (for completing sub-agents)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, ended_at } = body;

    const supabase = getSupabase();

    // Find session by DB id first, then fall back to openclaw_session_id
    let session = null;
    let findError = null;

    // Try DB UUID first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) {
      const result = await supabase
        .from('openclaw_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      session = result.data;
      findError = result.error;
    }

    // Fall back to openclaw_session_id
    if (!session && !findError) {
      const result = await supabase
        .from('openclaw_sessions')
        .select('*')
        .eq('openclaw_session_id', id)
        .limit(1)
        .maybeSingle();
      session = result.data;
      findError = result.error;
    }

    if (findError) {
      console.error('Failed to find session:', findError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found in database' },
        { status: 404 }
      );
    }

    // Build update payload — only include provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) updates.status = status;
    if (ended_at !== undefined) updates.ended_at = ended_at;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('openclaw_sessions')
      .update(updates)
      .eq('id', session.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // If status changed to completed, update the agent status too
    if (status === 'completed') {
      if (session.agent_id) {
        await supabase
          .from('agents')
          .update({ status: 'idle' })
          .eq('id', session.agent_id);
      }
      if (session.task_id) {
        broadcast({
          type: 'agent_completed',
          payload: {
            taskId: session.task_id,
            sessionId: id,
          },
        });
      }
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Failed to update OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/openclaw/sessions/[id] - Delete a session and its associated agent
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Find session by openclaw_session_id first
    const { data: bySessionId, error: findError } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('openclaw_session_id', id)
      .maybeSingle();

    if (findError) {
      console.error('Failed to find session by openclaw_session_id:', findError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    let session = bySessionId;

    // If not found by openclaw_session_id, try internal id
    if (!session) {
      const { data: byId, error: byIdError } = await supabase
        .from('openclaw_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (byIdError) {
        console.error('Failed to find session by internal id:', byIdError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      session = byId;
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const taskId = session.task_id;
    const agentId = session.agent_id;

    // Delete the session
    const { error: deleteError } = await supabase
      .from('openclaw_sessions')
      .delete()
      .eq('id', session.id);

    if (deleteError) {
      console.error('Failed to delete session:', deleteError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Handle associated agent cleanup
    if (agentId) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .maybeSingle();

      if (!agentError && agent) {
        if (agent.role === 'Sub-Agent') {
          // Auto-created sub-agent — remove it entirely
          await supabase.from('agents').delete().eq('id', agentId);
        } else {
          // Persistent agent — reset back to idle
          await supabase
            .from('agents')
            .update({ status: 'idle' })
            .eq('id', agentId);
        }
      }
    }

    // Broadcast deletion event
    broadcast({
      type: 'agent_completed',
      payload: {
        taskId,
        sessionId: id,
        deleted: true,
      },
    });

    return NextResponse.json({ success: true, deleted: session.id });
  } catch (error) {
    console.error('Failed to delete OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
