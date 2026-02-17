import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/templates/[id]/roles - List roles for a template
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (templateError) {
      console.error('Failed to fetch template:', templateError);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: roles, error } = await supabase
      .from('workflow_roles')
      .select('*')
      .eq('template_id', id)
      .order('stage_order');

    if (error) {
      console.error('Failed to fetch roles:', error);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    return NextResponse.json(roles);
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// POST /api/templates/[id]/roles - Add a role to a template
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body = await request.json();

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (templateError) {
      console.error('Failed to fetch template:', templateError);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Auto-set stage_order to max + 1
    const { data: maxRow, error: maxError } = await supabase
      .from('workflow_roles')
      .select('stage_order')
      .eq('template_id', id)
      .order('stage_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error('Failed to determine stage_order:', maxError);
      return NextResponse.json({ error: 'Failed to determine stage order' }, { status: 500 });
    }

    const nextOrder = maxRow ? maxRow.stage_order + 1 : 1;

    const roleId = uuidv4();
    const now = new Date().toISOString();

    const { data: role, error: insertError } = await supabase
      .from('workflow_roles')
      .insert({
        id: roleId,
        template_id: id,
        stage_order: nextOrder,
        role_slug: body.role_slug,
        display_name: body.display_name,
        emoji: body.emoji || '🤖',
        identity_text: body.identity_text || '',
        soul_text: body.soul_text || '',
        model_primary: body.model_primary || 'z.ai/glm-4.7',
        model_fallbacks: body.model_fallbacks || ['openrouter/openrouter/auto'],
        tool_profile: body.tool_profile || 'coding',
        tools_allow: body.tools_allow || [],
        tools_deny: body.tools_deny || [],
        created_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create role:', insertError);
      return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error('Failed to create role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
