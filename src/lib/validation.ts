import { z } from 'zod';

// Task status and priority enums from types
const TaskStatus = z.enum([
  'planning',
  'inbox',
  'assigned',
  'in_progress',
  'testing',
  'review',
  'done'
]);

const TaskPriority = z.enum(['low', 'normal', 'high', 'urgent']);

const ActivityType = z.enum([
  'spawned',
  'updated',
  'completed',
  'file_created',
  'status_changed'
]);

const DeliverableType = z.enum(['file', 'url', 'artifact']);

// Task validation schemas
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  description: z.string().max(10000, 'Description must be 10000 characters or less').optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigned_agent_id: z.string().max(200).optional().nullable(),
  created_by_agent_id: z.string().max(200).optional().nullable(),
  business_id: z.string().optional(),
  workspace_id: z.string().min(1, 'workspace_id is required'),
  due_date: z.string().optional().nullable(),
  workflow_template_id: z.string().max(200).optional().nullable(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigned_agent_id: z.string().max(200).optional().nullable(),
  due_date: z.string().optional().nullable(),
  updated_by_agent_id: z.string().max(200).optional(),
  workflow_template_id: z.string().max(200).optional().nullable(),
  current_stage: z.number().int().min(1).optional().nullable(),
});

// Activity validation schema
export const CreateActivitySchema = z.object({
  activity_type: ActivityType,
  message: z.string().min(1, 'Message is required').max(5000, 'Message must be 5000 characters or less'),
  agent_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Deliverable validation schema
export const CreateDeliverableSchema = z.object({
  deliverable_type: DeliverableType,
  title: z.string().min(1, 'Title is required'),
  path: z.string().optional(),
  description: z.string().optional(),
});

// Event validation schema
export const CreateEventSchema = z.object({
  type: z.string().min(1, 'Type is required').max(50, 'Type must be 50 characters or less'),
  message: z.string().min(1, 'Message is required').max(10000, 'Message must be 10000 characters or less'),
  agent_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        return JSON.stringify(val).length <= 50000;
      },
      { message: 'Metadata must not exceed 50KB' }
    ),
});

// Agent validation schema
export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  role: z.string().min(1, 'Role is required').max(100, 'Role must be 100 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),
  avatar_emoji: z.string().max(10, 'Avatar emoji must be 10 characters or less').optional(),
  is_master: z.boolean().optional(),
  workspace_id: z.string().max(100, 'Workspace ID must be 100 characters or less').optional(),
  soul_md: z.string().max(50000, 'soul_md must be 50000 characters or less').optional(),
  user_md: z.string().max(50000, 'user_md must be 50000 characters or less').optional(),
  agents_md: z.string().max(50000, 'agents_md must be 50000 characters or less').optional(),
  model: z.string().max(50, 'Model must be 50 characters or less').optional(),
});

// Type exports for use in routes
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
export type CreateDeliverableInput = z.infer<typeof CreateDeliverableSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
