import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { deployTemplate } from '@/lib/openclaw/deploy';
import type { DeployRole } from '@/lib/openclaw/deploy';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/templates/[id]/deploy - Deploy a template to OpenClaw
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    // 1. Load template with roles
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('*, roles:workflow_roles(*)')
      .eq('id', id)
      .maybeSingle();

    if (templateError) {
      console.error('Failed to fetch template for deploy:', templateError);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // 2. Validate template has roles
    const roles = template.roles || [];
    if (roles.length === 0) {
      return NextResponse.json(
        { error: 'Template has no roles defined. Add at least one role before deploying.' },
        { status: 400 }
      );
    }

    // 3. Map DB roles to DeployRole shape
    const deployRoles: DeployRole[] = roles.map((r: Record<string, unknown>) => ({
      role_slug: r.role_slug as string,
      display_name: r.display_name as string,
      identity_text: (r.identity_text as string) || '',
      soul_text: (r.soul_text as string) || '',
      model_primary: (r.model_primary as string) || 'z.ai/glm-4.7',
      tool_profile: (r.tool_profile as string) || 'coding',
      tools_allow: (r.tools_allow as string[]) || [],
      tools_deny: (r.tools_deny as string[]) || [],
    }));

    // 4. Deploy to OpenClaw via SSH
    console.log(`[Deploy] Starting deployment of template "${template.name}" (${template.slug}) with ${deployRoles.length} roles`);
    const deployResults = await deployTemplate(template.slug, deployRoles);
    console.log(`[Deploy] Deployment complete:`, deployResults);

    // 5. Mark template as deployed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('workflow_templates')
      .update({
        is_deployed: true,
        deployed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update template deploy status:', updateError);
      // Deployment succeeded on the server, so we log but don't fail the request
    }

    // 6. Seed agent records into MC's agents table (upsert for idempotent re-deploys)
    const defaultWorkspaceId = 'ws-openclaw';

    for (const role of roles) {
      const agentId = `${template.slug}-${role.role_slug}`;
      const openclawAgentId = `${template.slug}/${role.role_slug}`;

      const { error: upsertError } = await supabase
        .from('agents')
        .upsert(
          {
            id: agentId,
            name: role.display_name,
            role: `${template.name}: ${role.display_name}`,
            avatar_emoji: role.emoji || '🤖',
            openclaw_agent_id: openclawAgentId,
            model: role.model_primary || 'z.ai/glm-4.7',
            workspace_id: defaultWorkspaceId,
            status: 'idle',
            is_master: false,
            created_at: now,
            updated_at: now,
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false,
          }
        )
        .select();

      if (upsertError) {
        console.error(`Failed to upsert agent record for ${agentId}:`, upsertError);
        // Non-fatal: deployment already succeeded, agent record is secondary
      }
    }

    return NextResponse.json({
      success: true,
      template_id: id,
      template_slug: template.slug,
      deployed_roles: deployRoles.length,
      results: deployResults,
      deployed_at: now,
    });
  } catch (error) {
    console.error('Template deployment failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown deployment error';
    return NextResponse.json(
      { error: `Deployment failed: ${message}` },
      { status: 500 }
    );
  }
}
