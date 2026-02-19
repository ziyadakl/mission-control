// Seeds the 27 real OpenClaw agents into Mission Control's Supabase database.
// Runs ON the VPS so it can read system prompts from the OpenClaw workspace filesystem.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-openclaw-agents.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WORKSPACE_ID = 'ws-openclaw';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely read a file from the VPS filesystem; returns empty string on failure. */
function readFile(path: string): string {
  try {
    return fs.readFileSync(path, 'utf-8');
  } catch {
    console.log(`  [fs] File not found or unreadable: ${path}`);
    return '';
  }
}

// ---------------------------------------------------------------------------
// VPS filesystem paths for Bob's markdown files
// ---------------------------------------------------------------------------

const OPENCLAW_WORKSPACE = '/home/deploy/.openclaw/workspace';
const OPENCLAW_WORKFLOWS = process.env.OPENCLAW_WORKFLOWS_PATH
  || '/home/deploy/mission-control/workflows';

const bobSoulMd = readFile(`${OPENCLAW_WORKSPACE}/SOUL.md`);
const bobUserMd = readFile(`${OPENCLAW_WORKSPACE}/USER.md`);
const bobAgentsMd = readFile(`${OPENCLAW_WORKSPACE}/AGENTS.md`);
const bobSystemPrompt = [
  readFile(`${OPENCLAW_WORKSPACE}/IDENTITY.md`),
  readFile(`${OPENCLAW_WORKSPACE}/OPERATING_CONTRACT.md`),
].filter(Boolean).join('\n\n');

// ---------------------------------------------------------------------------
// Agent type
// ---------------------------------------------------------------------------

interface AgentSeed {
  id: string;
  openclaw_agent_id: string;
  name: string;
  role: string;
  emoji: string;
  is_master: boolean;
  model: string;
  description: string;
  // Optional overrides for markdown fields (only Bob gets these)
  soul_md?: string;
  user_md?: string;
  agents_md?: string;
  system_prompt?: string;
}

// ---------------------------------------------------------------------------
// Pipeline agent system-prompt loader
//
// Convention: /home/deploy/.openclaw/workspaces/workflows/{pipeline}/agents/{role}/IDENTITY.md
// e.g. feature-dev/agents/planner/IDENTITY.md
// ---------------------------------------------------------------------------

/** Read any core file from a pipeline agent's VPS workspace directory.
 *  openclawAgentId is like "feature-dev/planner" => reads from
 *  /home/deploy/.openclaw/workspaces/workflows/feature-dev/agents/planner/{filename}
 */
function pipelineFile(openclawAgentId: string, filename: string): string {
  const parts = openclawAgentId.split('/');
  if (parts.length !== 2) return '';
  const [pipeline, role] = parts;
  return readFile(`${OPENCLAW_WORKFLOWS}/${pipeline}/agents/${role}/${filename}`);
}

// ---------------------------------------------------------------------------
// The 27 real OpenClaw agents
// ---------------------------------------------------------------------------

const AGENTS: AgentSeed[] = [
  // ── Core (2) ──────────────────────────────────────────────────────────
  {
    id: 'bob',
    openclaw_agent_id: 'main',
    name: 'Bob',
    role: 'Master Orchestrator',
    emoji: '\u{1F9E0}',        // brain
    is_master: true,
    model: 'google/gemini-2.5-flash',
    description: 'Main orchestrator. Routes tasks, invokes pipelines, reports via Telegram.',
    soul_md: bobSoulMd,
    user_md: bobUserMd,
    agents_md: bobAgentsMd,
    system_prompt: bobSystemPrompt,
  },
  {
    id: 'worker',
    openclaw_agent_id: 'worker',
    name: 'Worker',
    role: 'Execution Worker',
    emoji: '\u{2699}\u{FE0F}', // gear
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'General-purpose execution worker for misc tasks.',
  },

  // ── Feature-Dev Pipeline (6) ──────────────────────────────────────────
  {
    id: 'fd-planner',
    openclaw_agent_id: 'feature-dev/planner',
    name: 'FD Planner',
    role: 'Feature Dev: Planner',
    emoji: '\u{1F4CB}',        // clipboard
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Decomposes tasks into ordered user stories for autonomous execution.',
  },
  {
    id: 'fd-setup',
    openclaw_agent_id: 'feature-dev/setup',
    name: 'FD Setup',
    role: 'Feature Dev: Setup',
    emoji: '\u{1F527}',        // wrench
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Creates branch and establishes build/test baseline.',
  },
  {
    id: 'fd-developer',
    openclaw_agent_id: 'feature-dev/developer',
    name: 'FD Developer',
    role: 'Feature Dev: Developer',
    emoji: '\u{1F468}\u{200D}\u{1F4BB}', // man technologist
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Implements feature changes and writes tests.',
  },
  {
    id: 'fd-verifier',
    openclaw_agent_id: 'feature-dev/verifier',
    name: 'FD Verifier',
    role: 'Feature Dev: Verifier',
    emoji: '\u{2705}',         // check mark
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Quality gate - verifies work is correct and complete.',
  },
  {
    id: 'fd-tester',
    openclaw_agent_id: 'feature-dev/tester',
    name: 'FD Tester',
    role: 'Feature Dev: Tester',
    emoji: '\u{1F9EA}',        // test tube
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Integration and E2E testing after implementation.',
  },
  {
    id: 'fd-reviewer',
    openclaw_agent_id: 'feature-dev/reviewer',
    name: 'FD Reviewer',
    role: 'Feature Dev: Reviewer',
    emoji: '\u{1F440}',        // eyes
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Reviews PRs and ensures code quality.',
  },

  // ── Security-Audit Pipeline (7) ──────────────────────────────────────
  {
    id: 'sa-scanner',
    openclaw_agent_id: 'security-audit/scanner',
    name: 'SA Scanner',
    role: 'Security: Scanner',
    emoji: '\u{1F52C}',        // microscope
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Security vulnerability scanner and analyzer.',
  },
  {
    id: 'sa-prioritizer',
    openclaw_agent_id: 'security-audit/prioritizer',
    name: 'SA Prioritizer',
    role: 'Security: Prioritizer',
    emoji: '\u{1F4CA}',        // bar chart
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Ranks and groups security findings into prioritized fix plan.',
  },
  {
    id: 'sa-setup',
    openclaw_agent_id: 'security-audit/setup',
    name: 'SA Setup',
    role: 'Security: Setup',
    emoji: '\u{1F527}',        // wrench
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Creates branch and establishes build/test baseline.',
  },
  {
    id: 'sa-fixer',
    openclaw_agent_id: 'security-audit/fixer',
    name: 'SA Fixer',
    role: 'Security: Fixer',
    emoji: '\u{1F528}',        // hammer
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Implements security fixes and writes regression tests.',
  },
  {
    id: 'sa-verifier',
    openclaw_agent_id: 'security-audit/verifier',
    name: 'SA Verifier',
    role: 'Security: Verifier',
    emoji: '\u{2705}',         // check mark
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Quality gate - verifies work is correct and complete.',
  },
  {
    id: 'sa-tester',
    openclaw_agent_id: 'security-audit/tester',
    name: 'SA Tester',
    role: 'Security: Tester',
    emoji: '\u{1F9EA}',        // test tube
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Final integration testing and post-fix audit.',
  },
  {
    id: 'sa-pr',
    openclaw_agent_id: 'security-audit/pr',
    name: 'SA PR Creator',
    role: 'Security: PR Creator',
    emoji: '\u{1F4DD}',        // memo
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Creates pull requests with comprehensive documentation.',
  },

  // ── Job-Hunt-Mining Pipeline (6) ─────────────────────────────────────
  {
    id: 'jh-discoverer',
    openclaw_agent_id: 'job-hunt-mining/discoverer',
    name: 'JH Discoverer',
    role: 'Jobs: Discoverer',
    emoji: '\u{1F50E}',        // magnifying glass right
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Job discovery cycle executor.',
  },
  {
    id: 'jh-enricher',
    openclaw_agent_id: 'job-hunt-mining/enricher',
    name: 'JH Enricher',
    role: 'Jobs: Enricher',
    emoji: '\u{2728}',         // sparkles
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Candidate normalization and enrichment.',
  },
  {
    id: 'jh-filterer',
    openclaw_agent_id: 'job-hunt-mining/filterer',
    name: 'JH Filterer',
    role: 'Jobs: Filterer',
    emoji: '\u{1F50D}',        // magnifying glass left
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Eligibility filter and rejection-bucket maintainer.',
  },
  {
    id: 'jh-ranker',
    openclaw_agent_id: 'job-hunt-mining/ranker',
    name: 'JH Ranker',
    role: 'Jobs: Ranker',
    emoji: '\u{1F3C6}',        // trophy
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Ranking and top-50 cap enforcement.',
  },
  {
    id: 'jh-verifier',
    openclaw_agent_id: 'job-hunt-mining/verifier',
    name: 'JH Verifier',
    role: 'Jobs: Verifier',
    emoji: '\u{2705}',         // check mark
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Constraint and quality verifier.',
  },
  {
    id: 'jh-reporter',
    openclaw_agent_id: 'job-hunt-mining/reporter',
    name: 'JH Reporter',
    role: 'Jobs: Reporter',
    emoji: '\u{1F4F0}',        // newspaper
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Job-hunt workflow status reporter.',
  },

  // ── Job-Hunt-Materials Pipeline (4) ──────────────────────────────────
  {
    id: 'jm-resume-tailor',
    openclaw_agent_id: 'job-hunt-materials/resume-tailor',
    name: 'JM Resume Tailor',
    role: 'Materials: Resume Tailor',
    emoji: '\u{1F4C4}',        // page facing up
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Tailors resume bullets to match job description keywords and requirements.',
  },
  {
    id: 'jm-cover-letter-writer',
    openclaw_agent_id: 'job-hunt-materials/cover-letter-writer',
    name: 'JM Cover Letter Writer',
    role: 'Materials: Cover Letter Writer',
    emoji: '\u{2709}\u{FE0F}',  // envelope
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Generates personalized cover letters with consistent structure and company-specific tone.',
  },
  {
    id: 'jm-screening-writer',
    openclaw_agent_id: 'job-hunt-materials/screening-writer',
    name: 'JM Screening Writer',
    role: 'Materials: Screening Writer',
    emoji: '\u{1F4AC}',        // speech balloon
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Drafts screening question responses based on job description and candidate background.',
  },
  {
    id: 'jm-materials-verifier',
    openclaw_agent_id: 'job-hunt-materials/materials-verifier',
    name: 'JM Materials Verifier',
    role: 'Materials: Verifier',
    emoji: '\u{2705}',         // check mark
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Quality gate - verifies all application materials for accuracy, tone, and completeness.',
  },

  // ── Bug-Fix Pipeline (6) ─────────────────────────────────────────────
  {
    id: 'bf-triager',
    openclaw_agent_id: 'bug-fix/triager',
    name: 'BF Triager',
    role: 'Bug Fix: Triager',
    emoji: '\u{1F41B}',        // bug
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Analyzes bug reports, reproduces issues, classifies severity.',
  },
  {
    id: 'bf-investigator',
    openclaw_agent_id: 'bug-fix/investigator',
    name: 'BF Investigator',
    role: 'Bug Fix: Investigator',
    emoji: '\u{1F50D}',        // magnifying glass left
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Traces bugs to root cause and proposes fix approach.',
  },
  {
    id: 'bf-setup',
    openclaw_agent_id: 'bug-fix/setup',
    name: 'BF Setup',
    role: 'Bug Fix: Setup',
    emoji: '\u{1F527}',        // wrench
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Creates branch and establishes build/test baseline.',
  },
  {
    id: 'bf-fixer',
    openclaw_agent_id: 'bug-fix/fixer',
    name: 'BF Fixer',
    role: 'Bug Fix: Fixer',
    emoji: '\u{1FA79}',        // adhesive bandage
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Implements bug fixes and writes regression tests.',
  },
  {
    id: 'bf-verifier',
    openclaw_agent_id: 'bug-fix/verifier',
    name: 'BF Verifier',
    role: 'Bug Fix: Verifier',
    emoji: '\u{2705}',         // check mark
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Quality gate - verifies work is correct and complete.',
  },
  {
    id: 'bf-pr',
    openclaw_agent_id: 'bug-fix/pr',
    name: 'BF PR Creator',
    role: 'Bug Fix: PR Creator',
    emoji: '\u{1F4DD}',        // memo
    is_master: false,
    model: 'z.ai/glm-4.7',
    description: 'Creates pull requests with comprehensive documentation.',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log('='.repeat(60));
  console.log('  OpenClaw Mission Control -- Agent Seed Script');
  console.log('='.repeat(60));
  console.log(`  Workspace : ${WORKSPACE_ID}`);
  console.log(`  Agents    : ${AGENTS.length}`);
  console.log(`  Supabase  : ${SUPABASE_URL}`);
  console.log('');

  // ── Step 1: Delete all dependent data ─────────────────────────────────
  console.log('[1/4] Cleaning existing data...');

  const deletionOrder = [
    'task_activities',
    'task_deliverables',
    'planning_questions',
    'planning_specs',
    'openclaw_sessions',
    'events',
    'messages',
    'conversation_participants',
    'conversations',
    'tasks',
    'agents',
  ];

  for (const table of deletionOrder) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .neq('id', '__never_match__'); // delete all rows

    if (error) {
      console.error(`  ERROR deleting ${table}: ${error.message}`);
    } else {
      console.log(`  Deleted from ${table}`);
    }
  }

  console.log('  Done.\n');

  // ── Step 2: Insert all 27 agents ──────────────────────────────────────
  console.log('[2/4] Inserting agents...');

  let inserted = 0;
  let failed = 0;

  for (const agent of AGENTS) {
    // For pipeline agents, try to load system prompt from VPS filesystem
    const systemPrompt = agent.system_prompt ?? pipelineFile(agent.openclaw_agent_id, 'IDENTITY.md');

    const row = {
      id: agent.id,
      openclaw_agent_id: agent.openclaw_agent_id,
      workspace_id: WORKSPACE_ID,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      avatar_emoji: agent.emoji,
      is_master: agent.is_master,
      model: agent.model,
      status: 'standby',
      soul_md: agent.soul_md ?? pipelineFile(agent.openclaw_agent_id, 'SOUL.md'),
      user_md: agent.user_md ?? pipelineFile(agent.openclaw_agent_id, 'USER.md'),
      agents_md: agent.agents_md ?? pipelineFile(agent.openclaw_agent_id, 'AGENTS.md'),
      system_prompt: systemPrompt,
      tools: [],
    };

    const { error } = await supabase.from('agents').insert(row);

    if (error) {
      console.error(`  FAIL  ${agent.emoji} ${agent.name} (${agent.id}): ${error.message}`);
      failed++;
    } else {
      const fileSizes = [
        systemPrompt.length > 0 ? `prompt:${systemPrompt.length}` : '',
        row.soul_md.length > 0 ? `soul:${row.soul_md.length}` : '',
        row.user_md.length > 0 ? `user:${row.user_md.length}` : '',
        row.agents_md.length > 0 ? `agents:${row.agents_md.length}` : '',
      ].filter(Boolean).join(', ');
      const filesNote = fileSizes ? ` [${fileSizes}]` : '';
      console.log(`  OK    ${agent.emoji} ${agent.name} (${agent.id})${filesNote}`);
      inserted++;
    }
  }

  console.log(`  Inserted: ${inserted}, Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('WARNING: Some agents failed to insert. Check errors above.');
  }

  // ── Step 3: Create workspace event ────────────────────────────────────
  console.log('[3/4] Creating workspace sync event...');

  const { error: eventError } = await supabase.from('events').insert({
    workspace_id: WORKSPACE_ID,
    agent_id: 'bob',
    type: 'system',
    message: `Mission Control synced with ${AGENTS.length} OpenClaw agents`,
    metadata: {
      action: 'seed',
      agent_count: AGENTS.length,
      pipelines: ['feature-dev', 'security-audit', 'job-hunt-mining', 'job-hunt-materials', 'bug-fix'],
      seeded_at: new Date().toISOString(),
    },
  });

  if (eventError) {
    console.error(`  ERROR creating event: ${eventError.message}`);
  } else {
    console.log('  Event created.\n');
  }

  // ── Step 4: Create team conversation with all agents ──────────────────
  console.log('[4/4] Creating team conversation...');

  const conversationId = 'conv-team-openclaw';

  const { error: convError } = await supabase.from('conversations').insert({
    id: conversationId,
    workspace_id: WORKSPACE_ID,
    title: 'OpenClaw Team',
    conversation_type: 'team',
  });

  if (convError) {
    console.error(`  ERROR creating conversation: ${convError.message}`);
  } else {
    console.log(`  Conversation created: ${conversationId}`);

    // Add every agent as a participant
    const participants = AGENTS.map((a) => ({
      conversation_id: conversationId,
      agent_id: a.id,
    }));

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participants);

    if (partError) {
      console.error(`  ERROR adding participants: ${partError.message}`);
    } else {
      console.log(`  Added ${participants.length} participants.`);
    }

    // Insert a welcome message from Bob
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: 'bob',
      content: `All ${AGENTS.length} OpenClaw agents synced and standing by. Pipelines: feature-dev, security-audit, job-hunt-mining, bug-fix.`,
      message_type: 'text',
      metadata: { source: 'seed-script' },
    });

    if (msgError) {
      console.error(`  ERROR inserting welcome message: ${msgError.message}`);
    } else {
      console.log('  Welcome message posted.');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('');
  console.log('='.repeat(60));
  console.log(`  Seed complete. ${inserted}/${AGENTS.length} agents inserted.`);
  console.log('='.repeat(60));
}

seed().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
