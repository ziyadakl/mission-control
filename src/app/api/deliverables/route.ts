/**
 * Workspace-level Deliverables API
 * Fetches recent deliverables across all tasks in a workspace, with task info joined.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/deliverables?workspace_id=X&limit=20
 * Retrieve recent deliverables across all tasks in a workspace.
 * Returns TaskDeliverable[] with nested task: { id, title, status, workspace_id }.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id query parameter is required' },
        { status: 400 }
      );
    }

    const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Number.isNaN(rawLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('task_deliverables')
      .select('*, task:tasks!inner(id, title, status, workspace_id)')
      .eq('task.workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching workspace deliverables:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // PostgREST inner-join filtering via .eq on a joined table can return rows
    // with a null task object for non-matching workspace rows. Filter those out.
    const filtered = (data || []).filter((d) => d.task !== null);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching workspace deliverables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliverables' },
      { status: 500 }
    );
  }
}
