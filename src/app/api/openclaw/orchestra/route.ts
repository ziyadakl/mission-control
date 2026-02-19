import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

interface OrchestraStatusResponse {
  hasOtherOrchestrators: boolean;
  orchestratorCount: number;
  workspaceId?: string;
  orchestrators?: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
  }>;
}

/**
 * GET /api/openclaw/orchestra
 *
 * Checks if there are other orchestrators (master agents) available in the project/workspace.
 * Returns true if there are additional master agents beyond the default one.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || 'default';

    const supabase = getSupabase();

    // Get all master agents in the workspace that are not offline, ordered by creation date
    const { data: orchestrators, error } = await supabase
      .from('agents')
      .select('id, name, role, status')
      .eq('is_master', true)
      .eq('workspace_id', workspaceId)
      .neq('status', 'offline')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch orchestrators:', error);
      return NextResponse.json<OrchestraStatusResponse>(
        { hasOtherOrchestrators: false, orchestratorCount: 0 },
        { status: 500 }
      );
    }

    // Exclude the default (first-created) master agent from the count
    const additionalOrchestrators = (orchestrators ?? []).slice(1);
    const hasOtherOrchestrators = additionalOrchestrators.length > 0;

    return NextResponse.json<OrchestraStatusResponse>({
      hasOtherOrchestrators,
      orchestratorCount: additionalOrchestrators.length,
      workspaceId,
      orchestrators: additionalOrchestrators,
    });
  } catch (error) {
    console.error('Failed to check orchestra status:', error);
    return NextResponse.json<OrchestraStatusResponse>(
      {
        hasOtherOrchestrators: false,
        orchestratorCount: 0,
      },
      { status: 500 }
    );
  }
}
