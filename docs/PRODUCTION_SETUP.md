# Production Setup Guide

This guide walks you through setting up Mission Control for production use with proper configuration management.

## ⚠️ Security First

**NEVER commit sensitive data to the repository!** This includes:
- IP addresses
- User paths
- Authentication tokens
- API keys
- Database credentials

All sensitive values go in `.env.local` (which is gitignored).

## 📦 Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mission-control.git
cd mission-control
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Database
DATABASE_PATH=./mission-control.db

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here

# Workspace Paths
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects

# API URL (auto-detected if not set)
MISSION_CONTROL_URL=http://localhost:4000
```

### 4. Initialize Database

```bash
npm run db:seed
```

This creates the database and seeds it with:
- the master agent
- Sample tasks
- Default business

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:4000](http://localhost:4000)

## ⚙️ Configuration Management

Mission Control supports configuration via **two methods**:

### Method 1: Environment Variables (.env.local)

Best for:
- Server-side configuration
- Deployment environments
- Team consistency

Variables in `.env.local`:
```bash
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects
MISSION_CONTROL_URL=http://your-server-ip:4000
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
```

### Method 2: Settings UI

Best for:
- User-specific preferences
- Quick adjustments
- Per-user customization

Access via: **Settings** button (top-right) or `/settings`

Settings stored in browser localStorage:
- Workspace base path
- Projects path
- Mission Control API URL
- Default project name

**Priority:** Environment variables override UI settings for server operations.

## 📁 Workspace Structure

Mission Control organizes files in a structured workspace:

```
~/Documents/Shared/              # Base workspace
├── projects/                    # All projects
│   ├── [PROJECT_NAME_1]/       # Individual project
│   │   ├── deliverables/       # Task deliverables
│   │   ├── docs/               # Project docs
│   │   └── README.md
│   └── [PROJECT_NAME_2]/
└── mission-control/             # Mission Control app
    └── mission-control.db       # Database
```

### Configuring Paths

**Via Environment Variables:**
```bash
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects
```

**Via Settings UI:**
1. Click **Settings** (gear icon)
2. Update "Workspace Base Path"
3. Update "Projects Path"
4. Click **Save Changes**

### Path Variables

- `~` expands to your home directory
- Paths can be absolute: `/home/user/workspace`
- Paths can be relative: `./workspace`

## 🔌 OpenClaw Gateway Setup

### Local Connection

```bash
# .env.local
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
```

No token required for local connections.

### Remote Connection (Tailscale)

```bash
# .env.local
OPENCLAW_GATEWAY_URL=wss://your-machine.tail12345.ts.net
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
```

**Generate a secure token:**
```bash
openssl rand -hex 32
```

Copy this token to both:
1. Mission Control's `.env.local`
2. OpenClaw's gateway configuration

## Security Model

### Current Posture (as of Feb 2026)

Port 4000 is bound to **all interfaces** (`*:4000`), not just the Tailscale interface.

**Active interfaces on the VPS:**

| Interface | Address | Scope |
|-----------|---------|-------|
| `eth0` | `187.77.16.86` | Public internet |
| `tailscale0` | `100.99.237.12` | Tailscale VPN (WireGuard) |

**Firewall status:**
- UFW is not installed on the server
- iptables rules could not be verified remotely (requires sudo password)
- No application-level port binding restriction to Tailscale interface

This means port 4000 is **potentially reachable from the public internet** unless the VPS host-provider's perimeter firewall (e.g. Hetzner/DigitalOcean network firewall) blocks it externally.

### Defence Layers Currently Active

- **Bearer Token Auth**: All API requests require `MC_API_TOKEN` in the `Authorization` header. Same-origin browser requests are exempted by middleware (`src/middleware.ts`). Without the token, all API endpoints return 401.
- **Webhook HMAC**: Agent completion webhooks are verified via HMAC-SHA256 signature, preventing spoofed completions.
- **Security Headers**: Configured in `next.config.mjs`:
  - `Strict-Transport-Security` (HSTS)
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
- **Tailscale VPN**: WireGuard-encrypted tunnel used to reach the server for SSH and browser access. All personal devices (MacBook, iPhone) are enrolled in the same Tailscale network.

### Risk: Port 4000 on Public Interface

If the host-provider firewall does not block port 4000, an attacker on the public internet can:
1. Reach the Mission Control login/API surface directly at `http://187.77.16.86:4000`
2. Attempt to brute-force the bearer token
3. Probe for unauthenticated endpoints

The bearer token is the only barrier in this scenario. There is no rate limiting, no IP allowlist, and no TLS (traffic is plaintext HTTP over the public interface).

### Recommended Mitigations (in priority order)

1. **Verify host-provider firewall** — Check the Hetzner/DigitalOcean/provider console to confirm whether port 4000 is blocked at the network perimeter. This is the quickest win with no code change required.

2. **Install UFW and restrict port 4000** — Bind access to Tailscale only:
   ```bash
   ssh openclaw "sudo apt install -y ufw && sudo ufw default deny incoming && sudo ufw allow ssh && sudo ufw allow in on tailscale0 to any port 4000 && sudo ufw enable"
   ```
   This allows port 4000 only on the Tailscale interface while keeping SSH open on all interfaces.

3. **Bind Next.js to Tailscale IP only** — Change the systemd service start command from `npm start` to:
   ```
   next start -H 100.99.237.12 -p 4000
   ```
   This prevents Next.js from listening on `eth0` at all. If the Tailscale IP ever changes (rare but possible on re-enrollment), the service will fail to start until the env var is updated.

4. **Add TLS** — Terminate HTTPS via a reverse proxy (nginx + Let's Encrypt or Tailscale's built-in HTTPS with `tailscale cert`). Currently traffic is plaintext HTTP even over Tailscale.

### Access Path for Normal Use

Normal operation: browser on MacBook (`100.85.83.23`) -> Tailscale WireGuard tunnel -> VPS Tailscale IP (`100.99.237.12:4000`). This path is encrypted by WireGuard regardless of the port binding issue above.

---

## Production Deployment

### Server Details

- **VPS**: Ubuntu 24.04, SSH alias `openclaw`
- **App path**: `/home/deploy/mission-control/`
- **Port**: 4000
- **Process manager**: systemd user service (`mission-control.service`)
- **Tailscale IP**: accessible via `100.99.237.12:4000`
- **Database**: Supabase Postgres (no local DB)

### Systemd Service

The app runs as a systemd user service at `~/.config/systemd/user/mission-control.service`. This auto-starts on boot and auto-restarts on crash. **Never use `nohup npm start &`** — it creates zombie processes that conflict with systemd.

### Deploy Process (copy-paste ready)

```bash
# 1. Sync files to VPS (from local project root)
rsync -az --delete \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=.env --exclude=.env.local --exclude='*.pem' \
  --exclude=.DS_Store --exclude=.claude/ --exclude=.kilocode/ \
  --exclude=.vscode/ --exclude=.mcp.json --exclude=opencode.json \
  --exclude=ecosystem.config.cjs --exclude=mission-control.db \
  ./ openclaw:/home/deploy/mission-control/

# 2. Install deps + build on VPS
ssh -T openclaw "cd /home/deploy/mission-control && npm install && npm run build"

# 3. Restart via systemd (single command, no hanging)
ssh -T openclaw "systemctl --user restart mission-control.service"

# 4. Verify (wait a few seconds for startup)
sleep 3
ssh -T openclaw "systemctl --user is-active mission-control.service && curl -s -o /dev/null -w '%{http_code}' http://localhost:4000"
```

Expected output: `active200`

### Why SSH Hangs (and how to avoid it)

SSH hangs when a child process (like `npm start`) keeps stdout/stderr open. Solutions:

- **Use systemd** (correct): `systemctl --user restart mission-control.service` returns immediately
- **Never use**: `nohup npm start &` over SSH (hangs), `npm start > /tmp/log 2>&1 &` (hangs)
- **If you must run manually**: `ssh -T openclaw "nohup npm start > /tmp/mc.log 2>&1 < /dev/null & disown"` — but this creates a process outside systemd that conflicts on restart

### Troubleshooting

**Port conflict (EADDRINUSE):**
```bash
# Check what's on the port
ssh -T openclaw "fuser 4000/tcp"
# Kill it
ssh -T openclaw "fuser -k 4000/tcp"
# Then restart via systemd
ssh -T openclaw "systemctl --user restart mission-control.service"
```

**Check logs:**
```bash
ssh -T openclaw "journalctl --user -u mission-control.service --no-pager -n 30"
```

**Service status:**
```bash
ssh -T openclaw "systemctl --user status mission-control.service"
```

## 🧪 Testing Your Setup

### 1. Verify Configuration

```bash
# Check environment variables
cat .env.local

# Verify database
ls -la mission-control.db
```

### 2. Test OpenClaw Connection

1. Start OpenClaw Gateway: `openclaw gateway`
2. Open Mission Control: `http://localhost:4000`
3. Check status indicator (top-right): Should show **ONLINE** (green)

### 3. Test Real-Time Updates

1. Create a task
2. Assign it to an agent
3. Drag to "In Progress"
4. Watch it update in real-time (no refresh needed)

✅ **Task cards should move between columns instantly**

### 4. Test Deliverables

1. Open a task with deliverables
2. Click the arrow (→) button next to a file deliverable
3. File path should copy to clipboard

## 🔧 Troubleshooting

### Real-Time Updates Not Working

**Symptom:** Task cards don't move when status changes

**Solutions:**
1. Check browser console for SSE errors
2. Verify SSE endpoint: `/api/events/stream`
3. Clear browser cache
4. Restart dev server

### OpenClaw Not Connecting

**Symptom:** Status shows OFFLINE

**Solutions:**
1. Verify Gateway is running: `openclaw gateway status`
2. Check `OPENCLAW_GATEWAY_URL` in `.env.local`
3. For remote: Verify `OPENCLAW_GATEWAY_TOKEN` matches
4. Test WebSocket connection: `wscat -c ws://127.0.0.1:18789`

### Deliverables Button Not Working

**Symptom:** Arrow button does nothing

**Solutions:**
1. Check browser clipboard permissions
2. Look for console errors
3. Try on a task with a file deliverable (not URL)

### Hardcoded Paths in Code

**Symptom:** Paths still reference wrong user

**Solution:** All hardcoded paths have been removed! If you find any:
1. File a bug report
2. Use `getWorkspaceBasePath()` or `getProjectsPath()` from `@/lib/config`

## 📚 Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./mission-control.db` | SQLite database file path |
| `WORKSPACE_BASE_PATH` | `~/Documents/Shared` | Base directory for workspace |
| `PROJECTS_PATH` | `~/Documents/Shared/projects` | Directory for project folders |
| `MISSION_CONTROL_URL` | Auto-detected | API URL for agent orchestration |
| `OPENCLAW_GATEWAY_URL` | `ws://127.0.0.1:18789` | Gateway WebSocket URL |
| `OPENCLAW_GATEWAY_TOKEN` | (empty) | Authentication token |

### Settings UI Fields

| Setting | Description |
|---------|-------------|
| Workspace Base Path | Root directory for all Mission Control files |
| Projects Path | Where individual project folders are created |
| Default Project Name | Template name for new projects |
| Mission Control URL | API endpoint (usually auto-detected) |

## 🎯 Next Steps

1. ✅ Configure `.env.local`
2. ✅ Run database seed
3. ✅ Start dev server
4. ✅ Test real-time updates
5. ✅ Configure workspace paths
6. 🚀 Create your first agent!

## 📖 Further Reading

- [Agent Protocol Documentation](docs/AGENT_PROTOCOL.md)
- [Real-Time Implementation](REALTIME_IMPLEMENTATION_SUMMARY.md)
- [the orchestrator Orchestration Guide](src/lib/orchestration.ts)
- [Verification Checklist](VERIFICATION_CHECKLIST.md)

---

**Questions?** File an issue or check the documentation in `/docs`.
