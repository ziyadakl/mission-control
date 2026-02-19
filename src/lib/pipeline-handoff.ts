/**
 * Pipeline Handoff System
 *
 * Enables automatic cross-pipeline task creation when a pipeline completes.
 * This allows the job-hunt-mining pipeline to automatically spawn job-hunt-materials
 * tasks for each discovered job.
 *
 * Usage:
 * - Configure handoff rules in workflow_templates.handoff_config
 * - When a pipeline completes, check for handoff rules
 * - Spawn new tasks in the target pipeline with appropriate context
 */

import { getSupabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from './types';

export interface HandoffConfig {
  enabled: boolean;
  target_template_slug: string;
  create_task_per_deliverable?: boolean;
  task_title_template?: string;
  carry_over_deliverables?: boolean;
  require_approval?: boolean;
}

export interface HandoffResult {
  success: boolean;
  created_tasks?: Array<{
    task_id: string;
    title: string;
  }>;
  error?: string;
}

/**
 * Check if a template has handoff configuration
 */
export async function getHandoffConfig(
  templateId: string
): Promise<HandoffConfig | null> {
  const supabase = getSupabase();

  const { data: template, error } = await supabase
    .from('workflow_templates')
    .select('slug, handoff_config')
    .eq('id', templateId)
    .single();

  if (error || !template?.handoff_config) {
    return null;
  }

  return template.handoff_config as HandoffConfig;
}

/**
 * Execute pipeline handoff - create new task(s) in target pipeline
 */
export async function executePipelineHandoff(
  sourceTaskId: string,
  handoffConfig: HandoffConfig
): Promise<HandoffResult> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  try {
    // Fetch source task with deliverables
    const { data: sourceTask, error: taskError } = await supabase
      .from('tasks')
      .select('*, workflow_template:workflow_templates(id, slug), deliverables:task_deliverables(*)')
      .eq('id', sourceTaskId)
      .single();

    if (taskError || !sourceTask) {
      return {
        success: false,
        error: `Source task not found: ${taskError?.message}`,
      };
    }

    // Find target template
    const { data: targetTemplate, error: templateError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('slug', handoffConfig.target_template_slug)
      .single();

    if (templateError || !targetTemplate) {
      return {
        success: false,
        error: `Target template '${handoffConfig.target_template_slug}' not found`,
      };
    }

    // Get first role of target pipeline for initial assignment
    const { data: firstRole, error: roleError } = await supabase
      .from('workflow_roles')
      .select('role_slug')
      .eq('template_id', targetTemplate.id)
      .order('stage_order')
      .limit(1)
      .single();

    if (roleError || !firstRole) {
      return {
        success: false,
        error: `No roles found in target template`,
      };
    }

    // Find the agent for the first role
    const openclawAgentId = `${targetTemplate.slug}/${firstRole.role_slug}`;
    const { data: targetAgent, error: agentError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('openclaw_agent_id', openclawAgentId)
      .single();

    if (agentError || !targetAgent) {
      return {
        success: false,
        error: `Agent '${openclawAgentId}' not found. Was the template deployed?`,
      };
    }

    const createdTasks: Array<{ task_id: string; title: string }> = [];

    // Determine what to create tasks from
    if (handoffConfig.create_task_per_deliverable && sourceTask.deliverables?.length > 0) {
      // Create one task per deliverable (e.g., one materials task per discovered job)
      for (const deliverable of sourceTask.deliverables) {
        const taskId = uuidv4();
        const title = handoffConfig.task_title_template
          ? handoffConfig.task_title_template
              .replace('{{source_title}}', sourceTask.title)
              .replace('{{deliverable_title}}', deliverable.title)
              .replace('{{company_name}}', extractCompanyName(deliverable.title))
          : `Materials: ${deliverable.title}`;

        const { error: insertError } = await supabase.from('tasks').insert({
          id: taskId,
          title,
          description: `Tailored materials for: ${deliverable.description || deliverable.title}`,
          status: handoffConfig.require_approval ? 'planning' : 'assigned',
          priority: sourceTask.priority,
          assigned_agent_id: handoffConfig.require_approval ? null : targetAgent.id,
          created_by_agent_id: sourceTask.assigned_agent_id,
          workspace_id: sourceTask.workspace_id,
          workflow_template_id: targetTemplate.id,
          current_stage: 1,
          due_date: sourceTask.due_date,
          created_at: now,
          updated_at: now,
        });

        if (insertError) {
          console.error(`[Handoff] Failed to create task for deliverable ${deliverable.id}:`, insertError);
          continue;
        }

        // Link deliverable if carrying over
        if (handoffConfig.carry_over_deliverables) {
          await supabase.from('task_deliverables').insert({
            id: uuidv4(),
            task_id: taskId,
            deliverable_type: deliverable.deliverable_type,
            title: `Source: ${deliverable.title}`,
            path: deliverable.path,
            description: `From job discovery: ${deliverable.description}`,
            created_at: now,
          });
        }

        // Log handoff event
        await supabase.from('events').insert({
          id: uuidv4(),
          type: 'task_created',
          agent_id: sourceTask.assigned_agent_id,
          task_id: taskId,
          message: `Pipeline handoff: Created materials task from job discovery`,
          metadata: {
            source_task_id: sourceTaskId,
            source_pipeline: sourceTask.workflow_template?.slug,
            target_pipeline: targetTemplate.slug,
            handoff_type: 'per_deliverable',
          },
          created_at: now,
        });

        createdTasks.push({ task_id: taskId, title });
      }
    } else {
      // Create single task
      const taskId = uuidv4();
      const title = handoffConfig.task_title_template
        ? handoffConfig.task_title_template.replace('{{source_title}}', sourceTask.title)
        : `Materials for: ${sourceTask.title}`;

      const { error: insertError } = await supabase.from('tasks').insert({
        id: taskId,
        title,
        description: `Create tailored application materials for jobs discovered in: ${sourceTask.title}`,
        status: handoffConfig.require_approval ? 'planning' : 'assigned',
        priority: sourceTask.priority,
        assigned_agent_id: handoffConfig.require_approval ? null : targetAgent.id,
        created_by_agent_id: sourceTask.assigned_agent_id,
        workspace_id: sourceTask.workspace_id,
        workflow_template_id: targetTemplate.id,
        current_stage: 1,
        due_date: sourceTask.due_date,
        created_at: now,
        updated_at: now,
      });

      if (insertError) {
        return {
          success: false,
          error: `Failed to create handoff task: ${insertError.message}`,
        };
      }

      // Copy all deliverables if configured
      if (handoffConfig.carry_over_deliverables && sourceTask.deliverables?.length > 0) {
        for (const deliverable of sourceTask.deliverables) {
          await supabase.from('task_deliverables').insert({
            id: uuidv4(),
            task_id: taskId,
            deliverable_type: deliverable.deliverable_type,
            title: `Source: ${deliverable.title}`,
            path: deliverable.path,
            description: deliverable.description,
            created_at: now,
          });
        }
      }

      // Log handoff event
      await supabase.from('events').insert({
        id: uuidv4(),
        type: 'task_created',
        agent_id: sourceTask.assigned_agent_id,
        task_id: taskId,
        message: `Pipeline handoff: Created materials task from job discovery`,
        metadata: {
          source_task_id: sourceTaskId,
          source_pipeline: sourceTask.workflow_template?.slug,
          target_pipeline: targetTemplate.slug,
          handoff_type: 'single',
        },
        created_at: now,
      });

      createdTasks.push({ task_id: taskId, title });
    }

    return {
      success: true,
      created_tasks: createdTasks,
    };
  } catch (error) {
    console.error('[Handoff] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract company name from a job title or deliverable title
 * Handles formats like "Software Engineer at Google" or "Google - Software Engineer"
 */
function extractCompanyName(title: string): string {
  // Try "at Company" pattern
  const atMatch = title.match(/at\s+([^,-]+)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }

  // Try "Company - Role" pattern
  const dashMatch = title.match(/^([^-]+)\s*-/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }

  // Return full title if no pattern matches
  return title;
}

/**
 * Process pipeline completion - check for handoff and execute if configured.
 *
 * Only triggers the handoff when the completing task is on the FINAL stage of
 * its pipeline. Intermediate stage completions are ignored so that, for example,
 * stage 1 of job-hunt-mining does not prematurely spawn job-hunt-materials tasks.
 */
export async function processPipelineCompletion(
  taskId: string,
  templateId?: string
): Promise<HandoffResult | null> {
  if (!templateId) {
    return null;
  }

  const supabase = getSupabase();

  // Fetch the task to get its current_stage
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('current_stage')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    console.error('[Handoff] Could not fetch task for stage check:', taskError?.message);
    return null;
  }

  const currentStage: number | null = task.current_stage;

  // Count the total number of stages in this pipeline
  const { count, error: countError } = await supabase
    .from('workflow_roles')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', templateId);

  if (countError || count === null) {
    console.error('[Handoff] Could not count workflow_roles:', countError?.message);
    return null;
  }

  const totalStages = count;

  // Only trigger handoff when the final stage has completed.
  // If current_stage is null the task is not part of a staged pipeline — skip.
  if (currentStage === null || currentStage < totalStages) {
    console.log(
      `[Handoff] Skipping — stage ${currentStage ?? 'null'} of ${totalStages} for task ${taskId}`
    );
    return null;
  }

  const handoffConfig = await getHandoffConfig(templateId);

  if (!handoffConfig?.enabled) {
    return null;
  }

  return executePipelineHandoff(taskId, handoffConfig);
}