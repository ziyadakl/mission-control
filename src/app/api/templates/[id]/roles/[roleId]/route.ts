import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string; roleId: string }>;
}

// PATCH /api/templates/[id]/roles/[roleId] - Update a role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id, roleId } = await params;
    const body = await request.json();

    // Verify the role exists and belongs to this template
    const { data: existing, error: fetchError } = await supabase
      .from('workflow_roles')
      .select('*')
      .eq('id', roleId)
      .eq('template_id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch role:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Build update object from provided fields
    const updateFields: Record<string, unknown> = {};

    if (body.role_slug !== undefined) updateFields.role_slug = body.role_slug;
    if (body.display_name !== undefined) updateFields.display_name = body.display_name;
    if (body.emoji !== undefined) updateFields.emoji = body.emoji;
    if (body.identity_text !== undefined) updateFields.identity_text = body.identity_text;
    if (body.soul_text !== undefined) updateFields.soul_text = body.soul_text;
    if (body.model_primary !== undefined) updateFields.model_primary = body.model_primary;
    if (body.model_fallbacks !== undefined) updateFields.model_fallbacks = body.model_fallbacks;
    if (body.tool_profile !== undefined) updateFields.tool_profile = body.tool_profile;
    if (body.tools_allow !== undefined) updateFields.tools_allow = body.tools_allow;
    if (body.tools_deny !== undefined) updateFields.tools_deny = body.tools_deny;
    if (body.stage_order !== undefined) updateFields.stage_order = body.stage_order;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: role, error: updateError } = await supabase
      .from('workflow_roles')
      .update(updateFields)
      .eq('id', roleId)
      .eq('template_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update role:', updateError);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error('Failed to update role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// DELETE /api/templates/[id]/roles/[roleId] - Delete a role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id, roleId } = await params;

    // Check the template is not built-in
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('is_builtin')
      .eq('id', id)
      .maybeSingle();

    if (templateError) {
      console.error('Failed to fetch template:', templateError);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.is_builtin) {
      return NextResponse.json({ error: 'Cannot delete roles from built-in templates' }, { status: 400 });
    }

    // Verify role exists and belongs to this template
    const { data: existing, error: fetchError } = await supabase
      .from('workflow_roles')
      .select('id')
      .eq('id', roleId)
      .eq('template_id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch role:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('workflow_roles')
      .delete()
      .eq('id', roleId)
      .eq('template_id', id);

    if (deleteError) {
      console.error('Failed to delete role:', deleteError);
      return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
