# Phase 1: Harden & Automate — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the highest-impact improvements from each category (deployment, security, observability, features) in a single sprint.

**Architecture:** Hardens existing rsync+systemd deploy pipeline with CI/CD automation and `output: 'standalone'`. Fixes two security vulnerabilities in file APIs. Adds heartbeat scheduling and structured logging. No new dependencies or infrastructure.

**Tech Stack:** Next.js 14.2 (standalone output), GitHub Actions, systemd, cron, Zod, Node.js child_process

---

### Task 1: Add `output: 'standalone'` to Next.js config

**Files:**
- Modify: `next.config.mjs:2`

**Step 1: Add standalone output**

In `next.config.mjs`, add `output: 'standalone'` to the config object:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
```

**Step 2: Verify build works**

Run: `npm run build`
Expected: Build succeeds. `.next/standalone/` directory is created containing `server.js`.

**Step 3: Verify standalone server starts**

Run: `node .next/standalone/server.js`
Expected: Server starts on port 3000 (default). Ctrl-C to stop. We'll configure port 4000 via `PORT` env var on the server.

**Step 4: Commit**

```bash
git add next.config.mjs
git commit -m "feat: enable Next.js standalone output for lighter deploys"
```

---

### Task 2: Fix shell injection in `/api/files/reveal`

**Files:**
- Modify: `src/app/api/files/reveal/route.ts:7,12,52-65`

**Step 1: Replace `exec` with `execFile`**

Change the import on line 7:
```typescript
// Before
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// After
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
```

Replace the command execution block (lines 52-65):
```typescript
// Before (shell injection risk - string interpolation in exec)
const platform = process.platform;
let command: string;
if (platform === 'darwin') {
  command = `open -R "${normalizedPath}"`;
} else if (platform === 'win32') {
  command = `explorer /select,"${normalizedPath}"`;
} else {
  command = `xdg-open "${path.dirname(normalizedPath)}"`;
}
await execAsync(command);

// After (safe - argument array, no shell)
const platform = process.platform;
if (platform === 'darwin') {
  await execFileAsync('open', ['-R', normalizedPath]);
} else if (platform === 'win32') {
  await execFileAsync('explorer', ['/select,' + normalizedPath]);
} else {
  await execFileAsync('xdg-open', [path.dirname(normalizedPath)]);
}
```

**Step 2: Verify lint passes**

Run: `npm run lint`
Expected: No errors.

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/files/reveal/route.ts
git commit -m "fix(security): replace exec with execFile in file reveal to prevent shell injection"
```

---

### Task 3: Fix weak path traversal in `/api/files/upload`

**Files:**
- Modify: `src/app/api/files/upload/route.ts:41-51`

**Step 1: Replace string prefix check with resolve-based check**

Replace the path traversal check (lines 41-51):
```typescript
// Before (weak - only checks prefix of normalized relative path)
const normalizedPath = path.normalize(relativePath);
if (normalizedPath.startsWith('..') || normalizedPath.startsWith('/')) {
  return NextResponse.json(
    { error: 'Invalid path: must be relative and cannot traverse upward' },
    { status: 400 }
  );
}

// Build full path
const fullPath = path.join(PROJECTS_BASE, normalizedPath);

// After (strong - resolves to absolute and verifies within base)
const normalizedPath = path.normalize(relativePath);
const fullPath = path.resolve(PROJECTS_BASE, normalizedPath);
const resolvedBase = path.resolve(PROJECTS_BASE);

if (!fullPath.startsWith(resolvedBase + path.sep) && fullPath !== resolvedBase) {
  return NextResponse.json(
    { error: 'Invalid path: must be within the projects directory' },
    { status: 400 }
  );
}
```

**Step 2: Verify lint passes**

Run: `npm run lint`
Expected: No errors.

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/files/upload/route.ts
git commit -m "fix(security): use path.resolve for robust path traversal prevention in file upload"
```

---

### Task 4: Tighten rsync excludes and clean up server

**Files:**
- Modify: `docs/PRODUCTION_SETUP.md` (update deploy command)
- Modify: `CLAUDE.md` (update deploy command)

**Step 1: Update deploy command in CLAUDE.md**

Find the rsync command in CLAUDE.md and update to:
```bash
rsync -az --delete \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=.env --exclude=.env.local --exclude='*.pem' \
  --exclude=.DS_Store --exclude=.claude/ --exclude=.kilocode/ \
  --exclude=.vscode/ --exclude=.mcp.json --exclude=opencode.json \
  --exclude=ecosystem.config.cjs --exclude=mission-control.db \
  ./ openclaw:/home/deploy/mission-control/
```

**Step 2: Update deploy command in PRODUCTION_SETUP.md**

Apply the same rsync exclude list.

**Step 3: Clean up existing artifacts on server**

Run via SSH:
```bash
ssh -T openclaw "cd /home/deploy/mission-control && rm -f .DS_Store mission-control.db ecosystem.config.cjs .mcp.json opencode.json && rm -rf .claude .kilocode .vscode"
```

**Step 4: Commit**

```bash
git add CLAUDE.md docs/PRODUCTION_SETUP.md
git commit -m "chore: tighten rsync excludes, remove stale dev artifacts from server"
```

---

### Task 5: Add GitHub Actions CI/CD pipeline

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create the workflow file**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Deploy via rsync
        env:
          SSH_PRIVATE_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          SSH_HOST: ${{ secrets.DEPLOY_HOST }}
          SSH_USER: ${{ secrets.DEPLOY_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "$SSH_HOST" >> ~/.ssh/known_hosts 2>/dev/null

          # Sync standalone build + static assets + public
          rsync -az --delete \
            -e "ssh -i ~/.ssh/deploy_key" \
            .next/standalone/ \
            "$SSH_USER@$SSH_HOST:/home/deploy/mission-control/"

          rsync -az \
            -e "ssh -i ~/.ssh/deploy_key" \
            .next/static/ \
            "$SSH_USER@$SSH_HOST:/home/deploy/mission-control/.next/static/"

          rsync -az \
            -e "ssh -i ~/.ssh/deploy_key" \
            public/ \
            "$SSH_USER@$SSH_HOST:/home/deploy/mission-control/public/"

      - name: Restart service
        env:
          SSH_PRIVATE_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          SSH_HOST: ${{ secrets.DEPLOY_HOST }}
          SSH_USER: ${{ secrets.DEPLOY_USER }}
        run: |
          ssh -i ~/.ssh/deploy_key "$SSH_USER@$SSH_HOST" \
            "systemctl --user restart mission-control.service"
```

**Step 2: Document required GitHub secrets**

Three secrets need to be added in GitHub repo settings → Secrets:
- `DEPLOY_SSH_KEY`: SSH private key for the `deploy` user (generate a dedicated deploy key, not personal)
- `DEPLOY_HOST`: VPS IP or Tailscale hostname
- `DEPLOY_USER`: `deploy`

**Step 3: Update systemd service for standalone mode**

SSH into server and update `~/.config/systemd/user/mission-control.service`:
- Change `ExecStart` from `npm start` to `node /home/deploy/mission-control/server.js`
- Add `Environment=PORT=4000` if not already set in `.env.local`

```bash
ssh -T openclaw "systemctl --user cat mission-control.service"
# Review current config, then edit:
ssh -T openclaw "nano ~/.config/systemd/user/mission-control.service"
ssh -T openclaw "systemctl --user daemon-reload && systemctl --user restart mission-control.service"
```

**Step 4: Verify service starts with standalone server**

```bash
ssh -T openclaw "systemctl --user status mission-control.service"
```
Expected: `active (running)`.

**Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions CI/CD pipeline for automated deploys"
```

---

### Task 6: Confirm Tailscale-only access and document security model

**Files:**
- Modify: `docs/PRODUCTION_SETUP.md` (add security model section)

**Step 1: Verify port 4000 binding**

```bash
ssh -T openclaw "ss -tlnp | grep 4000"
```

Check: Is it bound to `0.0.0.0:4000` (all interfaces) or `100.x.x.x:4000` (Tailscale only)?

If bound to `0.0.0.0`, check if the host firewall or VPS provider firewall blocks external access:
```bash
ssh -T openclaw "sudo ufw status 2>/dev/null; curl -s --max-time 5 ifconfig.me"
```

**Step 2: If port is publicly accessible, restrict it**

Option A — Bind to Tailscale only: Add `HOSTNAME=100.x.x.x` to `.env.local` and update Next.js start command.

Option B — Add UFW rule:
```bash
ssh -T openclaw "sudo ufw allow from 100.64.0.0/10 to any port 4000 && sudo ufw deny 4000 && sudo ufw enable"
```

**Step 3: Document the security model in PRODUCTION_SETUP.md**

Add a section explaining:
- Port 4000 is only accessible via Tailscale encrypted tunnel
- No TLS needed because Tailscale provides WireGuard encryption
- Bearer token auth via `MC_API_TOKEN` for API access
- Same-origin browser requests exempted by middleware

**Step 4: Commit**

```bash
git add docs/PRODUCTION_SETUP.md
git commit -m "docs: document Tailscale security model, verify port access"
```

---

### Task 7: Set up heartbeat cron job

**Files:**
- No code changes — VPS configuration only

**Step 1: Add cron job on server**

```bash
ssh -T openclaw "crontab -l 2>/dev/null; echo '*/5 * * * * curl -sf http://localhost:4000/api/heartbeat?token=\$(cat /home/deploy/mission-control/.env.local | grep MC_API_TOKEN | cut -d= -f2) >> /home/deploy/heartbeat.log 2>&1' | crontab -"
```

Alternative (simpler, hardcode token):
```bash
ssh -T openclaw "echo '*/5 * * * * curl -sf \"http://localhost:4000/api/heartbeat?token=TOKEN_HERE\" >> /home/deploy/heartbeat.log 2>&1' | crontab -"
```

**Step 2: Verify cron is active**

```bash
ssh -T openclaw "crontab -l"
```
Expected: Shows the heartbeat cron entry.

**Step 3: Wait 5 minutes and check log**

```bash
ssh -T openclaw "cat /home/deploy/heartbeat.log"
```
Expected: JSON response from the heartbeat endpoint.

**Step 4: Add log rotation**

```bash
ssh -T openclaw "echo '/home/deploy/heartbeat.log { weekly rotate 4 compress missingok notifempty }' | sudo tee /etc/logrotate.d/heartbeat"
```

---

### Task 8: Add structured logging helper

**Files:**
- Create: `src/lib/logger.ts`
- Modify: `src/app/api/heartbeat/route.ts` (example usage)

**Step 1: Create the logger**

```typescript
// src/lib/logger.ts

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
}

function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(data && { data }),
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => log('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => log('error', event, data),
};
```

**Step 2: Apply to heartbeat endpoint as a proof of concept**

In the heartbeat route handler, replace key `console.log` calls with `logger.info`:
```typescript
import { logger } from '@/lib/logger';

// Replace: console.log(`[Heartbeat] Processing ${tasks.length} tasks`);
// With:
logger.info('heartbeat.run', { taskCount: tasks.length });
```

Note: Do NOT replace all console.log calls project-wide. Just the heartbeat endpoint as proof of concept. Migrate other routes incrementally in future commits.

**Step 3: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: Both pass.

**Step 4: Commit**

```bash
git add src/lib/logger.ts src/app/api/heartbeat/route.ts
git commit -m "feat: add structured JSON logger, apply to heartbeat endpoint"
```

---

### Task 9: Clean up stale docs

**Files:**
- Modify: `docs/PRODUCTION_SETUP.md`

**Step 1: Read current PRODUCTION_SETUP.md**

Read the file and identify all references to SQLite, `DATABASE_PATH`, `mission-control.db`, or any pre-Supabase database setup.

**Step 2: Remove stale SQLite references**

- Remove `DATABASE_PATH` from the env var table
- Remove any mentions of `mission-control.db`
- Ensure Supabase env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are documented
- Update the "Prerequisites" section if it mentions SQLite

**Step 3: Verify accuracy**

Cross-reference with `.env.example` (if it exists) and the actual `.env.local` var names from the SSH diagnostic.

**Step 4: Commit**

```bash
git add docs/PRODUCTION_SETUP.md
git commit -m "docs: remove stale SQLite references from PRODUCTION_SETUP, update for Supabase"
```

---

## Summary

| Task | Category | Risk | Time Estimate |
|------|----------|------|---------------|
| 1. Standalone output | Deploy | Low | 5 min |
| 2. Fix shell injection | Security | Low | 10 min |
| 3. Fix path traversal | Security | Low | 10 min |
| 4. Tighten rsync | Deploy | Low | 10 min |
| 5. GitHub Actions CI/CD | Deploy | Medium | 30 min |
| 6. Verify Tailscale access | Security | Medium | 15 min |
| 7. Heartbeat cron | Observability | Low | 10 min |
| 8. Structured logger | Observability | Low | 15 min |
| 9. Clean up stale docs | Docs | Low | 10 min |

**Total: 9 tasks, ~2 hours of work.**

Dependencies: Task 5 (CI/CD) depends on Task 1 (standalone output) being merged to main first, since the CI/CD workflow deploys the standalone build. All other tasks are independent.
