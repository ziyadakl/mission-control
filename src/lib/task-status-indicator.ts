import type { Task, OpenClawSession } from '@/lib/types';
import type { PipelineStageInfo } from '@/lib/pipeline-utils';
import { formatDistanceToNow } from 'date-fns';

export interface TaskStatusIndicator {
  bgClass: string;
  borderClass: string;
  dotClass: string;
  textClass: string;
  label: string;
  sublabel?: string;
  pulse: boolean;
}

interface ColorClasses {
  bg: string;
  border: string;
  dot: string;
  text: string;
}

const COLORS: Record<string, ColorClasses> = {
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    dot: 'bg-purple-500',
    text: 'text-purple-400',
  },
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    dot: 'bg-gray-500',
    text: 'text-gray-400',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
    text: 'text-red-400',
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-500',
    text: 'text-yellow-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    dot: 'bg-orange-500',
    text: 'text-orange-400',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    dot: 'bg-cyan-500',
    text: 'text-cyan-400',
  },
};

function makeIndicator(
  color: string,
  label: string,
  pulse: boolean,
  sublabel?: string
): TaskStatusIndicator {
  const c = COLORS[color];
  return {
    bgClass: c.bg,
    borderClass: c.border,
    dotClass: c.dot,
    textClass: c.text,
    label,
    sublabel,
    pulse,
  };
}

function getAgentLabel(task: Task, pipelineInfo: PipelineStageInfo | null): string {
  const name = task.assigned_agent?.name ?? 'Agent';
  if (pipelineInfo && !pipelineInfo.isComplete) {
    return `${name} (${pipelineInfo.currentRole.display_name})`;
  }
  return name;
}

function getLastActiveSublabel(task: Task): string | undefined {
  if (!task.updated_at) return undefined;
  return `Last active ${formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}`;
}

export function getTaskStatusIndicator(
  task: Task,
  sessions: Record<string, OpenClawSession | null>,
  pipelineInfo: PipelineStageInfo | null
): TaskStatusIndicator | null {
  const hasAgent = !!task.assigned_agent_id;
  const hasSession = hasAgent && !!sessions[task.assigned_agent_id!];

  switch (task.status) {
    case 'planning':
      return makeIndicator('purple', 'Continue planning', true);

    case 'inbox':
      if (!hasAgent) {
        return makeIndicator('gray', 'Unassigned \u2014 needs agent', false);
      }
      return makeIndicator('gray', 'Ready for dispatch', false);

    case 'assigned':
      if (hasSession) {
        return makeIndicator('yellow', `${getAgentLabel(task, pipelineInfo)} \u2014 connected, preparing`, false);
      }
      return makeIndicator('red', `${getAgentLabel(task, pipelineInfo)} \u2014 waiting for dispatch`, false);

    case 'in_progress':
      if (hasSession) {
        return makeIndicator(
          'emerald',
          `${getAgentLabel(task, pipelineInfo)} working`,
          true,
          getLastActiveSublabel(task)
        );
      }
      return makeIndicator(
        'orange',
        `${getAgentLabel(task, pipelineInfo)} disconnected`,
        false,
        getLastActiveSublabel(task)
      );

    case 'testing':
      return makeIndicator('cyan', 'Testing deliverables...', false);

    case 'review':
      return makeIndicator('purple', 'Awaiting your review', false);

    case 'done':
      return null;

    default:
      return null;
  }
}
