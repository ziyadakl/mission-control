#!/usr/bin/env npx tsx
/**
 * Add Job Hunt Materials template to database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('Adding Job Hunt Materials template...\n');

  // Check if template already exists
  const { data: existing } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('slug', 'job-hunt-materials')
    .single();

  if (existing) {
    console.log('Template job-hunt-materials already exists');
    return;
  }

  // Create the template
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .insert({
      id: 'tmpl-job-hunt-materials',
      slug: 'job-hunt-materials',
      name: 'Job Hunt Materials',
      description: 'Generate tailored materials for job applications: resume, cover letter, and screening responses',
      category: 'job-hunt',
      stage_count: 4,
      stages: [
        {
          stage: 1,
          name: 'Resume Tailoring',
          description: 'Tailor resume for specific job listing',
          agent_id: 'jm-resume-tailor',
          role_slug: 'resume-tailor'
        },
        {
          stage: 2,
          name: 'Cover Letter Writing',
          description: 'Write personalized cover letter',
          agent_id: 'jm-cover-letter-writer',
          role_slug: 'cover-letter-writer'
        },
        {
          stage: 3,
          name: 'Screening Responses',
          description: 'Write screening question responses',
          agent_id: 'jm-screening-writer',
          role_slug: 'screening-writer'
        },
        {
          stage: 4,
          name: 'Materials Verification',
          description: 'Verify all materials are ATS-compliant and professional',
          agent_id: 'jm-materials-verifier',
          role_slug: 'materials-verifier'
        }
      ],
      is_deployed: true,
      handoff_config: {
        enabled: false
      }
    })
    .select()
    .single();

  if (templateError) {
    console.error('Failed to create template:', templateError);
    process.exit(1);
  }

  console.log('✓ Created template:', template.name);
  console.log('  ID:', template.id);
  console.log('  Stages:', template.stage_count);
  
  console.log('\n✅ Job Hunt Materials template added successfully!');
  console.log('Refresh Mission Control to see it in the dropdown.');
}

main();
