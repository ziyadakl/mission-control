/**
 * Subagent Registration API
 * Register OpenClaw sub-agent sessions for tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * POST /api/tasks/[id]/subagent
 * Register a sub-agent session for a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();

    const { openclaw_session_id, agent_name } = body;

    if (!openclaw_session_id) {
      return NextResponse.json(
        { error: 'openclaw_session_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const sessionId = crypto.randomUUID();

    // Create a placeholder agent if agent_name is provided
    // Otherwise, we'll need to link to an existing agent
    let agentId: string | null = null;

    if (agent_name) {
      // Check if agent already exists
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('name', agent_name)
        .maybeSingle();

      if (existingAgent) {
        agentId = existingAgent.id;
      } else {
        // Create temporary sub-agent record
        agentId = crypto.randomUUID();
        const { error: agentError } = await supabase
          .from('agents')
          .insert({
            id: agentId,
            name: agent_name,
            role: 'Sub-Agent',
            description: 'Automatically created sub-agent',
            status: 'working',
          });

        if (agentError) {
          console.error('Error creating sub-agent:', agentError);
          return NextResponse.json(
            { error: 'Failed to create sub-agent' },
            { status: 500 }
          );
        }
      }
    }

    // Insert OpenClaw session record
    const { error: sessionError } = await supabase
      .from('openclaw_sessions')
      .insert({
        id: sessionId,
        agent_id: agentId,
        openclaw_session_id,
        session_type: 'subagent',
        task_id: taskId,
        status: 'active',
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to register sub-agent session' },
        { status: 500 }
      );
    }

    // Get the created session
    const { data: session, error: fetchError } = await supabase
      .from('openclaw_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      console.error('Error fetching created session:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch created session' },
        { status: 500 }
      );
    }

    // Broadcast agent spawned event
    broadcast({
      type: 'agent_spawned',
      payload: {
        taskId,
        sessionId: openclaw_session_id,
        agentName: agent_name,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error registering sub-agent:', error);
    return NextResponse.json(
      { error: 'Failed to register sub-agent' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/[id]/subagent
 * Get all sub-agent sessions for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = getSupabase();

    const { data: sessions, error } = await supabase
      .from('openclaw_sessions')
      .select('*, agents(name, avatar_emoji)')
      .eq('task_id', taskId)
      .eq('session_type', 'subagent')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sub-agents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sub-agents' },
        { status: 500 }
      );
    }

    return NextResponse.json(sessions ?? []);
  } catch (error) {
    console.error('Error fetching sub-agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-agents' },
      { status: 500 }
    );
  }
}
