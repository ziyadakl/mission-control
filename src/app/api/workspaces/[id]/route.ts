import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

// GET /api/workspaces/[id] - Get a single workspace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    // Try to find by ID first, then by slug
    const { data: byId, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch workspace by id:', error);
      return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
    }

    let workspace = byId;

    // If not found by ID, try slug
    if (!workspace) {
      const { data: bySlug, error: slugError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('slug', id)
        .maybeSingle();

      if (slugError) {
        console.error('Failed to fetch workspace by slug:', slugError);
        return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
      }

      workspace = bySlug;
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Failed to fetch workspace:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

// PATCH /api/workspaces/[id] - Update a workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, description, icon } = body;

    const supabase = getSupabase();

    // Check workspace exists
    const { data: existing, error: checkError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Failed to check workspace existence:', checkError);
      return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Build update payload dynamically — only include provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;

    if (Object.keys(updates).length === 1) {
      // Only updated_at was added — nothing meaningful to update
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: workspace, error: updateError } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update workspace:', updateError);
      return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Failed to update workspace:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] - Delete a workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Don't allow deleting the default workspace
    if (id === 'default') {
      return NextResponse.json({ error: 'Cannot delete the default workspace' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check workspace exists
    const { data: existing, error: checkError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Failed to check workspace existence:', checkError);
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check task count
    const { count: taskCount, error: tcError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', id);

    if (tcError) {
      console.error('Failed to count tasks:', tcError);
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }

    // Check agent count
    const { count: agentCount, error: acError } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', id);

    if (acError) {
      console.error('Failed to count agents:', acError);
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }

    if ((taskCount ?? 0) > 0 || (agentCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete workspace with existing tasks or agents',
          taskCount: taskCount ?? 0,
          agentCount: agentCount ?? 0,
        },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete workspace:', deleteError);
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
