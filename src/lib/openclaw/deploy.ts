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

export interface DeployRole {
  role_slug: string;
  display_name: string;
  identity_text: string;
  soul_text: string;
  model_primary: string;
  tool_profile: string;
  tools_allow: string[];
  tools_deny: string[];
}

export async function deployTemplate(templateSlug: string, roles: DeployRole[]) {
  const results: string[] = [];

  for (const role of roles) {
    const agentId = `${templateSlug}/${role.role_slug}`;
    const workspaceDir = `${WORKFLOWS_BASE}/${templateSlug}/agents/${role.role_slug}`;

    // Create workspace dir
    await sshExec(`mkdir -p ${workspaceDir}`);

    // Write IDENTITY.md using base64 encoding to safely transfer content over SSH
    const identityB64 = Buffer.from(role.identity_text).toString('base64');
    await sshExec(`echo '${identityB64}' | base64 -d > ${workspaceDir}/IDENTITY.md`);

    // Write SOUL.md using base64
    const soulB64 = Buffer.from(role.soul_text).toString('base64');
    await sshExec(`echo '${soulB64}' | base64 -d > ${workspaceDir}/SOUL.md`);

    // Add agent via CLI (may fail if already exists — that's ok for re-deploy)
    try {
      await sshExec(`openclaw agents add "${agentId}" --workspace ${workspaceDir} --model ${role.model_primary} --non-interactive`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Agent might already exist — that's fine for re-deploys
      if (!msg.includes('already exists')) {
        throw e;
      }
      results.push(`${agentId} already exists, updating files only`);
    }

    // Update tools deny list in openclaw.json via jq
    const denyJson = JSON.stringify(role.tools_deny);
    await sshExec(`cd ~/.openclaw && cat openclaw.json | jq '(.agents.list[] | select(.id == "${agentId}") | .tools.deny) = ${denyJson.replace(/'/g, "\\'")}' > openclaw.tmp.json && mv openclaw.tmp.json openclaw.json`);

    // Update tools allow list if any
    if (role.tools_allow.length > 0) {
      const allowJson = JSON.stringify(role.tools_allow);
      await sshExec(`cd ~/.openclaw && cat openclaw.json | jq '(.agents.list[] | select(.id == "${agentId}") | .tools.alsoAllow) = ${allowJson.replace(/'/g, "\\'")}' > openclaw.tmp.json && mv openclaw.tmp.json openclaw.json`);
    }

    results.push(`Deployed ${agentId}`);
  }

  // Add all new agents to tools.agentToAgent.allow for Bob (orchestrator)
  const allAgentIds = roles.map(r => `${templateSlug}/${r.role_slug}`);
  for (const agentId of allAgentIds) {
    await sshExec(`cd ~/.openclaw && cat openclaw.json | jq 'if (.tools.agentToAgent.allow | index("${agentId}")) then . else .tools.agentToAgent.allow += ["${agentId}"] end' > openclaw.tmp.json && mv openclaw.tmp.json openclaw.json`);
  }

  // Restart gateway so new agents are picked up
  await sshExec('pkill -f "openclaw gateway" || true; sleep 1; nohup openclaw gateway > /dev/null 2>&1 &');

  return results;
}
