# Template-Based Pipeline System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Mission Control to create and deploy workflow templates as real OpenClaw pipeline agents, supporting any task type beyond the 4 hardcoded code pipelines.

**Architecture:** Templates stored in Supabase define agent roles with identity, soul, tools, and model. A deploy API SSHs to the VPS and uses `openclaw agents add` CLI + workspace file writes to create real agents. Tasks reference templates and dispatch through OpenClaw's native agent-to-agent routing.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL), OpenClaw CLI, SSH (via child_process), TypeScript

**MC Codebase:** `/Users/ziyadakl/Desktop/Automation/Cursor-VS/openclaw-mission-control/`
**Design Doc:** `/Users/ziyadakl/Desktop/Automation/Cursor-VS/openclaw/docs/plans/2026-02-17-template-based-pipelines-design.md`

---

### Task 1: Database Schema — Create Template Tables

**Files:**
- Apply via Supabase MCP `apply_migration`

**Step 1: Apply migration**

```sql
-- workflow_templates: defines reusable pipeline workflows
CREATE TABLE workflow_templates (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  category text DEFAULT 'custom',
  is_deployed boolean DEFAULT false,
  is_builtin boolean DEFAULT false,
  deployed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- workflow_roles: defines agent roles within a template
CREATE TABLE workflow_roles (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  template_id text NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  stage_order int NOT NULL,
  role_slug text NOT NULL,
  display_name text NOT NULL,
  emoji text DEFAULT '🤖',
  identity_text text DEFAULT '',
  soul_text text DEFAULT '',
  model_primary text DEFAULT 'z.ai/glm-4.7',
  model_fallbacks jsonb DEFAULT '["openrouter/openrouter/auto"]',
  tool_profile text DEFAULT 'coding',
  tools_allow jsonb DEFAULT '[]',
  tools_deny jsonb DEFAULT '["gateway","cron","message","nodes","canvas","sessions_spawn","sessions_send","image","tts","group:ui"]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, role_slug),
  UNIQUE(template_id, stage_order)
);

-- Add template reference to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_template_id text REFERENCES workflow_templates(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_stage int;
```

**Step 2: Verify tables exist**

Query via Supabase MCP: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'workflow%';`

**Step 3: Commit** (no local files changed — migration is remote)

---

### Task 2: Import Existing Pipelines as Built-in Templates

**Files:**
- Apply via Supabase MCP `execute_sql`

**Step 1: Insert the 4 existing pipelines as built-in templates**

Insert `workflow_templates` records for feature-dev, bug-fix, security-audit, job-hunt-mining with `is_builtin: true, is_deployed: true`.

Insert `workflow_roles` for each template matching the existing agents in `openclaw.json`. Copy identity_text and soul_text from existing workspace files on VPS via SSH:
```bash
ssh openclaw "cat ~/.openclaw/workspaces/workflows/feature-dev/agents/planner/IDENTITY.md"
```

For each of the 25 pipeline agents, create a workflow_role with the correct stage_order, tools_allow, tools_deny matching the openclaw.json config.

**Step 2: Verify** — Query `SELECT t.name, count(r.id) FROM workflow_templates t JOIN workflow_roles r ON r.template_id = t.id GROUP BY t.name;` — should show 4 templates with correct role counts.

---

### Task 3: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add types**

Add to `src/lib/types.ts`:

```typescript
export type TemplateCategory = 'development' | 'research' | 'content' | 'operations' | 'custom';

export interface WorkflowTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: TemplateCategory;
  is_deployed: boolean;
  is_builtin: boolean;
  deployed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  roles?: WorkflowRole[];
}

export interface WorkflowRole {
  id: string;
  template_id: string;
  stage_order: number;
  role_slug: string;
  display_name: string;
  emoji: string;
  identity_text: string;
  soul_text: string;
  model_primary: string;
  model_fallbacks: string[];
  tool_profile: string;
  tools_allow: string[];
  tools_deny: string[];
  created_at: string;
}
```

Add to `Task` interface:
```typescript
workflow_template_id?: string;
current_stage?: number;
workflow_template?: WorkflowTemplate;
```

**Step 2: Build check** — `cd /path/to/mc && npx tsc --noEmit`

**Step 3: Commit**

---

### Task 4: Template CRUD API

**Files:**
- Create: `src/app/api/templates/route.ts` (GET list, POST create)
- Create: `src/app/api/templates/[id]/route.ts` (GET one, PATCH update, DELETE)
- Create: `src/app/api/templates/[id]/roles/route.ts` (GET roles, POST add role)
- Create: `src/app/api/templates/[id]/roles/[roleId]/route.ts` (PATCH, DELETE role)

**Step 1: Implement list/create** (`src/app/api/templates/route.ts`)

GET: `supabase.from('workflow_templates').select('*, roles:workflow_roles(*)').order('created_at')`
POST: Validate name+slug uniqueness, insert template, return with 201.

**Step 2: Implement single template** (`src/app/api/templates/[id]/route.ts`)

GET: Select with roles joined. PATCH: Update fields. DELETE: Cascade deletes roles.

**Step 3: Implement role CRUD** (roles routes)

Standard CRUD. POST auto-sets stage_order to max+1. PATCH allows reordering.

**Step 4: Build check + manual test via curl**

**Step 5: Commit**

---

### Task 5: Template Deploy API

**Files:**
- Create: `src/app/api/templates/[id]/deploy/route.ts`
- Create: `src/lib/openclaw/deploy.ts` (SSH deployment logic)

**Step 1: Create deployment utility** (`src/lib/openclaw/deploy.ts`)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SSH_HOST = process.env.OPENCLAW_SSH_HOST || 'openclaw';
const OPENCLAW_BASE = '~/.openclaw';
const WORKFLOWS_BASE = `${OPENCLAW_BASE}/workspaces/workflows`;

export async function sshExec(command: string): Promise<string> {
  const { stdout } = await execAsync(`ssh ${SSH_HOST} "${command.replace(/"/g, '\\"')}"`);
  return stdout.trim();
}

export async function deployTemplate(template: WorkflowTemplate, roles: WorkflowRole[]) {
  const results: string[] = [];

  for (const role of roles) {
    const agentId = `${template.slug}/${role.role_slug}`;
    const workspaceDir = `${WORKFLOWS_BASE}/${template.slug}/agents/${role.role_slug}`;
    const agentDir = `${OPENCLAW_BASE}/agents/${template.slug}-${role.role_slug}/agent`;

    // Create workspace dir
    await sshExec(`mkdir -p ${workspaceDir}`);

    // Write IDENTITY.md
    await sshExec(`cat > ${workspaceDir}/IDENTITY.md << 'IDENTITYEOF'\n${role.identity_text}\nIDENTITYEOF`);

    // Write SOUL.md
    await sshExec(`cat > ${workspaceDir}/SOUL.md << 'SOULEOF'\n${role.soul_text}\nSOULEOF`);

    // Add agent via CLI
    await sshExec(`openclaw agents add "${agentId}" --workspace ${workspaceDir} --model ${role.model_primary} --non-interactive`);

    // Update tools config via jq (tool_profile, deny, allow)
    // ... jq commands to update openclaw.json ...

    results.push(`Deployed ${agentId}`);
  }

  // Update tools.agentToAgent.allow list
  // Restart gateway
  await sshExec('pkill -f openclaw-gateway; sleep 1; nohup openclaw gateway &');

  return results;
}
```

**Step 2: Create deploy route** (`src/app/api/templates/[id]/deploy/route.ts`)

POST handler that:
1. Loads template + roles from DB
2. Calls `deployTemplate()`
3. Updates `is_deployed = true, deployed_at = now()` in DB
4. Seeds new agents into MC's `agents` table
5. Returns deployment results

**Step 3: Manual test** — Create a test template, deploy via curl, verify agents appear in `openclaw agents list --json` on VPS.

**Step 4: Commit**

---

### Task 6: Task Creation UI — Template Selector

**Files:**
- Modify: `src/components/TaskModal.tsx` (or equivalent task creation component)

**Step 1: Add template dropdown**

Fetch deployed templates via `/api/templates?deployed=true`.
Add a select/dropdown before the agent assignment field.
When template selected, auto-suggest first-stage agent for assignment.

**Step 2: Verify in browser** — Create task with template selected, confirm `workflow_template_id` saved.

**Step 3: Commit**

---

### Task 7: Template Management Page

**Files:**
- Create: `src/app/templates/page.tsx` (template list + create)
- Create: `src/components/TemplateEditor.tsx` (role editor)

**Step 1: Template list page**

Grid/list of templates showing name, category, role count, deployment status.
"Create Template" button opens editor.
"Deploy" button triggers `/api/templates/[id]/deploy`.

**Step 2: Template/role editor**

Form for template metadata (name, slug, category, description).
Sortable list of roles with:
- Role slug, display name, emoji
- Identity text (textarea/markdown editor)
- Soul text (textarea)
- Model selector (dropdown of available models from config)
- Tool profile selector + allow/deny checkboxes

**Step 3: Build check + visual verification in browser**

**Step 4: Commit**

---

### Task 8: Sidebar Dynamic Grouping

**Files:**
- Modify: `src/components/AgentsSidebar.tsx`

**Step 1: Make GROUP_ORDER dynamic**

Instead of hardcoded `GROUP_ORDER`, fetch deployed templates and derive groups:

```typescript
const getGroup = (agent: Agent): string => {
  const id = agent.openclaw_agent_id || '';
  if (id === 'main' || id === 'worker') return 'Core';
  const prefix = id.split('/')[0];
  // Map known prefixes to display names
  const prefixMap: Record<string, string> = {
    'feature-dev': 'Feature Dev',
    'security-audit': 'Security Audit',
    'job-hunt-mining': 'Job Hunt',
    'bug-fix': 'Bug Fix',
    // Dynamic: any other prefix becomes title-cased
  };
  return prefixMap[prefix] || prefix.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
};
```

Remove hardcoded `GROUP_ORDER`, derive it from actual agent IDs.

**Step 2: Verify** — Deploy a test template, confirm new group appears in sidebar.

**Step 3: Commit**

---

### Task 9: Stage Tracking in Dispatch

**Files:**
- Modify: `src/app/api/tasks/[id]/dispatch/route.ts`

**Step 1: Track current stage on dispatch**

When dispatching a task with `workflow_template_id`:
- Look up the template's roles
- Set `current_stage = 1` (or the stage matching the assigned agent)
- Include stage info in the dispatch message

**Step 2: Add stage progression webhook**

When an agent completes its stage, the next-stage agent should be auto-assigned.
Modify the task update endpoint: when `current_stage` changes, update `assigned_agent_id` to the next stage's agent.

**Step 3: Commit**

---

### Task 10: Deploy + E2E Test

**Step 1: Build locally** — `npm run build`, verify 0 errors

**Step 2: rsync to VPS** — `rsync -avz --exclude node_modules --exclude .next /path/to/mc/ openclaw:/home/deploy/mission-control/`

**Step 3: Build on VPS** — `ssh openclaw "cd ~/mission-control && npm install && npm run build"`

**Step 4: Restart service** — `ssh openclaw "sudo systemctl restart mission-control"`

**Step 5: E2E test sequence:**
1. Open MC UI → navigate to Templates page
2. Create "Research" template with 4 roles (discoverer, analyst, synthesizer, reporter)
3. Fill in identity + soul text for each role
4. Click Deploy → verify agents created on VPS (`openclaw agents list --json`)
5. Create a task → select "Research" template
6. Assign to first stage agent → dispatch
7. Verify dispatch message reaches OpenClaw Gateway
8. Verify sidebar shows "Research" group with 4 agents

**Step 6: Commit any fixes**

---

## Execution Order & Dependencies

```
Task 1 (DB schema) ← no deps
Task 2 (import existing) ← depends on Task 1
Task 3 (TS types) ← no deps, can parallel with Task 1
Task 4 (CRUD API) ← depends on Task 1 + 3
Task 5 (Deploy API) ← depends on Task 4
Task 6 (Task creation UI) ← depends on Task 4
Task 7 (Template mgmt page) ← depends on Task 4
Task 8 (Sidebar) ← no deps, can do anytime
Task 9 (Stage tracking) ← depends on Task 4
Task 10 (Deploy + test) ← depends on all
```

**Parallelizable:** Tasks 1+3, Tasks 6+7+8, Tasks 5+9
