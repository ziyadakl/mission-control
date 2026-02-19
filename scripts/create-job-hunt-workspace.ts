#!/usr/bin/env npx tsx
/**
 * Create Job Hunt Workspace and Reorganize Agents
 * 
 * Creates a dedicated "Job Hunt" workspace and moves all
 * job hunt agents (discovery + materials) into it.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const JOB_HUNT_AGENT_IDS = [
  // JOB HUNT 6 (Discovery Pipeline)
  'jh-discoverer',
  'jh-enricher',
  'jh-filterer',
  'jh-ranker',
  'jh-verifier',
  'jh-reporter',
  // JOB HUNT MATERIALS 4 (Materials Pipeline)
  'jm-resume-tailor',
  'jm-cover-letter-writer',
  'jm-screening-writer',
  'jm-materials-verifier',
];

const TEMPLATE_SLUGS = ['job-hunt-mining', 'job-hunt-materials'];

async function main() {
  console.log('='.repeat(60));
  console.log('Creating Job Hunt Workspace');
  console.log('='.repeat(60));

  // Step 1: Create Job Hunt workspace
  console.log('\n📁 Creating workspace...');
  const { data: existingWs } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', 'job-hunt')
    .single();

  let wsId: string;

  if (existingWs) {
    console.log('   Workspace "job-hunt" already exists, using it.');
    wsId = 'ws-job-hunt';
  } else {
    const { data: newWs, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        id: 'ws-job-hunt',
        slug: 'job-hunt',
        name: 'Job Hunt',
        description: 'Job search workflow with discovery and materials generation',
        settings: {
          groups: [
            {
              name: 'JOB HUNT',
              count: 6,
              description: 'Discovery pipeline: find, enrich, filter, rank, verify, report'
            },
            {
              name: 'JOB HUNT MATERIALS',
              count: 4,
              description: 'Materials pipeline: tailor resume, write cover letter, write screening, verify'
            }
          ]
        }
      })
      .select('id')
      .single();

    if (wsError) {
      console.error('❌ Failed to create workspace:', wsError);
      process.exit(1);
    }

    wsId = 'ws-job-hunt';
    console.log('   ✓ Created workspace: job-hunt (ID:', wsId + ')');
  }

  // Step 2: Move agents to new workspace
  console.log('\n🤖 Moving agents to Job Hunt workspace...');
  for (const agentId of JOB_HUNT_AGENT_IDS) {
    const { error } = await supabase
      .from('agents')
      .update({ workspace_id: wsId })
      .eq('id', agentId);

    if (error) {
      console.error(`   ✗ ${agentId}:`, error.message);
    } else {
      const group = agentId.startsWith('jm-') ? 'MATERIALS' : 'HUNT';
      console.log(`   ✓ ${agentId} → ${group}`);
    }
  }

  // Step 3: Update workflow templates
  console.log('\n📋 Updating workflow templates...');
  for (const slug of TEMPLATE_SLUGS) {
    const { error } = await supabase
      .from('workflow_templates')
      .update({ workspace_id: wsId })
      .eq('slug', slug);

    if (error) {
      console.error(`   ✗ ${slug}:`, error.message);
    } else {
      console.log(`   ✓ ${slug} → job-hunt`);
    }
  }

  // Step 4: Verify
  console.log('\n🔍 Verification...');
  const { data: agents } = await supabase
    .from('agents')
    .select('id, workspace_id')
    .eq('workspace_id', wsId);

  const huntCount = agents?.filter(a => a.id.startsWith('jh-')).length || 0;
  const materialsCount = agents?.filter(a => a.id.startsWith('jm-')).length || 0;

  console.log(`   Agents in job-hunt workspace: ${agents?.length || 0}`);
  console.log(`   - JOB HUNT: ${huntCount}`);
  console.log(`   - JOB HUNT MATERIALS: ${materialsCount}`);

  const { data: templates } = await supabase
    .from('workflow_templates')
    .select('slug, workspace_id')
    .eq('workspace_id', wsId);

  console.log(`   Templates in job-hunt workspace: ${templates?.length || 0}`);
  templates?.forEach(t => console.log(`   - ${t.slug}`));

  console.log('\n' + '='.repeat(60));
  console.log('✅ Job Hunt workspace reorganized successfully!');
  console.log('='.repeat(60));
}

main();
