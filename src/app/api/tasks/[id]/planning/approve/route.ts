import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import type { PlanningQuestion, PlanningCategory } from '@/lib/types';

// Generate markdown spec from answered questions
function generateSpecMarkdown(task: { title: string; description?: string }, questions: PlanningQuestion[]): string {
  const lines: string[] = [];

  lines.push(`# ${task.title}`);
  lines.push('');
  lines.push('**Status:** SPEC LOCKED ✅');
  lines.push('');

  if (task.description) {
    lines.push('## Original Request');
    lines.push(task.description);
    lines.push('');
  }

  // Group questions by category
  const byCategory = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, PlanningQuestion[]>);

  const categoryLabels: Record<PlanningCategory, string> = {
    goal: '🎯 Goal & Success Criteria',
    audience: '👥 Target Audience',
    scope: '📋 Scope',
    design: '🎨 Design & Visual',
    content: '📝 Content',
    technical: '⚙️ Technical Requirements',
    timeline: '📅 Timeline',
    constraints: '⚠️ Constraints'
  };

  const categoryOrder: PlanningCategory[] = ['goal', 'audience', 'scope', 'design', 'content', 'technical', 'timeline', 'constraints'];

  for (const category of categoryOrder) {
    const categoryQuestions = byCategory[category];
    if (!categoryQuestions || categoryQuestions.length === 0) continue;

    lines.push(`## ${categoryLabels[category]}`);
    lines.push('');

    for (const q of categoryQuestions) {
      if (q.answer) {
        lines.push(`**${q.question}**`);
        lines.push(`> ${q.answer}`);
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push(`*Spec locked at ${new Date().toISOString()}*`);

  return lines.join('\n');
}

// POST /api/tasks/[id]/planning/approve - Lock spec and move to inbox
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const supabase = getSupabase();

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, description, status')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to get task:', taskError);
      return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if already locked
    const { data: existingSpec, error: specCheckError } = await supabase
      .from('planning_specs')
      .select('id')
      .eq('task_id', taskId)
      .maybeSingle();

    if (specCheckError) {
      console.error('Failed to check existing spec:', specCheckError);
      return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
    }

    if (existingSpec) {
      return NextResponse.json({ error: 'Spec already locked' }, { status: 400 });
    }

    // Get all questions
    const { data: questions, error: questionsError } = await supabase
      .from('planning_questions')
      .select('*')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });

    if (questionsError) {
      console.error('Failed to get planning questions:', questionsError);
      return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
    }

    const allQuestions = (questions ?? []) as PlanningQuestion[];

    // Check if all questions are answered
    const unanswered = allQuestions.filter(q => !q.answer);
    if (unanswered.length > 0) {
      return NextResponse.json({
        error: 'All questions must be answered before locking',
        unanswered: unanswered.length
      }, { status: 400 });
    }

    // options is JSONB in Supabase - already parsed, no JSON.parse needed
    const parsedQuestions = allQuestions.map(q => ({
      ...q,
      options: q.options ?? undefined,
    }));

    // Generate spec markdown
    const specMarkdown = generateSpecMarkdown(task, parsedQuestions);

    // Create spec record
    const specId = crypto.randomUUID();
    const { error: insertSpecError } = await supabase
      .from('planning_specs')
      .insert({
        id: specId,
        task_id: taskId,
        spec_markdown: specMarkdown,
        locked_at: new Date().toISOString(),
      });

    if (insertSpecError) {
      console.error('Failed to create planning spec:', insertSpecError);
      return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
    }

    // Update task description with spec and move to inbox
    const { error: updateTaskError } = await supabase
      .from('tasks')
      .update({
        description: specMarkdown,
        status: 'inbox',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateTaskError) {
      console.error('Failed to update task:', updateTaskError);
      return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
    }

    // Log activity
    const activityId = crypto.randomUUID();
    const { error: activityError } = await supabase
      .from('task_activities')
      .insert({
        id: activityId,
        task_id: taskId,
        activity_type: 'status_changed',
        message: 'Planning complete - spec locked and moved to inbox',
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    // Get the created spec
    const { data: spec, error: fetchSpecError } = await supabase
      .from('planning_specs')
      .select('*')
      .eq('id', specId)
      .single();

    if (fetchSpecError) {
      console.error('Failed to fetch created spec:', fetchSpecError);
      return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      spec,
      specMarkdown
    });
  } catch (error) {
    console.error('Failed to approve spec:', error);
    return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
  }
}
