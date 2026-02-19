import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import type { Workspace, WorkspaceStats, TaskStatus } from '@/lib/types';

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/workspaces - List all workspaces with stats
export async function GET(request: NextRequest) {
  const includeStats = request.nextUrl.searchParams.get('stats') === 'true';

  try {
    const supabase = getSupabase();

    if (includeStats) {
      // Fetch all workspaces first
      const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .order('name', { ascending: true });

      if (wsError) {
        console.error('Failed to fetch workspaces:', wsError);
        return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
      }

      // Build stats for each workspace in parallel
      const stats: WorkspaceStats[] = await Promise.all(
        (workspaces as Workspace[]).map(async (workspace) => {
          // Task counts by status via RPC
          const { data: taskCountRows, error: tcError } = await supabase.rpc(
            'get_workspace_stats',
            { p_workspace_id: workspace.id }
          );

          const counts: WorkspaceStats['taskCounts'] = {
            planning: 0,
            inbox: 0,
            assigned: 0,
            in_progress: 0,
            testing: 0,
            review: 0,
            done: 0,
            total: 0,
          };

          if (!tcError && taskCountRows) {
            (taskCountRows as { status: TaskStatus; count: number }[]).forEach((row) => {
              counts[row.status] = row.count;
              counts.total += row.count;
            });
          }

          // Agent count using count: 'exact' head query
          const { count: agentCount, error: acError } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id);

          return {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            taskCounts: counts,
            agentCount: acError ? 0 : (agentCount ?? 0),
          };
        })
      );

      return NextResponse.json(stats);
    }

    // Simple listing without stats
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to fetch workspaces:', error);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const id = crypto.randomUUID();
    const slug = generateSlug(name);

    // Check if slug already exists
    const { data: existing, error: checkError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (checkError) {
      console.error('Failed to check slug uniqueness:', checkError);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: 'A workspace with this name already exists' }, { status: 400 });
    }

    const { data: workspace, error: insertError } = await supabase
      .from('workspaces')
      .insert({
        id,
        name: name.trim(),
        slug,
        description: description ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert workspace:', insertError);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error('Failed to create workspace:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
