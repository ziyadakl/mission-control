# Template-Based Pipeline System Design

## Problem

Mission Control only works for 4 hardcoded code-focused pipelines. Non-dev tasks (research, content, business ops) can only go to Bob solo — no structured workflow, no specialized agents, no tool isolation.

## Solution

Template-based pipeline system where workflow templates define agent roles (identity, soul, tools, model) and get deployed as real OpenClaw agents via the CLI. One unified execution model for all task types.

## Architecture

```
MC Database (templates + roles)
  → Deploy API (SSH to VPS)
    → openclaw agents add (real agents created)
    → workspace files written (IDENTITY.md, SOUL.md)
    → gateway restart (~2-3s)
  → Tasks dispatched through real OpenClaw pipelines
```

## Data Model

### workflow_templates
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| name | text | e.g., "Research & Analysis" |
| slug | text UNIQUE | e.g., "research" — used as OpenClaw pipeline prefix |
| description | text | |
| category | text | "development", "research", "content", "operations", "custom" |
| is_deployed | boolean | Whether agents exist in OpenClaw |
| deployed_at | timestamptz | Last deployment time |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### workflow_roles
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| template_id | text FK | → workflow_templates |
| stage_order | int | 1-based stage sequence |
| role_slug | text | e.g., "discoverer" |
| display_name | text | e.g., "Discoverer" |
| emoji | text | e.g., "🔎" |
| identity_text | text | Full IDENTITY.md content |
| soul_text | text | Full SOUL.md content |
| model_primary | text | e.g., "z.ai/glm-4.7" |
| model_fallbacks | jsonb | e.g., ["openrouter/openrouter/auto"] |
| tool_profile | text | "coding", "research", etc. |
| tools_allow | jsonb | e.g., ["web_search", "web_fetch"] |
| tools_deny | jsonb | Standard deny list |
| created_at | timestamptz | |

Generated OpenClaw agent ID: `{template_slug}/{role_slug}`
Generated workspace path: `~/.openclaw/workspaces/workflows/{template_slug}/agents/{role_slug}`

### tasks table additions
| Column | Type | Notes |
|--------|------|-------|
| workflow_template_id | text FK nullable | → workflow_templates |
| current_stage | int nullable | Current pipeline stage |

## Per-Agent Configuration

Each deployed agent gets:
- **IDENTITY.md** — Per-role, written to workspace dir
- **SOUL.md** — Per-role, written to workspace dir
- **USER.md** — Shared from main workspace (symlinked or copied)
- **Model** — Per-role (primary + fallbacks)
- **Tools** — Per-role (profile + allow/deny)
- **subagents.allowAgents: []** — Pipeline agents can't spawn subs

Bob (main) gets:
- Updated **AGENTS.md** — Delegation directory with new pipeline agents
- Updated **tools.agentToAgent.allow** — Can route to new agents

## Deployment Flow

```bash
# For each role in template:
mkdir -p ~/.openclaw/workspaces/workflows/{slug}/agents/{role}
# Write IDENTITY.md, SOUL.md to workspace dir
openclaw agents add "{slug}/{role}" \
  --workspace ~/.openclaw/workspaces/workflows/{slug}/agents/{role} \
  --model {model} \
  --non-interactive
# Update tool config via jq
# Add to tools.agentToAgent.allow

# Restart gateway
openclaw gateway restart  # or kill + start
```

## Task Flow

1. User creates task, selects template from dropdown (or Bob suggests)
2. Task stored with `workflow_template_id`
3. Dispatch routes to first-stage agent
4. Agents hand off through stages (OpenClaw-native agent-to-agent)
5. Last stage reports completion to MC

## MC UI Changes

- Task creation: template dropdown selector
- Sidebar: auto-groups new pipelines (existing `getGroup()` extended)
- Template management page: CRUD for templates and roles
- Deploy button: triggers SSH deployment sequence

## Existing Pipelines

The 4 current pipelines (feature-dev, bug-fix, security-audit, job-hunt) become "built-in templates" — they already exist in OpenClaw and don't need deployment. MC imports their config as read-only template records.

## What Stays the Same

- OpenClaw Gateway — unmodified (no fork)
- Bob's orchestrator role
- Dispatch routing (same session key format)
- SSE real-time updates
- All existing pipeline agents
