import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/templates/[id] - Get a single template with roles
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    const { data: template, error } = await supabase
      .from('workflow_templates')
      .select('*, roles:workflow_roles(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch template:', error);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PATCH /api/templates/[id] - Update a template
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body = await request.json();

    // Check if template exists
    const { data: existing, error: fetchError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch template:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Build update object from provided fields
    const updateFields: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateFields.name = body.name;
    }
    if (body.slug !== undefined) {
      // Validate slug is URL-safe
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(body.slug)) {
        return NextResponse.json(
          { error: 'Slug must be URL-safe: lowercase alphanumeric characters and hyphens only' },
          { status: 400 }
        );
      }
      updateFields.slug = body.slug;
    }
    if (body.description !== undefined) {
      updateFields.description = body.description;
    }
    if (body.category !== undefined) {
      updateFields.category = body.category;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updateFields.updated_at = new Date().toISOString();

    const { data: template, error: updateError } = await supabase
      .from('workflow_templates')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update template:', updateError);
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'A template with this slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    // Check if template exists
    const { data: existing, error: fetchError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch template:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Prevent deletion of built-in templates
    if (existing.is_builtin) {
      return NextResponse.json({ error: 'Cannot delete built-in templates' }, { status: 400 });
    }

    // Delete template (roles cascade via FK)
    const { error: deleteError } = await supabase
      .from('workflow_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete template:', deleteError);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
