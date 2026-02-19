import { Task, WorkflowTemplate, WorkflowRole } from './types';

/**
 * Resolved pipeline stage information for a task.
 * All fields are derived purely from task data and the templates list —
 * no async work, no side effects.
 */
export interface PipelineStageInfo {
  /** Human-readable name of the workflow template (e.g. "Software Development") */
  templateName: string;
  /** The task's current stage index, 1-indexed. Defaults to 1 when task.current_stage is unset. */
  currentStage: number;
  /** Total number of roles (stages) in the template. */
  totalStages: number;
  /** The WorkflowRole corresponding to currentStage. */
  currentRole: WorkflowRole;
  /** All roles in the template, sorted ascending by stage_order. */
  roles: WorkflowRole[];
  /** True when the task status is 'done' or 'review'. */
  isComplete: boolean;
}

/**
 * Resolve pipeline stage information for a task given a list of workflow templates.
 *
 * Returns null when:
 *  - The task has no workflow_template_id, or
 *  - No matching template is found in the provided list, or
 *  - The matched template has no roles.
 *
 * @param task      - The task to resolve pipeline info for.
 * @param templates - Full list of available WorkflowTemplate objects (with roles populated).
 */
export function getPipelineStageInfo(
  task: Task,
  templates: WorkflowTemplate[]
): PipelineStageInfo | null {
  // Task must be linked to a template.
  if (!task.workflow_template_id) {
    return null;
  }

  // Find the matching template.
  const template = templates.find((t) => t.id === task.workflow_template_id);
  if (!template) {
    return null;
  }

  // Template must have at least one role.
  const rawRoles = template.roles;
  if (!rawRoles || rawRoles.length === 0) {
    return null;
  }

  // Sort roles by stage_order ascending so index arithmetic is safe.
  const roles = [...rawRoles].sort((a, b) => a.stage_order - b.stage_order);

  const totalStages = roles.length;

  // current_stage is 1-indexed; default to 1 when absent.
  // Clamp to [1, totalStages] to guard against stale/bad data.
  const rawStage = task.current_stage ?? 1;
  const currentStage = Math.max(1, Math.min(rawStage, totalStages));

  // Convert 1-indexed stage to 0-indexed array position.
  const currentRole = roles[currentStage - 1];

  const isComplete = task.status === 'done' || task.status === 'review';

  return {
    templateName: template.name,
    currentStage,
    totalStages,
    currentRole,
    roles,
    isComplete,
  };
}
