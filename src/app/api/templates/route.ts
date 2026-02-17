import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/db';

// GET /api/templates - List all templates (with roles joined)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const deployed = request.nextUrl.searchParams.get('deployed');

    let query = supabase
      .from('workflow_templates')
      .select('*, roles:workflow_roles(*)')
      .order('created_at');

    if (deployed === 'true') {
      query = query.eq('is_deployed', true);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Failed to fetch templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { name, slug, description, category } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate slug is URL-safe (lowercase alphanumeric + hyphens)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be URL-safe: lowercase alphanumeric characters and hyphens only' },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const { data: template, error: insertError } = await supabase
      .from('workflow_templates')
      .insert({
        id,
        name,
        slug,
        description: description || null,
        category: category || 'custom',
        is_deployed: false,
        is_builtin: false,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create template:', insertError);
      // Check for unique constraint violation on slug
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'A template with this slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
