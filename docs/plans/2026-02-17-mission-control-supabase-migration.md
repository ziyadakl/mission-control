# Mission Control: SQLite to Supabase Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Mission Control's database layer from better-sqlite3 to Supabase Postgres while preserving all existing functionality (kanban, SSE, OpenClaw Gateway integration, planning flow).

**Architecture:** Replace the `better-sqlite3` singleton with `@supabase/supabase-js` client. The 6 exported DB helpers (`getDb`, `queryAll`, `queryOne`, `run`, `transaction`, `closeDb`) become thin wrappers around the Supabase client. All 13 tables are created as a single Supabase migration. API routes that use raw SQL are rewritten to use Supabase's PostgREST builder pattern. Complex queries (JOINs, GROUP BY, transactions) use Postgres functions via `.rpc()`.

**Tech Stack:** Next.js 14, @supabase/supabase-js, @supabase/ssr, Postgres, Supabase Migrations

---

## Overview of Changes

| Layer | SQLite (current) | Supabase (target) |
|-------|-------------------|--------------------|
| Client | `better-sqlite3` singleton | `@supabase/supabase-js` client |
| Helpers | `queryAll()`, `queryOne()`, `run()` with raw SQL | `supabase.from().select()`, `.insert()`, `.update()`, `.delete()` |
| Transactions | `db.transaction(() => {...})()` | Postgres functions via `supabase.rpc()` |
| Schema | `schema.ts` SQL string + `migrations.ts` | Supabase migration SQL |
| Timestamps | `datetime('now')` | `now()` (Postgres) or omit (use column DEFAULT) |
| Booleans | `INTEGER` (0/1) | `BOOLEAN` (true/false) |
| JSON | `TEXT` + `JSON.parse/stringify` | `JSONB` native |
| Seed | `seed.ts` (better-sqlite3 API) | `seed.ts` (supabase-js API) |
| Config | `DATABASE_PATH=./mission-control.db` | `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| Webpack | `better-sqlite3` externals config | Remove (not needed) |

## Files Modified

| File | Action | Task |
|------|--------|------|
| `package.json` | Remove better-sqlite3, add @supabase/supabase-js @supabase/ssr | 2 |
| `next.config.mjs` | Remove better-sqlite3 webpack/experimental config | 2 |
| `.env.local` | Create with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | 2 |
| `src/lib/db/index.ts` | Full rewrite: Supabase client + new helpers | 3 |
| `src/lib/db/schema.ts` | Delete (replaced by Supabase migration) | 1 |
| `src/lib/db/migrations.ts` | Delete (replaced by Supabase migrations) | 1 |
| `src/lib/db/seed.ts` | Rewrite for Supabase client | 8 |
| `src/app/api/agents/route.ts` | Supabase builder pattern | 4 |
| `src/app/api/agents/[id]/route.ts` | Supabase builder pattern | 4 |
| `src/app/api/agents/[id]/openclaw/route.ts` | Supabase builder pattern | 4 |
| `src/app/api/tasks/route.ts` | Supabase builder + RPC for JOINs | 5 |
| `src/app/api/tasks/[id]/route.ts` | Supabase builder + RPC for JOINs | 5 |
| `src/app/api/tasks/[id]/activities/route.ts` | Supabase builder (was direct getDb) | 6 |
| `src/app/api/tasks/[id]/deliverables/route.ts` | Supabase builder (was direct getDb) | 6 |
| `src/app/api/tasks/[id]/dispatch/route.ts` | Supabase builder | 5 |
| `src/app/api/tasks/[id]/planning/route.ts` | Supabase builder (remove datetime) | 6 |
| `src/app/api/tasks/[id]/planning/answer/route.ts` | Supabase builder | 6 |
| `src/app/api/tasks/[id]/planning/poll/route.ts` | Supabase builder + RPC for transaction | 6 |
| `src/app/api/tasks/[id]/planning/approve/route.ts` | Supabase builder (remove datetime) | 6 |
| `src/app/api/tasks/[id]/planning/retry-dispatch/route.ts` | Supabase builder | 6 |
| `src/app/api/tasks/[id]/subagent/route.ts` | Supabase builder | 6 |
| `src/app/api/tasks/[id]/test/route.ts` | Supabase builder | 5 |
| `src/app/api/events/route.ts` | Supabase builder + RPC for JOIN | 7 |
| `src/app/api/workspaces/route.ts` | Supabase builder + RPC for stats | 7 |
| `src/app/api/workspaces/[id]/route.ts` | Supabase builder (remove datetime) | 7 |
| `src/app/api/openclaw/orchestra/route.ts` | Supabase builder | 7 |
| `src/app/api/openclaw/sessions/route.ts` | Supabase builder | 7 |
| `src/app/api/openclaw/sessions/[id]/route.ts` | Supabase builder | 7 |
| `src/app/api/webhooks/agent-completion/route.ts` | Supabase builder | 7 |
| `src/middleware.ts` | No changes needed | - |
| `src/lib/events.ts` | No changes needed (SSE stays) | - |
| `src/lib/openclaw/client.ts` | No changes needed (WebSocket stays) | - |

---

## Task 1: Create Supabase Schema Migration

Create all 13 tables + indexes as a single Supabase Postgres migration.

**Step 1: Unpause Supabase project**

Go to https://supabase.com/dashboard and unpause the project (project URL: `https://aaavgrwxxxterkfjwnat.supabase.co`). Free tier auto-pauses after inactivity. Click "Restore project" and wait ~60 seconds.

**Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool with this SQL. Key differences from SQLite:

- `TEXT` timestamps → `TIMESTAMPTZ DEFAULT now()`
- `INTEGER DEFAULT 0` booleans → `BOOLEAN DEFAULT false`
- `TEXT` JSON columns → `JSONB`
- Remove `datetime('now')` → use `now()`
- Add `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` for `uuid_generate_v4()`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📁',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'standby' CHECK (status IN ('standby', 'working', 'offline')),
  is_master BOOLEAN DEFAULT false,
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  soul_md TEXT,
  user_md TEXT,
  agents_md TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks (Mission Queue)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('pending_dispatch', 'planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  business_id TEXT DEFAULT 'default',
  due_date TEXT,
  planning_session_key TEXT,
  planning_messages JSONB,
  planning_complete BOOLEAN DEFAULT false,
  planning_spec TEXT,
  planning_agents JSONB,
  planning_dispatch_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Planning questions
CREATE TABLE IF NOT EXISTS planning_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
  options JSONB,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Planning specs (locked specifications)
CREATE TABLE IF NOT EXISTS planning_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'task')),
  task_id TEXT REFERENCES tasks(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, agent_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id TEXT REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'task_update', 'file')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events (live feed)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Businesses (legacy)
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- OpenClaw session mapping
CREATE TABLE IF NOT EXISTS openclaw_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'active',
  session_type TEXT DEFAULT 'persistent',
  task_id TEXT REFERENCES tasks(id),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task activities
CREATE TABLE IF NOT EXISTS task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task deliverables
CREATE TABLE IF NOT EXISTS task_deliverables (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverables_task ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_task ON openclaw_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order);

-- Insert default workspace
INSERT INTO workspaces (id, name, slug, description, icon)
VALUES ('default', 'Default Workspace', 'default', 'Default workspace', '🏠')
ON CONFLICT (id) DO NOTHING;

-- Insert default business
INSERT INTO businesses (id, name, description)
VALUES ('default', 'Mission Control HQ', 'Default workspace for all operations')
ON CONFLICT (id) DO NOTHING;
```

**Step 3: Add RLS policies**

Single-user system behind Tailscale — allow all access via service role key:

```sql
-- Enable RLS on all tables (required by Supabase)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE openclaw_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_deliverables ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (single user, Tailscale-only)
CREATE POLICY "Allow all for service role" ON workspaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON planning_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON planning_specs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON conversation_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON openclaw_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON task_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON task_deliverables FOR ALL USING (true) WITH CHECK (true);
```

**Step 4: Create RPC functions for complex queries**

These Postgres functions replace the complex JOINs and GROUP BYs that can't be expressed cleanly with PostgREST:

```sql
-- Get tasks with assigned agent info (used by GET /api/tasks and GET /api/tasks/[id])
CREATE OR REPLACE FUNCTION get_tasks_with_agents(
  p_workspace_id TEXT DEFAULT NULL,
  p_business_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_assigned_agent_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT, title TEXT, description TEXT, status TEXT, priority TEXT,
  assigned_agent_id TEXT, created_by_agent_id TEXT, workspace_id TEXT,
  business_id TEXT, due_date TEXT, planning_session_key TEXT,
  planning_messages JSONB, planning_complete BOOLEAN, planning_spec TEXT,
  planning_agents JSONB, planning_dispatch_error TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  assigned_agent_name TEXT, assigned_agent_emoji TEXT,
  created_by_agent_name TEXT, created_by_agent_emoji TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    t.id, t.title, t.description, t.status, t.priority,
    t.assigned_agent_id, t.created_by_agent_id, t.workspace_id,
    t.business_id, t.due_date, t.planning_session_key,
    t.planning_messages, t.planning_complete, t.planning_spec,
    t.planning_agents, t.planning_dispatch_error,
    t.created_at, t.updated_at,
    a.name AS assigned_agent_name, a.avatar_emoji AS assigned_agent_emoji,
    c.name AS created_by_agent_name, c.avatar_emoji AS created_by_agent_emoji
  FROM tasks t
  LEFT JOIN agents a ON t.assigned_agent_id = a.id
  LEFT JOIN agents c ON t.created_by_agent_id = c.id
  WHERE (p_workspace_id IS NULL OR t.workspace_id = p_workspace_id)
    AND (p_business_id IS NULL OR t.business_id = p_business_id)
    AND (p_status IS NULL OR t.status = ANY(string_to_array(p_status, ',')))
    AND (p_assigned_agent_id IS NULL OR t.assigned_agent_id = p_assigned_agent_id)
  ORDER BY
    CASE t.priority
      WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
      WHEN 'normal' THEN 2 WHEN 'low' THEN 3
    END,
    t.created_at DESC;
$$;

-- Get single task with agent info
CREATE OR REPLACE FUNCTION get_task_by_id(p_task_id TEXT)
RETURNS TABLE (
  id TEXT, title TEXT, description TEXT, status TEXT, priority TEXT,
  assigned_agent_id TEXT, created_by_agent_id TEXT, workspace_id TEXT,
  business_id TEXT, due_date TEXT, planning_session_key TEXT,
  planning_messages JSONB, planning_complete BOOLEAN, planning_spec TEXT,
  planning_agents JSONB, planning_dispatch_error TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  assigned_agent_name TEXT, assigned_agent_emoji TEXT,
  created_by_agent_name TEXT, created_by_agent_emoji TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    t.id, t.title, t.description, t.status, t.priority,
    t.assigned_agent_id, t.created_by_agent_id, t.workspace_id,
    t.business_id, t.due_date, t.planning_session_key,
    t.planning_messages, t.planning_complete, t.planning_spec,
    t.planning_agents, t.planning_dispatch_error,
    t.created_at, t.updated_at,
    a.name AS assigned_agent_name, a.avatar_emoji AS assigned_agent_emoji,
    c.name AS created_by_agent_name, c.avatar_emoji AS created_by_agent_emoji
  FROM tasks t
  LEFT JOIN agents a ON t.assigned_agent_id = a.id
  LEFT JOIN agents c ON t.created_by_agent_id = c.id
  WHERE t.id = p_task_id;
$$;

-- Get workspace stats
CREATE OR REPLACE FUNCTION get_workspace_stats(p_workspace_id TEXT)
RETURNS TABLE (status TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT status, COUNT(*) as count
  FROM tasks
  WHERE workspace_id = p_workspace_id
  GROUP BY status;
$$;

-- Get events with agent/task info
CREATE OR REPLACE FUNCTION get_events_with_details(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id TEXT, type TEXT, agent_id TEXT, task_id TEXT,
  message TEXT, metadata JSONB, created_at TIMESTAMPTZ,
  agent_name TEXT, agent_emoji TEXT, task_title TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id, e.type, e.agent_id, e.task_id,
    e.message, e.metadata, e.created_at,
    a.name AS agent_name, a.avatar_emoji AS agent_emoji,
    t.title AS task_title
  FROM events e
  LEFT JOIN agents a ON e.agent_id = a.id
  LEFT JOIN tasks t ON e.task_id = t.id
  WHERE (p_since IS NULL OR e.created_at > p_since)
  ORDER BY e.created_at DESC
  LIMIT p_limit;
$$;

-- Get activities with agent info
CREATE OR REPLACE FUNCTION get_task_activities(p_task_id TEXT)
RETURNS TABLE (
  id TEXT, task_id TEXT, agent_id TEXT, activity_type TEXT,
  message TEXT, metadata JSONB, created_at TIMESTAMPTZ,
  agent_name TEXT, agent_emoji TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    ta.id, ta.task_id, ta.agent_id, ta.activity_type,
    ta.message, ta.metadata, ta.created_at,
    a.name AS agent_name, a.avatar_emoji AS agent_emoji
  FROM task_activities ta
  LEFT JOIN agents a ON ta.agent_id = a.id
  WHERE ta.task_id = p_task_id
  ORDER BY ta.created_at DESC;
$$;

-- Planning completion transaction (handles creating agents + updating task atomically)
CREATE OR REPLACE FUNCTION complete_planning(
  p_task_id TEXT,
  p_spec JSONB,
  p_agents JSONB,
  p_workspace_id TEXT DEFAULT 'default'
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  agent_record JSONB;
  agent_id TEXT;
BEGIN
  -- Create agents from spec
  FOR agent_record IN SELECT * FROM jsonb_array_elements(p_agents)
  LOOP
    agent_id := gen_random_uuid()::TEXT;
    INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id)
    VALUES (
      agent_id,
      agent_record->>'name',
      agent_record->>'role',
      agent_record->>'description',
      COALESCE(agent_record->>'avatar_emoji', '🤖'),
      'standby',
      false,
      p_workspace_id
    );
  END LOOP;

  -- Update task
  UPDATE tasks SET
    planning_complete = true,
    planning_spec = p_spec::TEXT,
    planning_agents = p_agents,
    status = 'assigned',
    updated_at = now()
  WHERE id = p_task_id;
END;
$$;
```

**Step 5: Delete old schema/migration files**

Delete these files (no longer needed — Supabase manages schema):
- `src/lib/db/schema.ts`
- `src/lib/db/migrations.ts`

**Step 6: Verify migration applied**

Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`

Expected: all 13 tables + `workspaces` and `businesses` have seed rows.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: create Supabase schema migration with 13 tables, RLS, and RPC functions"
```

---

## Task 2: Swap Dependencies and Config

**Step 1: Update package.json**

Remove:
- `better-sqlite3` from dependencies
- `@types/better-sqlite3` from devDependencies

Add:
- `@supabase/supabase-js` to dependencies
- `@supabase/ssr` to dependencies

```bash
cd /Users/ziyadakl/Desktop/Automation/Cursor-VS/openclaw-mission-control
npm uninstall better-sqlite3 @types/better-sqlite3
npm install @supabase/supabase-js @supabase/ssr
```

**Step 2: Update next.config.mjs**

Remove the `better-sqlite3` webpack external and experimental config:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Step 3: Create .env.local**

```
# Supabase
SUPABASE_URL=https://aaavgrwxxxterkfjwnat.supabase.co
SUPABASE_ANON_KEY=<get from Supabase dashboard: Settings > API > anon/public>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard: Settings > API > service_role>

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=

# Mission Control
MC_API_TOKEN=<generate: openssl rand -hex 32>
MISSION_CONTROL_URL=http://localhost:4000
```

**Step 4: Commit**

```bash
git add package.json package-lock.json next.config.mjs .env.example
git commit -m "chore: swap better-sqlite3 for @supabase/supabase-js"
```

---

## Task 3: Rewrite Core DB Layer

Replace `src/lib/db/index.ts` — this is the single most critical file.

**Step 1: Write the new db/index.ts**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    console.log('[DB] Supabase client initialized:', SUPABASE_URL);
  }
  return supabase;
}

// Re-export for backward compatibility during migration
// API routes should migrate to using getSupabase() directly
export const getDb = getSupabase;
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/lib/db/index.ts
```

Expected: Compilation errors in files that still import old functions (`queryAll`, `queryOne`, `run`, `transaction`). This is expected — we fix them in Tasks 4-7.

**Step 3: Commit**

```bash
git add src/lib/db/index.ts
git commit -m "feat: rewrite db/index.ts with Supabase client"
```

---

## Task 4: Migrate Agent API Routes

Three files, all import from `@/lib/db`.

### 4a: `src/app/api/agents/route.ts`

**GET handler** — Replace `queryAll('SELECT * FROM agents WHERE workspace_id = ?', [wsId])` with:

```typescript
import { getSupabase } from '@/lib/db';

// GET: List agents
const supabase = getSupabase();
let query = supabase.from('agents').select('*').order('is_master', { ascending: false }).order('name');
if (workspaceId) {
  query = query.eq('workspace_id', workspaceId);
}
const { data: agents, error } = await query;
if (error) return NextResponse.json({ error: error.message }, { status: 500 });
return NextResponse.json(agents);
```

**POST handler** — Replace `run('INSERT INTO agents ...')` with:

```typescript
const supabase = getSupabase();
const { data, error } = await supabase.from('agents').insert({
  id, name, role, description, avatar_emoji, status: 'standby',
  is_master: isMaster, workspace_id: workspaceId,
  soul_md, user_md, agents_md, model,
}).select().single();
if (error) return NextResponse.json({ error: error.message }, { status: 500 });

// Log event
await supabase.from('events').insert({
  id: eventId, type: 'agent_joined', agent_id: id,
  message: `${name} joined the team`,
});
```

### 4b: `src/app/api/agents/[id]/route.ts`

**GET** — `supabase.from('agents').select('*').eq('id', id).single()`

**PATCH** — Build update object dynamically from request body, then:
```typescript
const { data, error } = await supabase.from('agents')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();
```

**DELETE** — Sequential cleanup then delete:
```typescript
// Nullify references
await supabase.from('openclaw_sessions').update({ agent_id: null }).eq('agent_id', id);
await supabase.from('events').update({ agent_id: null }).eq('agent_id', id);
await supabase.from('messages').delete().eq('sender_agent_id', id);
await supabase.from('conversation_participants').delete().eq('agent_id', id);
await supabase.from('tasks').update({ assigned_agent_id: null }).eq('assigned_agent_id', id);
await supabase.from('tasks').update({ created_by_agent_id: null }).eq('created_by_agent_id', id);
// Delete agent
await supabase.from('agents').delete().eq('id', id);
```

### 4c: `src/app/api/agents/[id]/openclaw/route.ts`

Same pattern — replace `queryOne`/`run` with Supabase `.from().select()/insert()/update()`.

**Commit:**
```bash
git add src/app/api/agents/
git commit -m "feat: migrate agent API routes to Supabase"
```

---

## Task 5: Migrate Task Core Routes

Five files handling task CRUD, dispatch, and testing.

### 5a: `src/app/api/tasks/route.ts`

**GET** — Use the `get_tasks_with_agents` RPC function:

```typescript
const supabase = getSupabase();
const { data, error } = await supabase.rpc('get_tasks_with_agents', {
  p_workspace_id: workspaceId || null,
  p_business_id: businessId || null,
  p_status: status || null,
  p_assigned_agent_id: assignedAgentId || null,
});
```

**POST** — Use Supabase insert:

```typescript
const { data: task, error } = await supabase.from('tasks').insert({
  id, title, description, status: status || 'inbox',
  priority: priority || 'normal', assigned_agent_id, created_by_agent_id,
  workspace_id: workspace_id || 'default', business_id: business_id || 'default',
  due_date,
}).select().single();
```

### 5b: `src/app/api/tasks/[id]/route.ts`

**GET** — Use `get_task_by_id` RPC:
```typescript
const { data, error } = await supabase.rpc('get_task_by_id', { p_task_id: id });
const task = data?.[0];
```

**PATCH** — Supabase update with builder pattern. The master-agent check for `review -> done` transitions stays as application logic:
```typescript
if (status === 'done' && currentTask.status === 'review') {
  // Check if request is from master agent — keep existing logic
}
const { data, error } = await supabase.from('tasks')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', id).select().single();
```

**DELETE** — Sequential cleanup (same pattern as agent delete).

### 5c: `src/app/api/tasks/[id]/dispatch/route.ts`

Replace `queryOne`/`run` with Supabase selects/updates. The OpenClaw client calls stay unchanged.

### 5d: `src/app/api/tasks/[id]/test/route.ts`

Replace `queryOne`/`queryAll`/`run` with Supabase equivalents. Playwright test logic stays unchanged.

**Commit:**
```bash
git add src/app/api/tasks/route.ts src/app/api/tasks/*/route.ts
git commit -m "feat: migrate task core routes to Supabase"
```

---

## Task 6: Migrate Planning & Activity Routes

Seven files that used direct `getDb()` calls or `datetime('now')`.

### 6a: `src/app/api/tasks/[id]/activities/route.ts`

**GET** — Use RPC function:
```typescript
const { data, error } = await supabase.rpc('get_task_activities', { p_task_id: taskId });
```

**POST** — Supabase insert:
```typescript
await supabase.from('task_activities').insert({
  id, task_id: taskId, agent_id, activity_type, message, metadata,
});
```

### 6b: `src/app/api/tasks/[id]/deliverables/route.ts`

**GET** — `supabase.from('task_deliverables').select('*').eq('task_id', taskId)`

**POST** — `supabase.from('task_deliverables').insert({...}).select().single()`

### 6c: `src/app/api/tasks/[id]/planning/route.ts`

**GET** — Select planning columns from tasks table:
```typescript
const { data: task } = await supabase.from('tasks')
  .select('planning_session_key, planning_messages, planning_complete, planning_spec, planning_agents')
  .eq('id', taskId).single();
```

**POST** — Update task with planning session key + send to OpenClaw.

**DELETE** — Reset planning fields:
```typescript
await supabase.from('tasks').update({
  planning_session_key: null, planning_messages: null,
  planning_complete: false, planning_spec: null,
  planning_agents: null, status: 'inbox',
  updated_at: new Date().toISOString(),
}).eq('id', taskId);
```

Note: `datetime('now')` replaced with `new Date().toISOString()` in JS code. Postgres column defaults handle `created_at` automatically.

### 6d: `src/app/api/tasks/[id]/planning/answer/route.ts`

Replace `getDb().prepare(...)` with Supabase select/update.

### 6e: `src/app/api/tasks/[id]/planning/poll/route.ts`

The transaction that creates agents + updates task uses the `complete_planning` RPC:

```typescript
const { error } = await supabase.rpc('complete_planning', {
  p_task_id: taskId,
  p_spec: specJson,
  p_agents: agentsJson,
  p_workspace_id: workspaceId,
});
```

### 6f: `src/app/api/tasks/[id]/planning/approve/route.ts`

Replace `getDb()` calls. The `locked_at = datetime('now')` becomes `locked_at: new Date().toISOString()`:

```typescript
await supabase.from('planning_specs').insert({
  id, task_id: taskId, spec_markdown: specMd,
  locked_at: new Date().toISOString(), locked_by: lockedBy,
});
```

### 6g: `src/app/api/tasks/[id]/planning/retry-dispatch/route.ts`

Replace `queryOne`/`run` with Supabase equivalents.

### 6h: `src/app/api/tasks/[id]/subagent/route.ts`

Replace `getDb()` with Supabase selects/inserts.

**Commit:**
```bash
git add src/app/api/tasks/
git commit -m "feat: migrate planning, activity, and deliverable routes to Supabase"
```

---

## Task 7: Migrate Remaining Routes

Six files: events, workspaces, openclaw, webhooks.

### 7a: `src/app/api/events/route.ts`

**GET** — Use `get_events_with_details` RPC:
```typescript
const { data, error } = await supabase.rpc('get_events_with_details', {
  p_since: since || null,
  p_limit: limit,
});
```

**POST** — Supabase insert.

### 7b: `src/app/api/workspaces/route.ts`

**GET with stats** — Use `get_workspace_stats` RPC:
```typescript
const { data: stats } = await supabase.rpc('get_workspace_stats', { p_workspace_id: ws.id });
const { count: agentCount } = await supabase
  .from('agents').select('*', { count: 'exact', head: true })
  .eq('workspace_id', ws.id);
```

**POST** — Supabase insert with slug generation.

### 7c: `src/app/api/workspaces/[id]/route.ts`

**GET** — `supabase.from('workspaces').select('*').or('id.eq.' + id + ',slug.eq.' + id).single()`

**PATCH** — Replace `datetime('now')` with JS timestamp:
```typescript
await supabase.from('workspaces')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', id);
```

**DELETE** — Check for tasks/agents before deleting.

### 7d: `src/app/api/openclaw/orchestra/route.ts`

Replace `queryOne`/`queryAll` with Supabase selects.

### 7e: `src/app/api/openclaw/sessions/route.ts` and `sessions/[id]/route.ts`

Replace DB queries with Supabase equivalents. The OpenClaw WebSocket client calls stay unchanged.

### 7f: `src/app/api/webhooks/agent-completion/route.ts`

Replace `queryOne`/`queryAll`/`run` with Supabase equivalents. HMAC verification stays unchanged.

**Commit:**
```bash
git add src/app/api/events/ src/app/api/workspaces/ src/app/api/openclaw/ src/app/api/webhooks/
git commit -m "feat: migrate events, workspaces, openclaw, and webhook routes to Supabase"
```

---

## Task 8: Rewrite Seed Script

Replace better-sqlite3 API calls with Supabase client calls.

**Step 1: Write new seed.ts**

```typescript
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function seed() {
  console.log('🌱 Seeding database...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const now = new Date().toISOString();
  const orchestratorId = uuidv4();

  // Create master orchestrator
  await supabase.from('agents').insert({
    id: orchestratorId, name: 'Orchestrator',
    role: 'Team Lead & Orchestrator',
    description: 'The master orchestrator who coordinates all agents',
    avatar_emoji: '🦞', status: 'standby', is_master: true,
    soul_md: ORCHESTRATOR_SOUL_MD,
    user_md: ORCHESTRATOR_USER_MD,
    agents_md: ORCHESTRATOR_AGENTS_MD,
  });

  // Create example agents
  const agents = [
    { name: 'Developer', role: 'Code & Automation', emoji: '💻', desc: 'Writes code, creates automations' },
    { name: 'Researcher', role: 'Research & Analysis', emoji: '🔍', desc: 'Gathers information, analyzes data' },
    { name: 'Writer', role: 'Content & Documentation', emoji: '✍️', desc: 'Creates content, writes docs' },
    { name: 'Designer', role: 'Creative & Design', emoji: '🎨', desc: 'Handles visual design, UX' },
  ];

  const agentIds = [orchestratorId];
  for (const agent of agents) {
    const agentId = uuidv4();
    agentIds.push(agentId);
    await supabase.from('agents').insert({
      id: agentId, name: agent.name, role: agent.role,
      description: agent.desc, avatar_emoji: agent.emoji,
      status: 'standby', is_master: false,
    });
  }

  // Create team conversation + participants + tasks + events + welcome message
  // (Same data as original seed, using supabase.from().insert())

  console.log('✅ Database seeded successfully!');
}

seed().catch(console.error);
```

**Step 2: Update package.json scripts**

Replace `db:seed` script:
```json
"db:seed": "tsx src/lib/db/seed.ts"
```

Remove SQLite-specific scripts: `db:backup`, `db:restore`, `db:reset`.

**Step 3: Run seed**

```bash
SUPABASE_URL=https://aaavgrwxxxterkfjwnat.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npm run db:seed
```

**Step 4: Verify seed data**

```sql
SELECT name, role, is_master FROM agents ORDER BY is_master DESC;
SELECT title, status FROM tasks;
SELECT type, message FROM events ORDER BY created_at;
```

**Step 5: Commit**

```bash
git add src/lib/db/seed.ts package.json
git commit -m "feat: rewrite seed script for Supabase"
```

---

## Task 9: Build and Test Locally

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any remaining type errors. Common issues:
- `Database.RunResult` return type → replace with `void` or the Supabase response type
- `better-sqlite3` type references → remove

**Step 2: Run the dev server**

```bash
npm run dev
```

**Step 3: Test critical endpoints**

```bash
# Health check
curl http://localhost:4000/api/agents

# Create a task
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","description":"Testing Supabase","priority":"normal"}'

# List tasks
curl http://localhost:4000/api/tasks

# Check SSE stream
curl -N http://localhost:4000/api/events/stream

# Check events
curl http://localhost:4000/api/events
```

**Step 4: Test the dashboard UI**

Open `http://localhost:4000` in browser:
- Verify kanban board loads
- Verify agents sidebar loads
- Verify drag-and-drop works
- Verify SSE updates work (create a task in another terminal, watch it appear)

**Step 5: Run build**

```bash
npm run build
```

Fix any build errors.

**Step 6: Commit**

```bash
git add -A && git commit -m "fix: resolve all TypeScript and build issues after Supabase migration"
```

---

## Task 10: Seed OpenClaw Agents

Map the 28 real OpenClaw agents into Mission Control's agents table.

**Step 1: Create agent mapping script**

Create `scripts/seed-openclaw-agents.ts`:

```typescript
// Maps OpenClaw agent IDs to Mission Control agent records
const OPENCLAW_AGENTS = [
  // Master
  { id: 'main', name: 'Bob', role: 'Master Orchestrator', emoji: '🧠', is_master: true,
    description: 'Main agent. Routes tasks, invokes workflows, reports via Telegram.' },

  // Worker
  { id: 'worker', name: 'Worker', role: 'General Worker', emoji: '⚙️', is_master: false,
    description: 'General-purpose worker. Handles misc tasks.' },

  // Feature-Dev Pipeline
  { id: 'project-manager', name: 'Project Manager', role: 'Feature Dev: PM', emoji: '📋', is_master: false },
  { id: 'lead-developer', name: 'Lead Developer', role: 'Feature Dev: Lead', emoji: '👨‍💻', is_master: false },
  { id: 'frontend-developer', name: 'Frontend Dev', role: 'Feature Dev: Frontend', emoji: '🎨', is_master: false },
  { id: 'backend-developer', name: 'Backend Dev', role: 'Feature Dev: Backend', emoji: '🔧', is_master: false },
  { id: 'qa-tester', name: 'QA Tester', role: 'Feature Dev: QA', emoji: '🧪', is_master: false },
  { id: 'technical-writer', name: 'Technical Writer', role: 'Feature Dev: Docs', emoji: '📝', is_master: false },

  // Bug-Fix Pipeline
  { id: 'triage-analyst', name: 'Triage Analyst', role: 'Bug Fix: Triage', emoji: '🔍', is_master: false },
  { id: 'debugger', name: 'Debugger', role: 'Bug Fix: Debug', emoji: '🐛', is_master: false },
  { id: 'patch-developer', name: 'Patch Developer', role: 'Bug Fix: Patch', emoji: '🩹', is_master: false },
  { id: 'regression-tester', name: 'Regression Tester', role: 'Bug Fix: Regression', emoji: '🔄', is_master: false },

  // Security-Audit Pipeline
  { id: 'security-analyst', name: 'Security Analyst', role: 'Security: Analyst', emoji: '🛡️', is_master: false },
  { id: 'vulnerability-scanner', name: 'Vuln Scanner', role: 'Security: Scanner', emoji: '🔬', is_master: false },
  { id: 'penetration-tester', name: 'Pen Tester', role: 'Security: PenTest', emoji: '⚔️', is_master: false },
  { id: 'compliance-auditor', name: 'Compliance Auditor', role: 'Security: Compliance', emoji: '📜', is_master: false },
  { id: 'security-reporter', name: 'Security Reporter', role: 'Security: Reporter', emoji: '📊', is_master: false },

  // Job-Hunt-Mining Pipeline
  { id: 'market-researcher', name: 'Market Researcher', role: 'Jobs: Research', emoji: '🌐', is_master: false },
  { id: 'job-scraper', name: 'Job Scraper', role: 'Jobs: Scraper', emoji: '🕷️', is_master: false },
  { id: 'profile-optimizer', name: 'Profile Optimizer', role: 'Jobs: Profile', emoji: '✨', is_master: false },
  { id: 'application-drafter', name: 'Application Drafter', role: 'Jobs: Applications', emoji: '📨', is_master: false },
  { id: 'interview-coach', name: 'Interview Coach', role: 'Jobs: Interview', emoji: '🎙️', is_master: false },
  { id: 'salary-negotiator', name: 'Salary Negotiator', role: 'Jobs: Salary', emoji: '💰', is_master: false },

  // Additional agents (from openclaw agents list)
  { id: 'code-reviewer', name: 'Code Reviewer', role: 'Code Review', emoji: '👀', is_master: false },
  { id: 'devops-engineer', name: 'DevOps Engineer', role: 'DevOps', emoji: '🚀', is_master: false },
  { id: 'data-analyst', name: 'Data Analyst', role: 'Data Analysis', emoji: '📈', is_master: false },
  { id: 'ux-researcher', name: 'UX Researcher', role: 'UX Research', emoji: '🧑‍🔬', is_master: false },
  { id: 'system-architect', name: 'System Architect', role: 'Architecture', emoji: '🏗️', is_master: false },
];
```

Use the same Supabase client pattern to insert all agents. The `id` field uses the OpenClaw agent ID string so dispatch can look up by ID directly.

**Step 2: Run the seed**

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-openclaw-agents.ts
```

**Step 3: Verify**

```sql
SELECT id, name, role FROM agents ORDER BY is_master DESC, name;
```

Expected: 28 agents with OpenClaw IDs.

**Step 4: Commit**

```bash
git add scripts/seed-openclaw-agents.ts
git commit -m "feat: seed 28 OpenClaw agents into Mission Control"
```

---

## Task 11: Deploy to VPS

**Step 1: Push to remote**

```bash
git push origin main
```

**Step 2: SSH into VPS and clone**

```bash
ssh deploy@srv1360790.tail30bf7c.ts.net
cd /home/deploy
git clone <repo-url> mission-control
cd mission-control
```

**Step 3: Install dependencies**

```bash
npm install
```

**Step 4: Create .env.local on VPS**

```bash
cat > .env.local << 'EOF'
SUPABASE_URL=https://aaavgrwxxxterkfjwnat.supabase.co
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=
MC_API_TOKEN=<generated token>
MISSION_CONTROL_URL=http://localhost:4000
EOF
```

**Step 5: Build and test**

```bash
npm run build
npm start
# In another terminal:
curl http://localhost:4000/api/agents
```

**Step 6: Create systemd service**

```bash
cat > ~/.config/systemd/user/mission-control.service << 'EOF'
[Unit]
Description=Mission Control Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/deploy/mission-control
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
EnvironmentFile=/home/deploy/mission-control/.env.local

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable mission-control
systemctl --user start mission-control
```

**Step 7: Verify deployment**

```bash
curl http://localhost:4000/api/agents
curl http://localhost:4000/api/tasks
curl http://localhost:4000/api/openclaw/status
```

Access via Tailscale: `https://srv1360790.tail30bf7c.ts.net:4000`

**Step 8: Commit service file**

```bash
git add antfarm.service  # if keeping reference
git commit -m "docs: add systemd service for VPS deployment"
```

---

## Task 12: Heartbeat Integration

Connect the existing heartbeat (ollama/qwen2.5:3b, every 15min) to poll Mission Control for new tasks.

**Step 1: Update HEARTBEAT.md on VPS**

Add to `~/.openclaw/workspace/HEARTBEAT.md`:

```markdown
## Mission Control Check

After reading this file, also check for pending tasks:

1. Call: `curl -s -H "Authorization: Bearer $MC_API_TOKEN" http://localhost:4000/api/tasks?status=inbox,assigned`
2. If tasks found in `inbox` status → trigger main agent to process them
3. If tasks found in `assigned` status → trigger dispatch
4. If no tasks → HEARTBEAT_OK (silent)
5. If idle >2h → suggest improvements via Telegram
```

**Step 2: Verify heartbeat picks up tasks**

Create a test task via API:
```bash
curl -X POST http://localhost:4000/api/tasks \
  -H "Authorization: Bearer $MC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test heartbeat pickup","status":"inbox"}'
```

Wait for next heartbeat cycle (or trigger manually). Verify the main agent processes it.

**Step 3: Commit**

```bash
# On VPS
cd ~/.openclaw/workspace
git add HEARTBEAT.md
git commit -m "feat: add Mission Control polling to heartbeat"
```

---

## Verification Checklist

After all tasks complete, verify:

```bash
# 1. Supabase has all 13 tables
# Run via Supabase MCP or dashboard:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
# Expected: agents, businesses, conversation_participants, conversations, events,
#           messages, openclaw_sessions, planning_questions, planning_specs,
#           task_activities, task_deliverables, tasks, workspaces

# 2. Agents seeded
curl -s http://localhost:4000/api/agents | jq length
# Expected: 28+

# 3. Dashboard loads
# Open https://srv1360790.tail30bf7c.ts.net:4000 in browser
# Expected: Kanban board with columns, agent sidebar

# 4. OpenClaw gateway connected
curl -s http://localhost:4000/api/openclaw/status | jq .connected
# Expected: true

# 5. SSE stream works
curl -N http://localhost:4000/api/events/stream
# Expected: `: connected` then periodic `: keep-alive`

# 6. Task CRUD works
# Create, read, update, delete a task via API

# 7. No SQLite references remain
grep -r "better-sqlite3\|sqlite3\|datetime('now')" src/
# Expected: no matches

# 8. Build passes
npm run build
# Expected: no errors
```
