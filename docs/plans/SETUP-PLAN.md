> **STATUS: COMPLETED** -- This setup guide was followed and completed in February 2026.
> OpenClaw is deployed and running at `https://srv1360790.tail30bf7c.ts.net`
>
> This document is kept as a reference for troubleshooting and disaster recovery.
> **Do NOT follow these steps again -- the server is already set up.**

# OpenClaw: Complete A-Z Setup Plan
### $0/Month Cloud Deployment with Maximum Security

---

## TABLE OF CONTENTS

1. [What Is OpenClaw?](#1-what-is-openclaw)
2. [What You'll Need Before Starting](#2-what-youll-need-before-starting)
3. [The Cost Breakdown (Real Numbers)](#3-the-cost-breakdown)
4. [Phase 1: Create Your Free Cloud Server](#phase-1-create-your-free-cloud-server)
5. [Phase 2: Lock Down Your Server Like a Vault](#phase-2-lock-down-your-server-like-a-vault)
6. [Phase 3: Install OpenClaw](#phase-3-install-openclaw)
7. [Phase 4: Set Up Your Free AI Providers](#phase-4-set-up-your-free-ai-providers)
8. [Phase 5: Configure OpenClaw Securely](#phase-5-configure-openclaw-securely)
9. [Phase 6: Set Up Messaging (Telegram)](#phase-6-set-up-messaging)
10. [Phase 7: Install Skills (Safely)](#phase-7-install-skills)
11. [Phase 8: Keep It Running 24/7](#phase-8-keep-it-running)
12. [Phase 9: Monitor and Maintain](#phase-9-monitor-and-maintain)
13. [Optional: Paid AI Upgrades](#optional-paid-ai-upgrades)
14. [Security Cheat Sheet](#security-cheat-sheet)
15. [Troubleshooting](#troubleshooting)
16. [Disaster Recovery](#disaster-recovery)
17. [Critical Warnings](#critical-warnings)
18. [Speed Up Your Setup](#speed-up-your-setup-cut-2-3-hours-down-to-45-75-minutes)
19. [Reduce Token Burn and Maximize Efficiency](#reduce-token-burn-and-maximize-efficiency)
20. [What Claude Code Can Help With](#what-claude-code-can-help-with)
21. [Monthly Time Commitment](#monthly-time-commitment)
22. [Total Cost Summary](#total-cost-summary)

---

## 1. WHAT IS OPENCLAW?

**Simple explanation:** OpenClaw is a free, open-source AI assistant that runs on your own
server. You talk to it through Telegram, WhatsApp, or Discord, and it can do things for you
-- automate tasks, answer questions, run workflows, manage files, browse the web, and more.

**What "passive returns" means here:** Once set up, OpenClaw works for you 24/7 without you
having to babysit it. Whether that's automating repetitive work, monitoring things, running
scheduled tasks, or anything else -- it's doing stuff while you sleep.

**The names:** It was originally called "Clawdbot", then "Moltbot", now "OpenClaw." Same
project, just renamed twice due to trademark issues.

**The key point:** OpenClaw is a general-purpose AI agent. It does whatever you teach it to
do through "skills" (plugins). You decide what those skills are.

---

## 2. WHAT YOU'LL NEED BEFORE STARTING

| Item | Why You Need It | Cost |
|------|----------------|------|
| A Mac computer | To set everything up from (you already have one) | $0 |
| An email address | For cloud + AI account signups | $0 |
| A credit/debit card | Oracle needs it to verify you're real (you WON'T be charged) | $0 |
| A phone number | For account verification | $0 |
| A Google account | For Gemini AI (your primary free AI brain) | $0 |
| A Groq account | For backup AI + access to Kimi K2 (free) | $0 |
| A Telegram account | To talk to your bot from your phone | $0 |
| About 2-3 hours | For the initial setup | - |

---

## 3. THE COST BREAKDOWN

### The $0/Month Plan (Oracle Cloud)

| Item | Cost |
|------|------|
| Oracle Cloud server (2-4 CPU, 12-24 GB RAM, 200 GB storage) | $0/month forever |
| OpenClaw software | $0 forever |
| Google Gemini AI (primary brain) | $0 forever |
| Groq AI (secondary brain, includes Kimi K2) | $0 forever |
| OpenRouter (18+ free AI models as backup) | $0 forever |
| Telegram | $0 forever |
| **Total** | **$0/month** |

**What you get for $0:** About 1,000+ AI requests per day spread across multiple free
providers. That's more than enough for personal use, automation, and testing things out.

### Optional Paid Upgrades (Only If You Want More Power Later)

| Upgrade | Cost | What You Get |
|---------|------|-------------|
| Anthropic Claude API (Haiku) | ~$10-35/month | Best-in-class AI quality, strongest tool use |
| OpenAI GPT API | ~$10-30/month | GPT-4o level quality |
| OpenRouter credits ($10 one-time) | $10 once | 1,000 requests/day instead of 50 on free models |
| Hostinger KVM2 VPS (instead of Oracle) | ~$4-7/month | No idle reclaim, simpler networking, easier firewall |

**You do NOT need any of these to get started.** The free plan is fully functional. Only
upgrade if you hit limits or want higher quality AI responses.

---

## PHASE 1: CREATE YOUR CLOUD SERVER
### Difficulty: Easy | Time: 30-45 minutes
### Can Claude Code help? Yes -- it can navigate the browser for you (you handle passwords/card info)

**What you're doing:** Getting a computer in the cloud that runs 24/7. This guide covers
**Oracle Cloud Free Tier** (completely free forever) and **Hostinger KVM2 VPS** (paid, but
simpler setup). Choose whichever fits your needs.

**Oracle Cloud:** Free forever, but requires credit card verification, more complex networking,
and has idle reclaim policies (mitigated by upgrading to Pay-As-You-Go, which stays free).

**Hostinger KVM2:** ~$4-7/month, dead simple setup, no idle reclaim, straightforward firewall.
Recommended if you value simplicity over cost.

**This guide defaults to Oracle Cloud.** If you're using Hostinger, skip to Step 1.4-Hostinger
below and adapt the Oracle-specific instructions as needed (mostly networking and firewall
sections in Phase 2).

---

### Step 1.1: Generate Your SSH Key (Your Digital Key)

**What this is:** Think of it like a physical key to a lock. Your server has a lock (public
key), and your Mac has the key (private key). Only your key opens your server. No one can
copy it or guess it. It's WAY safer than a password.

**On your Mac, open Terminal** (press Cmd+Space, type "Terminal", press Enter).

Copy and paste this command exactly, then press Enter:

```bash
ssh-keygen -t ed25519 -C "openclaw-server"
```

It will ask you three things:
1. **"Enter file in which to save the key"** -- just press Enter (uses the default location)
2. **"Enter passphrase"** -- type a password you'll remember, press Enter
   (you won't see the characters as you type -- that's normal, it's hiding them for security)
3. **"Enter same passphrase again"** -- type it again, press Enter

Now display your public key so you can copy it:

```bash
cat ~/.ssh/id_ed25519.pub
```

**Copy the entire line that appears** (starts with `ssh-ed25519`, ends with
`openclaw-server`). Paste it somewhere temporarily (like the Notes app on your Mac).
You'll need this in Step 1.4.

### Step 1.1b: Back Up Your SSH Key NOW (Critical)

**If you lose this key, recovery is difficult.** While Oracle Cloud Console offers serial console access as a last resort (see Disaster Recovery section), it requires additional setup. Back up your key now to avoid this hassle:

```bash
# Plug in a USB drive, then copy BOTH key files to it
cp ~/.ssh/id_ed25519 /Volumes/YOUR_USB_DRIVE/
cp ~/.ssh/id_ed25519.pub /Volumes/YOUR_USB_DRIVE/
```

Replace `YOUR_USB_DRIVE` with the actual name of your USB drive (it shows up in Finder).
Store the USB drive somewhere safe (a drawer, a lockbox, etc.). Do NOT upload these files
to Google Drive, iCloud, or Dropbox -- they contain your private key.

---

### Step 1.2: Sign Up for Oracle Cloud

**READ THIS FIRST -- BEFORE YOU START THE SIGNUP:**

Your "Home Region" choice during signup is **permanent and cannot be changed.** Your free
server can ONLY be created in your Home Region. Pick from the recommended list below BEFORE
you begin:

**Recommended regions** (best availability for free ARM servers):
- US Midwest (Chicago)
- Canada Southeast (Montreal)
- UK South (London)
- Germany Central (Frankfurt)
- Japan East (Tokyo)

**Avoid** US East (Ashburn) and US West (Phoenix) -- they're almost always full.
Pick whichever is geographically closest to you from the recommended list.

**Now begin the signup:**

1. Go to **https://signup.oraclecloud.com/**
2. Fill in your email, name, and verify your email (check inbox for verification link)
3. Set a password (use a strong one -- 12+ characters, mix of upper/lowercase/numbers/symbols)
4. **Enable 2FA/MFA** on your Oracle account immediately after creating it
5. Enter your address and phone number
6. Enter your credit/debit card
   - **You will NOT be charged** -- it's just identity verification
   - Oracle places a temporary ~$1 hold that gets refunded
   - They do NOT accept prepaid cards or virtual cards
7. When asked for "Home Region" -- pick the one you chose above

8. Complete the signup

---

### Step 1.3: Upgrade to Pay-As-You-Go (Still Free -- This Is Important)

**Why you need to do this:** Oracle has a policy where they can shut down free servers that
are "idle" (not doing much). Upgrading to Pay-As-You-Go disables this policy completely.

**You will NOT be charged.** As long as you stay within the free limits (which you will --
OpenClaw barely uses any resources compared to what Oracle gives you), your bill is $0.

1. Log into https://cloud.oracle.com
2. Click the hamburger menu (the three horizontal lines in the top-left corner)
3. Go to **Billing & Cost Management** > **Upgrade and Manage Payment**
4. Click **Upgrade to Paid Account**
5. Confirm your payment method

Done. You're still not paying anything. This just protects your server from being reclaimed.

---

### Step 1.4: Create Your Free ARM Server

1. In the Oracle Cloud Console, click the hamburger menu (three lines, top-left)
2. Go to **Compute** > **Instances**
3. Click the blue **Create Instance** button
4. **Name:** type `openclaw-server`

5. **Image and Shape** -- click **Edit**:
   - **Image:** Click **Change Image** > Select **Ubuntu** > pick the latest version
     (e.g., 24.04) > **IMPORTANT: select the FULL image, NOT the one that says "minimal"**
   - **Shape:** Click **Change Shape** > Select the **Ampere** tab > check the box next to
     **VM.Standard.A1.Flex**
   - **OCPUs:** Set to **2**
   - **Memory (GB):** Set to **12**
   - (This is plenty for OpenClaw and leaves room if you ever want a second server)

6. **Networking:** Leave the defaults alone. Just make sure **"Assign a public IPv4 address"**
   has a checkmark next to it.

7. **Add SSH keys:**
   - Select **Paste public keys**
   - Paste the key you copied back in Step 1.1 (the long line starting with `ssh-ed25519`)

8. Click **Create**

9. Wait for the status to change to **Running** (takes 1-5 minutes)

10. **Write down the Public IP Address** shown on the instance details page. You'll use it
    constantly. It looks something like `129.153.47.201`.

**If you get an "Out of Host Capacity" error:**

This means Oracle temporarily ran out of free servers in your region. This is common.

- Try selecting a different **Availability Domain** (it's a dropdown on the create page)
- Try a smaller size (1 OCPU / 6 GB instead of 2 / 12)
- Try again in a few hours (early morning your time zone tends to work best)
- As a last resort, there's a script that auto-retries for you until one becomes available:
  https://github.com/hitrov/oci-arm-host-capacity

---

### Step 1.5: Connect to Your Server for the First Time

On your Mac, in Terminal:

```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

Replace `YOUR_PUBLIC_IP` with the actual IP address from Step 1.4 (e.g., `ssh ubuntu@129.153.47.201`).

The first time you connect, it will show a message like:
```
The authenticity of host '129.153.47.201' can't be established.
Are you sure you want to continue connecting (yes/no)?
```

Type `yes` and press Enter. This only happens once.

If it asks for a passphrase, enter the one you created in Step 1.1.

**You're now inside your cloud server.** The terminal prompt will change to something like
`ubuntu@openclaw-server:~$`. Everything you type from here runs on that cloud server,
not on your Mac.

To disconnect and go back to your Mac: type `exit` and press Enter.

**Note:** You're using the public IP for now. In Phase 2, we'll set up Tailscale VPN and
switch to a private IP address (100.x.y.z) for all connections. The public IP will no
longer work for SSH after Phase 2 -- this is intentional for security.

---

### Step 1.5b: Make Connecting Easier (SSH Shortcut)

Back on your Mac (disconnect from the server first by typing `exit`), run this to create
a shortcut so you can just type `ssh openclaw` in the future:

**Note:** We use `User ubuntu` and the public IP for now. After Phase 2 (where we set up
Tailscale VPN, create the `deploy` user, and change the SSH port), we'll update this to
use the Tailscale IP, the `deploy` user, and port 2222.

```bash
mkdir -p ~/.ssh
```

Now check if you already have an `openclaw` entry (to avoid duplicates):

```bash
grep -c "Host openclaw" ~/.ssh/config 2>/dev/null && echo "Entry already exists -- edit it instead" || cat >> ~/.ssh/config << 'EOF'

Host openclaw
    HostName YOUR_PUBLIC_IP
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
EOF
```

**Replace `YOUR_PUBLIC_IP` with your actual IP address.** Test it: `ssh openclaw`

This is temporary -- you'll update this entry in Phase 2 after setting up Tailscale.

---

## PHASE 2: LOCK DOWN YOUR SERVER LIKE A VAULT
### Difficulty: Medium | Time: 30-40 minutes
### Can Claude Code help? Yes -- it can generate all these commands for you

**What you're doing:** Right now your server has basic security. This phase turns it into a
fortress. We're adding multiple layers of protection so that even if one layer fails, the
others keep you safe.

**Key change:** We'll set up Tailscale VPN FIRST so your server is only accessible through
your private VPN network. This means SSH won't be exposed to the public internet at all.

---

### Step 2.1: Install and Configure Tailscale VPN

**What Tailscale is:** A zero-config VPN that creates a private network between your devices.
After setup, your server will ONLY accept SSH connections from devices on your Tailscale
network -- not from the public internet. Think of it as a private tunnel that only you
(and devices you authorize) can use.

**Why we do this first:** Once Tailscale is configured, your SSH port disappears from the
public internet. All the other security layers (fail2ban, iptables, etc.) become backup
defenses. An attacker can't even attempt to connect unless they're on your Tailscale network.

Connect to your server with the default ubuntu user:

```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

Install Tailscale:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

**Note:** This is one of the few cases where piping to `sh` is acceptable -- Tailscale is
a well-established security company and this is their official install method. If you prefer
to review first: `curl -fsSL https://tailscale.com/install.sh -o /tmp/tailscale-install.sh`,
then `less /tmp/tailscale-install.sh`, then `sudo sh /tmp/tailscale-install.sh`.

Start Tailscale and authenticate:

```bash
sudo tailscale up --ssh
```

This will output a URL like `https://login.tailscale.com/a/abc123def456`. Copy this URL and
paste it into your web browser. Log in with your Google, Microsoft, or GitHub account (or
create a Tailscale account). Approve the device.

**Get your Tailscale IP address** (you'll need this constantly):

```bash
tailscale ip -4
```

This will show an IP address like `100.x.y.z`. **Write this down.** This is your server's
private Tailscale IP. From now on, you'll use THIS IP to connect, not the public IP.

**Test the Tailscale connection** (open a NEW terminal tab on your Mac, don't close your
current session yet):

```bash
ssh ubuntu@100.x.y.z
```

Replace `100.x.y.z` with your actual Tailscale IP. If this works, you're connected via the
VPN. If it doesn't work, see Step 2.1b below to install Tailscale on your Mac first.

---

### Step 2.1b: Install Tailscale on Your Local Machine (Mac)

**Why:** Your Mac needs to be part of the Tailscale network to connect to the server.

**On your Mac** (not the server):

1. Go to **https://tailscale.com/download** and download Tailscale for macOS
2. Install and open Tailscale
3. Sign in with the SAME account you used when setting up the server
4. Tailscale will show your devices -- you should see your server listed

Now your Mac and server are on the same private network. Test the connection:

```bash
ssh ubuntu@100.x.y.z
```

If this works, proceed. If not, check that both devices show as "Connected" in the Tailscale
admin console at https://login.tailscale.com/admin/machines.

---

### Step 2.1b-2: Add Additional Devices to Your Tailscale Network (Optional)

**Why you might want this:** Once Tailscale is configured, SSH only works from devices on
your Tailscale network. If you want to SSH in from multiple computers (work laptop, iPad,
phone), add them to Tailscale now.

**To add another device:**

1. Install Tailscale on that device:
   - **Mac/Windows/Linux:** https://tailscale.com/download
   - **iOS/Android:** Install the Tailscale app from App Store/Play Store
   - **iPad/tablet:** Same as phone -- install the mobile app

2. Sign in with the SAME Tailscale account

3. The device appears in your admin console at https://login.tailscale.com/admin/machines

4. From that device, you can now SSH to your server using the Tailscale IP:
   ```bash
   ssh deploy@100.x.y.z
   ```

**Security note:** Anyone with access to your Tailscale account can add devices to your
network. Enable 2FA on your Tailscale account: https://login.tailscale.com/admin/settings/user

**To remove a device:** Go to https://login.tailscale.com/admin/machines, click the device,
and click "Delete". The device immediately loses access to your server.

---

### Step 2.1c: Configure SSH to ONLY Listen on Tailscale IP

**CRITICAL WARNING:** This step will make your server ONLY accessible via Tailscale. If
Tailscale disconnects or breaks, you won't be able to SSH in via the public IP anymore.
This is INTENTIONAL for security, but it means:
- Keep your current SSH session open until you've tested everything
- Make sure Tailscale is working on your Mac before proceeding
- Have the Oracle Cloud serial console instructions from Disaster Recovery handy as a backup

**On your server** (connected via your existing SSH session):

First, back up the SSH config:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
```

Get your Tailscale IP again:

```bash
TAILSCALE_IP=$(tailscale ip -4)
echo "Your Tailscale IP is: $TAILSCALE_IP"
```

Add a `ListenAddress` directive to SSH config to ONLY listen on the Tailscale IP:

```bash
echo "ListenAddress $TAILSCALE_IP" | sudo tee -a /etc/ssh/sshd_config
```

Validate the SSH config:

```bash
sudo sshd -t
```

If it says nothing (no output), the config is valid. If it shows an error, restore the backup:
`sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config`

**Only if validation passed**, restart SSH:

```bash
sudo systemctl restart sshd
```

**NOW TEST IMMEDIATELY** -- do NOT close your existing session. Open a NEW terminal tab and try:

```bash
ssh ubuntu@100.x.y.z
```

If this works, great. Now try connecting via the public IP (this should FAIL):

```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

This should time out or refuse connection. **This is correct behavior** -- SSH is now only
accessible via Tailscale.

If the Tailscale connection doesn't work, use your still-open session to restore:

```bash
sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
sudo systemctl restart sshd
```

**What you've accomplished:** Your server's SSH port is now completely invisible to the
public internet. Only devices on your Tailscale network can even attempt to connect.

---

### Step 2.2: Update Everything

**Now that Tailscale is working**, connect via your Tailscale IP:

```bash
ssh ubuntu@100.x.y.z
```

Then run:

```bash
sudo apt update && sudo apt upgrade -y
```

**What this does:** Downloads and installs all the latest security patches. Like updating
your phone's software, but for the server.

Takes 2-5 minutes. Wait for it to finish.

---

### Step 2.3: Create Two Dedicated Users

> **OPTIONAL FOR PERSONAL USE -- SIMPLER ALTERNATIVE:** For a personal bot, you can skip
> creating two users. Just create a single `deploy` user with sudo access
> (`sudo usermod -aG sudo deploy`) and use it for everything. The two-user model adds
> operational friction (switching users for every admin task) that isn't worth it for a
> single-person server. The rest of this guide references both `admin` and `deploy` users --
> if you use the simpler single-user approach, just use `deploy` everywhere you see `admin`.

**Why:** We create two separate users with different levels of access:
- `admin` -- for system administration (has sudo). You use this when you need to install
  software, change system settings, or update the server.
- `deploy` -- for running OpenClaw (NO sudo). This is a locked-down user. If OpenClaw or
  a malicious skill is compromised, the attacker gets zero system access.

Run each of these commands one at a time:

**Create the admin user:**

```bash
sudo useradd -m -s /bin/bash admin
sudo passwd admin
```
(Type a strong password twice. You won't see the characters -- that's normal.)

```bash
sudo usermod -aG sudo admin
sudo mkdir -p /home/admin/.ssh
sudo cp /home/ubuntu/.ssh/authorized_keys /home/admin/.ssh/
sudo chown -R admin:admin /home/admin/.ssh
sudo chmod 700 /home/admin/.ssh
sudo chmod 600 /home/admin/.ssh/authorized_keys
```

**Create the deploy user (no sudo):**

```bash
sudo useradd -m -s /bin/bash deploy
sudo passwd deploy
```
(Another strong password. Different from the admin password.)

```bash
sudo mkdir -p /home/deploy/.ssh
sudo cp /home/ubuntu/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

**Now test BOTH users.** Open TWO new Terminal tabs on your Mac (Cmd+T) and try:

```bash
# Tab 1 (using Tailscale IP):
ssh admin@100.x.y.z

# Tab 2 (using Tailscale IP):
ssh deploy@100.x.y.z
```

If both work, you're good. **From now on:**
- Use `admin` for system tasks (installing software, updates, security changes)
- Use `deploy` for everything OpenClaw-related (running the bot, editing configs)
- Always connect via Tailscale IP (100.x.y.z), not the public IP

---

### Step 2.4: Harden SSH -- Disable Passwords, Change Port, Add Timeout

**Why:** After this, the ONLY way to get into your server is with your SSH key file on your
Mac. No one can try to guess a password because passwords are completely turned off. We also
change the SSH port from the default 22 to reduce automated scan noise by 95%+.

**STOP -- BEFORE YOU DO ANYTHING:**

1. Make sure `ssh admin@100.x.y.z` works (test it now in a new Terminal tab)
2. Make sure `ssh deploy@100.x.y.z` works (test it in another tab)
3. **Keep BOTH sessions open** throughout this entire step. Do NOT close them until
   you've verified everything works with the new settings.

**If both logins work, proceed.** Connect as `admin` via Tailscale (you need sudo for this):

First, back up the SSH config so you can recover if something goes wrong:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
```

Now apply the hardening changes:

```bash
sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*Port .*/Port 2222/' /etc/ssh/sshd_config
```

If the `Port` line doesn't exist or is not being changed, add it manually:

```bash
grep -q "^Port " /etc/ssh/sshd_config || echo "Port 2222" | sudo tee -a /etc/ssh/sshd_config
```

Add session timeout (disconnects idle SSH sessions after 10 minutes):

```bash
echo -e "\nClientAliveInterval 300\nClientAliveCountMax 2" | sudo tee -a /etc/ssh/sshd_config
```

**IMPORTANT:** We do NOT set `UsePAM no`. PAM must stay enabled because it handles
`systemd --user` session setup, which OpenClaw needs to run as a background service.

Now **validate the config before restarting** (this catches syntax errors):

```bash
sudo sshd -t
```

If it says nothing (no output), the config is valid. If it shows an error, fix the issue
or restore the backup: `sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config`

Only if validation passed, restart SSH:

```bash
sudo systemctl restart sshd
```

**NOW TEST -- do NOT close your existing sessions yet.** Open a NEW Terminal tab and try:

```bash
ssh -p 2222 admin@100.x.y.z
```

If it works, great. If not, use your still-open session to restore the backup:
```bash
sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
sudo systemctl restart sshd
```

**Note on Oracle Cloud firewall:** Since SSH now only listens on your Tailscale IP (which
is private), you technically don't need to allow port 2222 through Oracle's cloud firewall
for SSH to work. However, keeping the firewall rule is harmless and acts as a fallback if
you ever need to disable the `ListenAddress` restriction. For maximum security, you can
remove ALL ingress rules from Oracle's firewall (see Step 2.5b).

### Step 2.4b: Update Your SSH Shortcut on Your Mac

On your Mac, edit your SSH config to use the Tailscale IP, new port, and correct users:

```bash
nano ~/.ssh/config
```

**Delete the old `Host openclaw` block** (select from "Host openclaw" down to the blank
line and delete it), then replace it with this (and add an admin entry):

```
Host openclaw
    HostName 100.x.y.z
    User deploy
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host openclaw-admin
    HostName 100.x.y.z
    User admin
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

**Replace `100.x.y.z` with your actual Tailscale IP from Step 2.1.**

Now you can connect with `ssh openclaw` (as deploy) or `ssh openclaw-admin` (for admin tasks).
All connections go through your private Tailscale VPN.

---

### Step 2.5: Install fail2ban (Automatic Intruder Blocker)

**What this is:** A security guard that watches your server 24/7. If someone tries to break
in and fails 3 times, fail2ban automatically blocks them for 24 hours. Completely automatic.

**Note:** With Tailscale configured, SSH is only accessible on your private VPN, so
fail2ban becomes a backup defense layer. It's still worth having in case you ever need to
temporarily disable Tailscale or if there's a vulnerability in Tailscale itself.

```bash
sudo apt install -y fail2ban
```

```bash
cat > /tmp/jail.local << 'EOF'
[DEFAULT]
bantime = 86400
findtime = 600
maxretry = 3
# IMPORTANT: Add your home IP so you don't accidentally ban yourself
# Replace YOUR_HOME_IP with your actual IP (find it at https://whatismyip.com)
ignoreip = 127.0.0.1/8 ::1 YOUR_HOME_IP

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF
```

**Replace `YOUR_HOME_IP`** with your actual home IP address. If your home IP changes often,
you can remove it from `ignoreip` -- just be careful not to fail login 3 times in a row.

```bash
sudo mv /tmp/jail.local /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

Verify it's running:

```bash
sudo fail2ban-client status sshd
```

---

### Step 2.6: Configure the Firewall (Properly)

**IMPORTANT:** On Oracle Cloud Ubuntu, do NOT use `ufw`. It conflicts with Oracle's
networking and can lock you out of your server permanently. Use `iptables` instead.

**Note on Tailscale + Firewalls:** Tailscale traffic uses UDP port 41641 by default and
encrypted WireGuard tunnels. The iptables rules below allow established connections (which
includes your Tailscale tunnel), so everything will work correctly.

First, install `iptables-persistent` so your rules survive reboots:

```bash
sudo apt install -y iptables-persistent
```

(Select **Yes** when asked to save current rules.)

Now set up a complete firewall ruleset. This blocks ALL incoming traffic except SSH on
your custom port:

```bash
# Flush any existing rules
sudo iptables -F INPUT

# Allow loopback (localhost talking to itself -- required for OpenClaw)
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow already-established connections (so your current SSH doesn't break)
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH on your custom port (2222)
sudo iptables -A INPUT -p tcp --dport 2222 -j ACCEPT

# NOW set default policy to DROP (done last so your SSH session isn't interrupted)
sudo iptables -P INPUT DROP

# Save the rules so they persist across reboots
sudo sh -c 'iptables-save > /etc/iptables/rules.v4'
```

**Also lock down IPv6** (often forgotten -- attackers can bypass IPv4 firewalls via IPv6):

```bash
sudo ip6tables -F INPUT
sudo ip6tables -A INPUT -i lo -j ACCEPT
sudo ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo ip6tables -A INPUT -p tcp --dport 2222 -j ACCEPT
sudo ip6tables -P INPUT DROP
sudo sh -c 'ip6tables-save > /etc/iptables/rules.v6'
```

---

### Step 2.6b: Lock Down the Oracle Cloud Firewall (Optional but Recommended)

**Important context:** This step applies to both Oracle Cloud and Hostinger KVM2 VPS setups.
Both providers offer cloud-level firewalls that sit in front of your server's iptables rules.

**For Oracle Cloud users:**

Since SSH now only listens on your Tailscale IP (which is completely private), you can
**delete ALL ingress rules** from Oracle's cloud firewall for maximum security:

1. Go to Oracle Cloud Console in your browser
2. Navigate to **Networking** > **Virtual Cloud Networks**
3. Click your VCN > **Security Lists** > **Default Security List**
4. **Delete ALL ingress rules** (including port 22 and port 2222)
   - Your Tailscale connection doesn't use these rules -- it uses encrypted WireGuard tunnels
   - Deleting all ingress rules means your server is completely invisible to port scans

**Alternative (if you want to keep a fallback):** Keep ONLY the port 2222 rule with a
restricted source IP (your home IP: `YOUR_HOME_IP/32`). This acts as a safety net if you
ever need to disable Tailscale.

**For Hostinger KVM2 users:**

Hostinger provides a firewall dashboard in your VPS control panel:

1. Log into **Hostinger** > **VPS** > select your server
2. Go to **Firewall** section in the sidebar
3. **Delete all default SSH rules** (port 22, port 2222 if present)
4. Add a rule allowing **UDP port 41641** (Tailscale WireGuard) if you want extra safety
   - This is optional -- Tailscale works even without explicit firewall rules for 41641
5. Set the default policy to **DENY ALL** inbound traffic

**For both providers:** The server-level iptables rules (from Step 2.6) are still active
and provide defense-in-depth. The cloud firewall is your outermost layer.

---

### Step 2.7: Set Up Automatic Security Updates

**Why:** Your server will automatically install security patches without you lifting a finger.

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Select **Yes** when prompted.

Verify it's working:

```bash
sudo unattended-upgrades --dry-run --debug
```

---

### Step 2.8: Set Up Swap Space (Memory Safety Net)

**What this is:** If OpenClaw temporarily needs more memory than available, swap uses disk
space as emergency overflow instead of crashing.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Tune swap behavior so Linux only uses swap as a last resort (better performance):

```bash
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Step 2.9: Set Up Intrusion Detection (File Integrity Monitoring)

> **OPTIONAL -- This is enterprise-grade security. For a personal bot, you can safely skip
> this step. Only set this up if you're running a production service or handling sensitive
> data.**

**What this is:** AIDE watches your system files and alerts you if anything changes
unexpectedly. If a malicious skill modifies system files, you'll know about it.

```bash
sudo apt install -y aide
sudo aideinit
sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db
```

Schedule a daily check (runs at 4 AM):

```bash
(sudo crontab -l 2>/dev/null; echo "0 4 * * * /usr/bin/aide --check") | sudo crontab -
```

### Step 2.10: Enable Audit Logging

> **OPTIONAL -- Forensic audit trails are for compliance teams, not personal bots. You can
> safely skip this step unless you're running a business service or need to meet regulatory
> requirements.**

**What this is:** Keeps a forensic record of everything that happens on the server. If
something goes wrong, you can trace exactly what happened and when.

```bash
sudo apt install -y auditd
sudo systemctl enable auditd
```

Log all commands run by the deploy user and all access to your API keys file:

```bash
sudo auditctl -a always,exit -F arch=b64 -S execve -F uid=$(id -u deploy) -k deploy_commands
sudo auditctl -w /home/deploy/.openclaw/ -p rwa -k openclaw_config_access
```

Make the rules permanent (automatically uses the correct UID for the deploy user):

```bash
DEPLOY_UID=$(id -u deploy)
echo "-a always,exit -F arch=b64 -S execve -F uid=$DEPLOY_UID -k deploy_commands" | sudo tee -a /etc/audit/rules.d/openclaw.rules
echo '-w /home/deploy/.openclaw/ -p rwa -k openclaw_config_access' | sudo tee -a /etc/audit/rules.d/openclaw.rules
sudo systemctl restart auditd
```

**Note:** The `.openclaw/` directory doesn't exist yet (it's created in Phase 3). The file
watch rule will start working after Phase 3 completes. This is fine -- the audit system
handles missing paths gracefully.

### Step 2.11: Configure Log Rotation

> **OPTIONAL -- The default journal settings on Ubuntu are usually fine for a 200GB disk.
> Only configure this if you're worried about disk space or running multiple services.**

**Why:** Prevents logs from filling up your disk over time.

```bash
sudo journalctl --vacuum-size=500M
echo "SystemMaxUse=500M" | sudo tee -a /etc/systemd/journald.conf
sudo systemctl restart systemd-journald
```

---

## PHASE 3: INSTALL OPENCLAW
### Difficulty: Easy | Time: 15-20 minutes
### Can Claude Code help? Yes -- it can generate all installation commands

> **Note:** If you used the single-user setup from Phase 2.2, ignore instructions to switch
> between `admin` and `deploy` users -- just use your `deploy` user (which has sudo) for
> everything.

---

### Step 3.1: Install Node.js

**What this is:** Node.js is the engine that runs OpenClaw. Think of it like how a car needs
an engine -- OpenClaw needs Node.js. It requires version 22 or newer.

Connect as `admin` (you need sudo for system-wide installs):

```bash
ssh openclaw-admin
```

**Install Node.js** (we download the setup script first and review it, rather than piping
directly to bash -- this is safer):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-setup.sh
less /tmp/nodesource-setup.sh
```

Review the script -- it should be adding the NodeSource APT repository. If it looks
reasonable, run it:

```bash
sudo -E bash /tmp/nodesource-setup.sh
sudo apt install -y nodejs
rm /tmp/nodesource-setup.sh
```

Install build tools (needed for some things on ARM servers):

```bash
sudo apt install -y build-essential git curl wget
```

Install pnpm (a faster way to install software packages):

```bash
sudo corepack enable
sudo corepack prepare pnpm@9.15.0 --activate
```

Verify everything installed correctly:

```bash
node --version
pnpm --version
```

You should see version numbers (e.g., `v22.x.x` and `9.15.0`). If you see "command not
found," something went wrong -- re-run the install steps.

---

### Step 3.2: Install OpenClaw

The recommended way (manual install -- you know exactly what's running):

```bash
sudo npm install -g openclaw@latest
```

Then run the setup wizard:

```bash
openclaw onboard --install-daemon
```

This will:
- Create the config folder at `~/.openclaw/`
- Set up a background service so OpenClaw starts automatically
- Walk you through initial setup questions

> **Important:** Run `openclaw onboard` as the `deploy` user (not `admin`), so the config
> and service are created under `/home/deploy/.openclaw/`. If you used the two-user setup,
> switch to `deploy` first: `su - deploy`

**Alternative (quicker but less secure):** If you want the one-liner install, download it
first and review before running:

```bash
curl -fsSL https://openclaw.ai/install.sh -o /tmp/install-openclaw.sh
less /tmp/install-openclaw.sh
bash /tmp/install-openclaw.sh
rm /tmp/install-openclaw.sh
```

**Never pipe a remote script directly to bash** (`curl | bash`). Always download, review,
then execute. This applies to any install script from any source.

---

### Step 3.3: Lock Down File Permissions

**Why:** The OpenClaw config folder will contain your API keys. This makes sure only YOUR
user account can read those files -- no other user or process on the server.

Now switch to the `deploy` user (OpenClaw should run as deploy, not admin):

```bash
# Disconnect from admin
exit

# Connect as deploy
ssh openclaw
```

```bash
chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/*.json ~/.openclaw/.env 2>/dev/null
```

(We target specific file types instead of blindly setting 600 on everything, in case
OpenClaw stores any executable scripts in the config folder.)

---

## PHASE 4: SET UP YOUR FREE AI PROVIDERS
### Difficulty: Easy | Time: 15-20 minutes
### Can Claude Code help? Yes -- it can navigate signups and grab API keys (you handle passwords/CAPTCHAs)

**What you're doing:** OpenClaw needs an AI "brain" to think. Instead of paying for one, we
stack multiple free AI providers. When one hits its daily limit, OpenClaw automatically
falls back to the next one. Total cost: $0.

**The strategy:** Use Gemini for everyday reliable tasks, Kimi K2.5 (via OpenRouter) for
complex multi-step/agentic work, Groq for fast responses, and OpenRouter's other free
models as backup.

---

### Step 4.1: Get Your Google Gemini API Key (Primary -- Best Free Option)

**What you get for free:** ~250 requests/day with Gemini 2.5 Flash. This model has a
1-million-token context window (the biggest free offering anywhere) and strong tool-calling
ability. This will handle most of your daily usage.

1. Go to **https://ai.google.dev/**
2. Click **Get API Key** (or go directly to https://aistudio.google.com/apikey)
3. Sign in with your Google account
4. Click **Create API Key**
5. Select a Google Cloud project (or let it create one for you)
6. **Copy the API key** and save it somewhere safe temporarily

**Free tier limits:**
- ~10 requests per minute, ~250 requests per day
- 250,000 tokens per minute
- Resets at midnight Pacific Time

---

### Step 4.2: Get Your Groq API Key (Secondary -- Fast + Includes Kimi K2)

**What you get for free:** Access to many models including Kimi K2, Llama 4, and more.
About 1,000 requests/day total across models. Groq is also insanely fast -- responses come
back almost instantly.

1. Go to **https://console.groq.com/**
2. Sign up (no credit card needed)
3. Go to **API Keys** in the left sidebar
4. Click **Create API Key**
5. Name it something like "openclaw"
6. **Copy the API key** and save it

**Free tier limits (per model per day):**
- Kimi K2: 1,000 requests/day, 300,000 tokens/day
- Llama 4 Scout: 1,000 requests/day, 500,000 tokens/day
- Llama 3.3 70B: 1,000 requests/day, 100,000 tokens/day
- Many more models available

---

### Step 4.3: Get Your OpenRouter API Key (Kimi K2.5 + 18+ Free Models)

**What you get for free:** Access to 18+ free AI models from different companies, all
through one API key. Most importantly, this is how you access **Kimi K2.5** -- the newest
frontier-class model that rivals Claude and GPT on benchmarks.

**Why Kimi K2.5 matters:**
- Released January 27, 2026 by Moonshot AI
- Beats Claude on LiveCodeBench (85% vs 64%) and wins 9 of 17 multimodal benchmarks
- Elite tool calling -- handles 100+ sequential tool calls, up to 1,500 in parallel
- 256K context window
- "Agent Swarm" feature can spawn up to 100 sub-agents for complex tasks
- 8x cheaper output tokens than Claude ($2.50/M vs $25/M)
- Has an official OpenClaw integration guide from Moonshot
- **Available on OpenRouter** as model `moonshotai/kimi-k2.5`

**Heads up:** K2.5 has a higher hallucination rate (64%) than Claude or GPT. That's why we
use Gemini as the daily driver (more reliable) and route complex agentic tasks to K2.5.

1. Go to **https://openrouter.ai/**
2. Sign up (no credit card needed for free models)
3. Go to **Keys** in your dashboard
4. Click **Create Key**
5. **Copy the API key** and save it

**Free tier limits:**
- 50 requests/day without spending anything
- If you ever add $10 of credits (optional), this jumps to 1,000 requests/day permanently

**Free models include:** Kimi K2.5, Gemini 2.0 Flash, Llama 3.1 405B, Kimi K2, DeepSeek R1,
GPT-OSS 120B, Devstral 2, and more.

---

### Step 4.4: (Optional) Get Z.AI API Key (Free, Great for Coding Tasks)

**What you get for free:** Unlimited requests to GLM-4.7-Flash (one at a time). 200K token
context window. Scores as well as Claude 3.5 Sonnet on tool-calling benchmarks.

1. Go to **https://open.bigmodel.cn/** (Z.AI platform)
2. Sign up
3. Get your API key from the dashboard
4. **Copy the API key** and save it

**Free tier limits:**
- 1 concurrent request (they queue up if you send multiple at once)
- No daily token limit specified

---

### Step 4.5: Create Your Environment File with All Keys

Now SSH into your server and add all your keys:

```bash
ssh -p 2222 deploy@YOUR_PUBLIC_IP
```

(Or simply `ssh openclaw` if you set up the shortcut in Step 2.3c.)

```bash
nano ~/.openclaw/.env
```

Paste this (replace each placeholder with your actual keys):

```bash
# ===== FREE AI PROVIDERS (all you need for $0/month) =====

# Primary: Google Gemini (most reliable free option, ~250 requests/day)
GEMINI_API_KEY=your-gemini-key-here

# Secondary: Groq (blazing fast, includes Kimi K2, ~1000 requests/day)
GROQ_API_KEY=your-groq-key-here

# Heavy lifting + Backup: OpenRouter (Kimi K2.5 + 18+ free models)
# Kimi K2.5 = best agentic model available, rivals Claude/GPT on benchmarks
OPENROUTER_API_KEY=your-openrouter-key-here

# Optional: Z.AI GLM (free unlimited, 1 at a time, good for coding)
# ZAI_API_KEY=your-zai-key-here

# ===== OPTIONAL PAID PROVIDERS (add later if you want) =====
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# OPENAI_API_KEY=sk-your-key-here
```

Save: press Ctrl+X, then Y, then Enter.

Lock it down:

```bash
chmod 600 ~/.openclaw/.env
```

---

## PHASE 5: CONFIGURE OPENCLAW SECURELY
### Difficulty: Medium | Time: 15-20 minutes
### Can Claude Code help? Yes -- it can write and edit config files for you

---

### Step 5.1: Generate a Random Security Token and Add It to .env

Run this command and **copy the output**:

```bash
openssl rand -hex 32
```

It will output a long random string like `a3f8b2c1d4e5f6...`. Now add it to your `.env`
file so the token is stored alongside your other secrets (not hardcoded in the config):

```bash
nano ~/.openclaw/.env
```

Add this line at the bottom (replace with your actual generated token):

```
GATEWAY_AUTH_TOKEN=paste-your-generated-token-here
```

Save: Ctrl+X, Y, Enter.

---

### Step 5.2: Create Your Hardened Configuration

```bash
nano ~/.openclaw/openclaw.json
```

Paste this entire block. All secrets are referenced via `${VARIABLE}` from your `.env` file
-- no keys or tokens are hardcoded here:

```json5
{
  // === GATEWAY (the core server process) ===
  gateway: {
    // "local" = only listens on this machine, invisible to the internet
    mode: "local",
    bind: "loopback",
    port: 18789,

    // Require a secret token to connect (extra security layer)
    auth: {
      mode: "token",
      token: "${GATEWAY_AUTH_TOKEN}"
    }
  },

  // === AI MODEL SETTINGS ===
  models: {
    // Use Gemini as the daily driver (most reliable, lowest hallucination)
    default: "gemini-2.5-flash",

    // Configure fallback chain: Gemini -> Kimi K2.5 -> Groq -> OpenRouter free
    providers: {
      gemini: {
        apiKey: "${GEMINI_API_KEY}"
      },
      groq: {
        apiKey: "${GROQ_API_KEY}"
      },
      openrouter: {
        apiKey: "${OPENROUTER_API_KEY}"
        // Kimi K2.5 available as "moonshotai/kimi-k2.5"
        // Best for complex agentic tasks, tool calling, multi-step workflows
        // Use "openrouter/free" for auto-routing to any available free model
      }
    }
  },

  // === AGENT SETTINGS ===
  agents: {
    defaults: {
      // Sandbox all agents for security (they can't access your files)
      sandbox: {
        mode: "all",
        workspaceAccess: "none"
      }
    }
  },

  // === SKILLS (plugins) -- locked down by default ===
  skills: {
    // Only allow officially bundled skills + ones you explicitly enable
    allowBundled: true
  }
}
```

Save: Ctrl+X, Y, Enter.

> **Note:** The config above uses JSON5 syntax (comments with `//`, unquoted keys). If you
> see JSON parse errors when starting OpenClaw, it may not support JSON5. In that case,
> remove all `//` comment lines and wrap all keys in double quotes (e.g., `"gateway": {`
> instead of `gateway: {`).

---

### Step 5.3: Validate Your Configuration

> **Note:** The exact CLI commands below depend on your OpenClaw version. If a command doesn't exist, check `openclaw --help` or the OpenClaw documentation for the equivalent validation command.

Before locking things down, make sure your config file is valid:

```bash
openclaw config validate
```

If you see errors about JSON syntax (OpenClaw may or may not support JSON5 comments), remove
the `//` comment lines from `openclaw.json` and try again.

Also do a quick test to make sure OpenClaw can start:

```bash
openclaw gateway --dry-run
```

If it starts without errors, you're good. If it shows API key errors, double-check that
your `.env` file has the correct keys and that OpenClaw supports `${VARIABLE}` expansion.

### Step 5.4: Lock Down Config Files

```bash
chmod 600 ~/.openclaw/openclaw.json
chmod 600 ~/.openclaw/.env
```

---

## PHASE 6: SET UP MESSAGING (TELEGRAM)
### Difficulty: Easy | Time: 10 minutes
### Can Claude Code help? Yes -- it can update your config files

**Why Telegram?** It's free, works on your phone and desktop, and has the easiest bot
setup process. You can add other platforms (WhatsApp, Discord, Slack, etc.) later.

---

### Step 6.1: Create a Telegram Bot

1. Open Telegram on your phone
2. Search for **@BotFather** and open a chat with it
3. Send the message: `/newbot`
4. It asks for a display name -- type something like `My OpenClaw Bot`
5. It asks for a username -- type something like `MyOpenClawBot` (must end in "bot")
6. **BotFather gives you a token** that looks like `123456789:ABCdefGHI-jklMNO_pqrSTUvwx`
7. Copy this token

---

### Step 6.2: Add the Telegram Token to Your Environment

```bash
nano ~/.openclaw/.env
```

Add this line at the bottom (replace with your actual token):

```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI-jklMNO_pqrSTUvwx
```

Save: Ctrl+X, Y, Enter.

---

### Step 6.3: Add Telegram to Your Config

```bash
nano ~/.openclaw/openclaw.json
```

Add this `channels` section inside the main `{ }` braces, after the `skills` section:

```json5
  // === MESSAGING CHANNELS ===
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",

      // "pairing" = strangers must prove they're authorized before chatting
      dmPolicy: "pairing",

      groups: {
        "*": {
          // In group chats, bot only responds when you @mention it
          requireMention: true
        }
      }
    }
  }
```

Save: Ctrl+X, Y, Enter.

---

### Step 6.4: Restart OpenClaw and Pair Your Account

```bash
systemctl --user restart openclaw-gateway
```

Now open Telegram and send any message to your bot. It will reply with a pairing code.

On your server, approve yourself:

```bash
openclaw pairing approve telegram YOUR_CODE
```

You can now talk to your OpenClaw bot through Telegram.

---

## PHASE 7: INSTALL SKILLS (SAFELY)
### Difficulty: Medium | Time: 15-30 minutes
### Can Claude Code help? Yes -- it can review skill source code for security issues

**What are skills?** Skills are plugins that give OpenClaw new abilities. Without skills,
it's a chatbot. With skills, it can do real things -- web scraping, file management,
automation, API integrations, whatever the skill is built for.

---

### CRITICAL SECURITY WARNING ABOUT SKILLS

In February 2026, security researchers found **341 malicious skills** on ClawHub (the
OpenClaw skill marketplace) designed to steal API keys, passwords, and credentials. They
looked like legitimate tools but contained hidden malware.

**Rules for installing skills -- follow these every time:**

1. **ONLY install from these verified sources:**
   - Official OpenClaw bundled skills
   - The curated list: https://github.com/VoltAgent/awesome-openclaw-skills
   - Skills where you (or someone you trust) have personally read the source code

2. **NEVER install skills that:**
   - You found from a random link on Twitter/X, Discord, or Reddit
   - Have very few GitHub stars but make big promises
   - Ask you to disable security features
   - Ask you to paste private keys or passwords directly into the skill config

3. **Before AND after installing any skill:**
   > **Note:** Verify this command exists in your OpenClaw version with `openclaw --help`. The exact command name may differ.
   ```bash
   openclaw security audit --deep
   ```

---

### Step 7.1: See What's Available (Bundled Skills)

```bash
openclaw skills list
```

Bundled skills are maintained by the OpenClaw team and are safe to use.

---

### Step 7.2: Explore Curated Community Skills

Visit https://github.com/VoltAgent/awesome-openclaw-skills in your browser. This is a
community-maintained list of reviewed and vetted skills organized by category.

To install a skill, add it to the `skills.entries` section of your `openclaw.json`:

```json5
  skills: {
    allowBundled: true,
    entries: {
      "skill-name-here": {
        enabled: true,
        // Add any required environment variables
        env: {
          SOME_API_KEY: "${SOME_API_KEY}"
        }
      }
    }
  }
```

---

### Step 7.3: Run a Security Audit After Any Change

```bash
openclaw security audit --deep
```

Read the output carefully. Fix any warnings before continuing.

---

## PHASE 8: KEEP IT RUNNING 24/7
### Difficulty: Easy | Time: 5-10 minutes
### Can Claude Code help? Yes

---

### Step 8.1: Verify the Background Service Is Running

```bash
systemctl --user status openclaw-gateway
```

You should see `active (running)` in green. If not:

```bash
systemctl --user enable openclaw-gateway
systemctl --user start openclaw-gateway
```

---

### Step 8.2: Enable Lingering (Keep Running After You Disconnect)

**Why:** By default, when you disconnect from SSH, your user's services stop. This command
tells the server to keep your services running even when you're not connected.

This requires sudo, so connect as `admin`:

```bash
ssh openclaw-admin
```

```bash
sudo loginctl enable-linger deploy
```

> **If you used the single-user setup (from Phase 2.2):** You already have sudo access as
> `deploy`. Simply run:
> ```bash
> sudo loginctl enable-linger deploy
> ```
> No need to switch users.

---

### Step 8.3: Set Up a Keep-Alive Script (Safety Net)

**Why:** Even though upgrading to Pay-As-You-Go prevents idle reclaim, this is extra
insurance. It generates a tiny bit of CPU activity every 6 hours so Oracle never thinks
your server is idle.

Connect as `deploy`:

```bash
ssh openclaw
```

```bash
cat << 'SCRIPT' > ~/keepalive.sh
#!/bin/bash
# Generates CPU, memory, and network activity to prevent Oracle idle reclaim
# Runs every 6 hours via cron

# CPU activity: compute hashes
dd if=/dev/urandom bs=1M count=50 2>/dev/null | sha256sum > /dev/null

# Memory activity: allocate and release 256MB
python3 -c "x = bytearray(256*1024*1024); del x" 2>/dev/null || true

# Network activity: lightweight DNS lookups and HTTP check
dig google.com +short > /dev/null 2>&1 || true
curl -sf --max-time 10 -o /dev/null https://cloud.oracle.com 2>/dev/null || true

# Log the activity with timestamp
logger -t keepalive "CPU/memory/network activity generated at $(date)"
SCRIPT

chmod +x ~/keepalive.sh
```

Schedule it to run automatically:

```bash
crontab -e
```

If it asks you to choose an editor, pick option 1 (`nano`).

Add these lines at the very bottom:

```
# Keep-alive: prevent Oracle idle reclaim
0 */6 * * * /home/deploy/keepalive.sh

# Auto-restart: if OpenClaw crashes, restart it within 5 minutes
*/5 * * * * systemctl --user is-active openclaw-gateway > /dev/null 2>&1 || systemctl --user start openclaw-gateway
```

Save: Ctrl+X, Y, Enter.

**Verify the keep-alive is working:**

```bash
# Test it manually first
~/keepalive.sh

# Check that it logged successfully
journalctl -t keepalive --since "5 minutes ago" 2>/dev/null || \
  sudo journalctl -t keepalive --since "5 minutes ago"
```

After a day, verify cron ran it:

```bash
journalctl -t keepalive --since "24 hours ago" | tail -5
```

You should see 4 entries (one every 6 hours). If you see none, check that cron is running: `systemctl status cron`

---

### Step 8.4: View Logs (See What OpenClaw Is Doing)

```bash
journalctl --user -u openclaw-gateway -f
```

This shows a live feed of OpenClaw's activity. Press Ctrl+C to stop watching.

---

## PHASE 9: MONITOR AND MAINTAIN
### Difficulty: Easy | Time: 5-10 minutes/week
### Can Claude Code help? Yes

---

### Step 9.1: Weekly Health Check (Takes 2 Minutes)

SSH into your server. As `deploy`:

```bash
ssh openclaw
openclaw security audit
systemctl --user status openclaw-gateway
df -h
free -h
```

Then as `admin` (for system updates):

```bash
ssh openclaw-admin
sudo apt update && sudo apt upgrade -y
sudo aide --check
```

This checks: security issues, bot status, disk space, memory, system updates, and
file integrity (AIDE detects if any system files were modified unexpectedly).

---

### Step 9.2: Monitor Free Tier Usage

Since you're using free providers, check these dashboards occasionally to make sure you're
not hitting limits:

| Provider | Dashboard URL |
|----------|--------------|
| Google Gemini | https://aistudio.google.com/ (Usage tab) |
| Groq | https://console.groq.com/ (Usage section) |
| OpenRouter | https://openrouter.ai/account (Credits & usage) |

If you notice you're consistently hitting daily limits, you have two options:
1. Add more free providers (Z.AI, Cerebras) to spread the load
2. Upgrade to a paid provider (see next section)

---

### Step 9.2b: Update OpenClaw

When a new version is released, update with:

```bash
npm install -g openclaw@latest
systemctl --user restart openclaw-gateway
```

Check the release notes before upgrading -- major versions may require config changes.

---

### Step 9.3: Back Up Your Configuration (Complete)

On your Mac (not the server), run this to back up ALL critical configuration:

**Replace `100.x.y.z` with your actual Tailscale IP** in the commands below:

```bash
BACKUP_DIR=~/openclaw-backup/$(date +%Y%m%d)
mkdir -p "$BACKUP_DIR"

# Core config and secrets
scp -P 2222 deploy@100.x.y.z:~/.openclaw/openclaw.json "$BACKUP_DIR/"
scp -P 2222 deploy@100.x.y.z:~/.openclaw/.env "$BACKUP_DIR/"

# Keepalive and cron
scp -P 2222 deploy@100.x.y.z:~/keepalive.sh "$BACKUP_DIR/"
ssh -p 2222 deploy@100.x.y.z "crontab -l" > "$BACKUP_DIR/crontab.txt"

# System config (needs admin)
ssh -p 2222 admin@100.x.y.z "sudo cat /etc/fail2ban/jail.local" > "$BACKUP_DIR/jail.local"
ssh -p 2222 admin@100.x.y.z "sudo cat /etc/ssh/sshd_config" > "$BACKUP_DIR/sshd_config"
ssh -p 2222 admin@100.x.y.z "sudo iptables-save" > "$BACKUP_DIR/iptables-rules.v4"
ssh -p 2222 admin@100.x.y.z "node --version && openclaw --version" > "$BACKUP_DIR/versions.txt"

# Tailscale config (optional -- your Tailscale account remembers authorized devices)
ssh -p 2222 admin@100.x.y.z "sudo tailscale status" > "$BACKUP_DIR/tailscale-status.txt"

# SSH keys (if not already backed up)
cp ~/.ssh/id_ed25519 "$BACKUP_DIR/"
cp ~/.ssh/id_ed25519.pub "$BACKUP_DIR/"
```

> **OPTIONAL FOR PERSONAL USE -- The GPG encryption step below is optional. Copying your
> config files to a USB drive in a drawer is sufficient security for a personal bot. The
> backup commands above are the important part; the encryption below is only necessary if
> you're worried about someone physically stealing your USB drive.**

**Encrypt the backup** (the backup contains API keys and your SSH private key):

```bash
tar czf - "$BACKUP_DIR" | gpg --symmetric --cipher-algo AES256 -o ~/openclaw-backup-$(date +%Y%m%d).tar.gz.gpg
```

It will ask for a password -- use something strong and memorable.

Store the encrypted file on a USB drive. **NOT in Google Drive or iCloud** -- even
encrypted, it's better to keep credentials off cloud storage. Delete the unencrypted
backup folder after encrypting:

```bash
rm -rf "$BACKUP_DIR"
```

---

### Step 9.4: Set Up Health Monitoring (Get Alerts When Bot Goes Down)

**Why:** Without monitoring, you won't know your bot crashed until you try to use it. These free tools notify you within minutes.

#### Option A: Telegram Heartbeat (Simplest -- 5 Minutes Setup)

Create a script that sends you a daily "I'm alive" message via your own bot:

```bash
cat << 'SCRIPT' > ~/healthcheck.sh
#!/bin/bash
# Send daily heartbeat via Telegram
BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN ~/.openclaw/.env | cut -d= -f2)
# Replace YOUR_CHAT_ID with your Telegram user ID (get it by messaging @userinfobot)
CHAT_ID="YOUR_CHAT_ID"

# Check if OpenClaw is running
if systemctl --user is-active openclaw-gateway > /dev/null 2>&1; then
    STATUS="running"
    STATUS_LABEL="OK"
else
    STATUS="DOWN"
    STATUS_LABEL="ALERT"
fi

# Get system stats
UPTIME=$(uptime -p)
DISK=$(df -h / | awk 'NR==2{print $5}')
MEM=$(free -m | awk 'NR==2{printf "%.0f%%", $3/$2*100}')

MESSAGE="${STATUS_LABEL} OpenClaw Daily Report
Status: ${STATUS}
Uptime: ${UPTIME}
Disk: ${DISK} used
Memory: ${MEM} used
Time: $(date)"

curl -sf -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d chat_id="${CHAT_ID}" \
    -d text="${MESSAGE}" > /dev/null 2>&1
SCRIPT

chmod +x ~/healthcheck.sh
```

Add to crontab (`crontab -e`):

```
# Daily health report at 9 AM
0 9 * * * /home/deploy/healthcheck.sh
```

**To find your Telegram Chat ID:** Message @userinfobot on Telegram -- it replies with your numeric ID.

#### Option B: Healthchecks.io (Free, External Monitoring)

Healthchecks.io pings your server and alerts you if it stops responding. Free tier: 20 checks.

1. Sign up at **https://healthchecks.io/** (free, no credit card)
2. Create a new check, copy the ping URL (looks like `https://hc-ping.com/your-uuid`)
3. Add to your crontab (`crontab -e`):
   ```
   # Ping healthchecks.io every 5 minutes (alerts if missed for 10+ minutes)
   */5 * * * * systemctl --user is-active openclaw-gateway > /dev/null 2>&1 && curl -fsS --retry 3 https://hc-ping.com/YOUR-UUID > /dev/null
   ```
4. Configure alerts (email, Telegram, Discord, etc.) in the Healthchecks.io dashboard

**How it works:** If your server fails to ping for 10+ minutes, Healthchecks.io emails you. If your server is deleted or crashes, the pings stop and you get alerted.

---

## OPTIONAL: PAID AI UPGRADES

**You don't need any of these.** The free setup works. But if you want stronger AI quality
or higher limits, here are your best options.

---

### Option A: Anthropic Claude (Highest Reliability, $10-35/month)

Claude has the lowest hallucination rate and strongest SWE-Bench score (80.9%) of any model.
Kimi K2.5 rivals it on many benchmarks but hallucinates more. If you need the most reliable,
least error-prone AI for critical tasks, Claude is the upgrade to make.

1. Go to **https://console.anthropic.com/**
2. Create an account and add a payment method
3. **IMPORTANT: Set a spending limit** under Settings > Limits (e.g., $30/month)
4. Go to API Keys > Create Key
5. Add to your `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
6. Update your `openclaw.json` to use Claude:
   ```json5
   models: {
     // Claude Haiku is the cheapest Claude model (25x cheaper than Opus)
     default: "claude-haiku-4.5",
   }
   ```

**Pricing:**
| Model | Input (per 1M tokens) | Output (per 1M tokens) | Quality |
|-------|----------------------|------------------------|---------|
| Haiku 4.5 | $1 | $5 | Good (best value) |
| Sonnet 4.5 | $3 | $15 | Great |
| Opus 4.5 | $5 | $25 | Best available |

**Cost-saving tips for Claude:**
- Use Haiku for everything unless you need complex reasoning
- Reset sessions often (old messages get re-sent and re-charged every time)
- Set a hard monthly spending cap so you never get surprised

---

### Option B: OpenAI GPT ($10-30/month)

1. Go to **https://platform.openai.com/**
2. Sign up, add payment method
3. Set a spending limit under Settings > Limits
4. Create an API key
5. Add `OPENAI_API_KEY=sk-your-key-here` to your `.env`

---

### Option C: OpenRouter Credits ($10 One-Time -- Best Bang for Your Buck)

If you like Kimi K2.5 and the other free OpenRouter models but want more requests per day:

1. Go to https://openrouter.ai/account
2. Add $10 of credits
3. Your daily limit jumps from 50 to 1,000 requests/day on free models permanently
4. The $10 also gives you access to paid models (Claude, GPT-4o, etc.) via OpenRouter
5. Even on paid tiers, Kimi K2.5 is 8x cheaper than Claude for output tokens

This is the cheapest upgrade available -- $10 once, permanently 20x more daily requests.
If you're only going to spend money on one thing, this is it.

---

## SECURITY CHEAT SHEET

Every security layer we set up and why:

| Layer | What It Does | Why It Matters |
|-------|-------------|----------------|
| **Tailscale VPN** | SSH only accessible via private VPN network (100.x.y.z IPs); encrypted WireGuard tunnels | Server invisible to public internet; zero-config VPN; only your devices can connect |
| **SSH ListenAddress** | SSH daemon ONLY listens on Tailscale IP, not public IP | Even if Tailscale has a vulnerability, SSH isn't exposed publicly |
| **SSH Keys + Key Backup** | Only your Mac's key can log in; passwords disabled; key backed up to USB | Impossible to brute-force; no lockout risk |
| **Non-standard SSH port** | SSH on port 2222 instead of 22 | Reduces automated scan noise by 95%+ (backup defense with Tailscale) |
| **SSH session timeout** | Idle sessions disconnect after 10 minutes | Prevents unattended session hijacking |
| **Two-user model** (optional) | `admin` (sudo) for system tasks, `deploy` (no sudo) for OpenClaw | If bot is compromised, attacker has zero root access |
| **fail2ban** | Auto-blocks IPs after 3 failed attempts for 24 hours | Backup defense if Tailscale ever disabled |
| **Cloud firewall** | Oracle/Hostinger blocks all inbound ports (optional: delete all ingress rules) | Outermost defense layer; server invisible to scans |
| **Instance firewall** | Complete iptables ruleset: default DROP, allow only SSH; IPv6 also locked | Defense-in-depth with default-deny; protects even if cloud firewall misconfigured |
| **Auto-updates** | Security patches install automatically | Always protected |
| **File permissions** | 600/700 on config files | Only deploy user can read keys |
| **AIDE (intrusion detection)** (optional) | Daily file integrity check | Detects unauthorized system changes |
| **Audit logging** (optional) | Forensic record of all deploy user commands + config access | Full traceability if compromised |
| **Log rotation** (optional) | Journal capped at 500MB | Prevents disk exhaustion |
| **Disk encryption at rest** | Oracle Cloud encrypts all block volumes with AES-256 by default | Keys protected even at storage layer |
| **Gateway: loopback** | OpenClaw only accessible from the server itself | Invisible to internet |
| **Gateway: token in .env** | Random token stored in env file, not hardcoded in config | Secrets separated from configuration |
| **DM policy: pairing** | Strangers must be approved to chat | No unauthorized access |
| **Skill lockdown** | Only bundled + explicitly enabled skills | Prevents malicious plugins |
| **Sandboxed agents** | Workspace access set to "none" | Agents can't read your files |
| **Auto-restart** | Cron checks every 5 minutes, restarts if crashed | Minimizes downtime |
| **Encrypted backups** (optional) | Backups GPG-encrypted before storing on USB | Keys protected even if USB is lost |

### Account Security (Don't Forget These)

Enable **two-factor authentication (2FA/MFA)** on ALL of these accounts. If an attacker
compromises any of these accounts, they can regenerate your API keys:

- Oracle Cloud account (Settings > Security > MFA)
- Google account (used for Gemini)
- Groq account
- OpenRouter account
- Telegram account (Settings > Privacy > Two-Step Verification)

---

## TROUBLESHOOTING

### "Out of Host Capacity" when creating Oracle instance
- Try a different Availability Domain in the dropdown
- Try smaller size (1 OCPU / 6 GB)
- Try again in a few hours (early morning is best)
- Use auto-retry script: https://github.com/hitrov/oci-arm-host-capacity

### Can't connect via SSH
- **First, check Tailscale status:** Run `tailscale status` on your Mac -- is the server showing as "Connected"?
- If Tailscale is disconnected: reconnect with `tailscale up` on your Mac
- Verify you're using the **Tailscale IP** (100.x.y.z), not the public IP (SSH won't work on public IP after Phase 2)
- Check your server's Tailscale IP: log into https://login.tailscale.com/admin/machines and verify the IP
- Verify you're using the right username (`deploy` or `admin` after Phase 2.3)
- Make sure you're connecting on the right port: `ssh -p 2222 deploy@100.x.y.z`
- Try verbose mode: `ssh -p 2222 -i ~/.ssh/id_ed25519 deploy@100.x.y.z -v`
- **If Tailscale is completely broken:** Use the Oracle Cloud Console serial console to temporarily disable the `ListenAddress` restriction (see Disaster Recovery section)
- If completely locked out and serial console doesn't work, see Disaster Recovery section for full recovery instructions

### OpenClaw won't start
```bash
journalctl --user -u openclaw-gateway --no-pager -n 50
```
Common issues:
- Missing or invalid API key in `.env`
- Typo in `openclaw.json` (JSON syntax error)
- Node.js version too old (need v22+, check with `node --version`)

### Hitting free tier limits too fast
- Add more free providers (Z.AI, Cerebras) to spread the load
- Reset conversations regularly to reduce token usage
- Check which provider is getting hit: look at the dashboards in Phase 9
- Consider the $10 OpenRouter credit top-up for 20x more daily requests

### Server seems slow or unresponsive
- Check memory: `free -h` (if swap is heavily used, you may need more RAM)
- Check CPU: `top` (if consistently above 80%, allocate more OCPUs in Oracle Console)
- Check disk: `df -h` (if above 80% full, clean up old logs)
- Restart OpenClaw: `systemctl --user restart openclaw-gateway`

---

## DISASTER RECOVERY

### Scenario 1: Tailscale Disconnected or Broken (Can't SSH In)

**Severity:** Medium-High | **Recovery time:** 5-15 minutes

If Tailscale stops working and you can't connect via SSH:

**First, try restarting Tailscale on your Mac:**

```bash
tailscale down
tailscale up
```

Check status: `tailscale status` -- does your server show as "Connected"?

**If your Mac shows connected but you still can't SSH:**

1. Log into **https://login.tailscale.com/admin/machines**
2. Check if your server is showing as "Offline" or "Last seen X hours ago"
3. If offline, the server's Tailscale daemon may have crashed

**To fix from Oracle Cloud serial console:**

1. Log into **Oracle Cloud Console** (https://cloud.oracle.com)
2. Go to **Compute** > **Instances** > click your instance
3. Under **Resources** (left sidebar), click **Console Connection**
4. Click **Launch Cloud Shell Connection** (provides root access without password)
5. Once in the console, restart Tailscale:
   ```bash
   sudo systemctl restart tailscaled
   sudo tailscale up --ssh
   ```
6. Check status: `sudo tailscale status`
7. Exit the serial console and try SSH again via Tailscale IP

**If you need to temporarily disable Tailscale to regain SSH access:**

From the serial console (steps 1-4 above):

```bash
# Temporarily remove the ListenAddress restriction
sudo sed -i '/ListenAddress 100\./d' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

Now you can SSH via the public IP on port 2222 (if Oracle's firewall allows it). Fix
Tailscale, then re-add the `ListenAddress` line.

---

### Scenario 2: Lost SSH Key (Can't Connect to Server)

**Severity:** High | **Recovery time:** 15-30 minutes

If you lost your SSH private key and don't have a backup:

1. Log into **Oracle Cloud Console** (https://cloud.oracle.com)
2. Go to **Compute** > **Instances** > click your instance
3. Under **Resources** (left sidebar), click **Console Connection**
4. Click **Create Local Connection** (or **Launch Cloud Shell Connection**)
5. Follow Oracle's prompts to access the serial console
6. Once in, log in with your `admin` or `deploy` user's **password** (set in Phase 2.2)

> **Cloud-init users:** If you used the cloud-init template from Speed Tip 1, your users don't have passwords set (`lock_passwd: true`). You must set them BEFORE you lose SSH access. Run `sudo passwd admin` and `sudo passwd deploy` on your server now as a precaution, or use the **Launch Cloud Shell Connection** option in Oracle Console which provides direct root access without a password.

7. Generate a new SSH key pair on your Mac:
   ```bash
   ssh-keygen -t ed25519 -C "openclaw-server-recovery"
   ```
8. Copy the new public key content
9. On the serial console, paste the new public key:
   ```bash
   echo "ssh-ed25519 AAAA...your-new-key..." >> ~/.ssh/authorized_keys
   ```
10. Test SSH access with the new key from your Mac
11. **Back up the new key to USB immediately**

**Prevention:** Always keep your SSH key backed up on a USB drive (Step 1.1b). Consider backing up to a second USB stored in a different location.

---

### Scenario 3: Server Deleted or Terminated

**Severity:** Critical | **Recovery time:** 1-2 hours

If Oracle reclaims your instance or you accidentally delete it:

1. Create a new instance following Phase 1 (Steps 1.4-1.5)
2. Connect via SSH using the public IP (Tailscale isn't set up yet)
3. Re-run Phase 2 security hardening including Tailscale setup (or use cloud-init from Speed Tip 1)
4. **Re-authorize the new server in Tailscale:** Run `sudo tailscale up --ssh` and approve the new device at https://login.tailscale.com/admin/machines
5. Note the new Tailscale IP and update your Mac's `~/.ssh/config` file
6. Install OpenClaw (Phase 3)
7. Restore your config from backup:
   > Replace `YYYYMMDD` with your actual backup folder name. Run `ls ~/openclaw-backup/` to see available backups.
   > Replace `NEW_TAILSCALE_IP` with the new server's Tailscale IP (from step 4).
   ```bash
   # From your Mac, upload backed-up configs
   scp -P 2222 ~/openclaw-backup/YYYYMMDD/.env deploy@NEW_TAILSCALE_IP:~/.openclaw/.env
   scp -P 2222 ~/openclaw-backup/YYYYMMDD/openclaw.json deploy@NEW_TAILSCALE_IP:~/.openclaw/openclaw.json
   ```
8. Restore crontab:
   ```bash
   scp -P 2222 ~/openclaw-backup/YYYYMMDD/crontab.txt deploy@NEW_TAILSCALE_IP:/tmp/
   ssh -p 2222 deploy@NEW_TAILSCALE_IP "crontab /tmp/crontab.txt"
   ```
9. Start OpenClaw and verify

**Prevention:** Keep regular backups (Phase 9.3). Upgrade to Pay-As-You-Go (Step 1.3) to reduce reclaim risk. Set up health monitoring (Phase 9.4) to detect termination quickly.

---

### Scenario 4: Oracle Cloud Account Compromised

**Severity:** Critical | **Recovery time:** 30-60 minutes

1. **Immediately** change your Oracle Cloud password at https://cloud.oracle.com
2. Enable MFA if not already enabled
3. Review **Audit** logs: Oracle Console > Identity > Audit
4. Check for unauthorized instances, security list changes, or API key creation
5. Rotate ALL API keys (Gemini, Groq, OpenRouter) -- an attacker with server access could have read your `.env` file
6. Generate new SSH keys and update `authorized_keys` on your server
7. Revoke and regenerate your Telegram bot token via @BotFather (`/revoke`)
8. Review your Oracle billing for unexpected charges

**Prevention:** Enable MFA on your Oracle account (mentioned in Step 1.2). Use a unique, strong password. Never share Oracle credentials.

---

### Scenario 5: Bot Crashes and Won't Restart

**Severity:** Medium | **Recovery time:** 5-15 minutes

1. Check the logs:
   ```bash
   journalctl --user -u openclaw-gateway --no-pager -n 100
   ```
2. Check if Node.js is running:
   ```bash
   node --version
   ```
3. Check disk space (OpenClaw won't start if disk is full):
   ```bash
   df -h
   ```
4. Check memory:
   ```bash
   free -h
   ```
5. Try restarting:
   ```bash
   systemctl --user restart openclaw-gateway
   ```
6. If it still won't start, try reinstalling:
   ```bash
   npm install -g openclaw@latest
   systemctl --user restart openclaw-gateway
   ```
7. If reinstalling doesn't help, restore config from backup (it may be corrupted):
   ```bash
   # Back up current broken config first
   cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.broken
   # Restore from backup (replace YYYYMMDD with your actual backup folder name)
   # Run `ls ~/openclaw-backup/` to see available backups
   # Run this FROM YOUR MAC (not the server):
   # scp -P 2222 ~/openclaw-backup/YYYYMMDD/openclaw.json deploy@YOUR_SERVER_IP:~/.openclaw/
   #
   # Or if you have the backup on the server already:
   cp ~/openclaw-backup/YYYYMMDD/openclaw.json ~/.openclaw/
   ```

---

### Scenario 6: Telegram Bot Token Compromised

**Severity:** High | **Recovery time:** 5 minutes

If you suspect your Telegram bot token was leaked:

1. Open Telegram and message **@BotFather**
2. Send `/revoke`
3. Select your bot
4. BotFather generates a new token
5. Update your server's `.env` file with the new token:
   ```bash
   nano ~/.openclaw/.env
   # Replace the TELEGRAM_BOT_TOKEN value
   ```
6. Restart OpenClaw:
   ```bash
   systemctl --user restart openclaw-gateway
   ```
7. Re-pair your Telegram account (Phase 6.4)

---

## CRITICAL WARNINGS

### 1. There Is NO Official OpenClaw Cryptocurrency Token
Any $CLAWD, $OPENCLAW, or $MOLT token is a **SCAM**. The creator (Peter Steinberger) has
explicitly said there is no token. A fake token hit $16M market cap before crashing 90%.
Do not buy any token claiming to be associated with OpenClaw.

### 2. Malicious Skills Are a Real Threat
341 malicious skills were discovered in February 2026 designed to steal credentials.
ONLY install skills from verified sources. When in doubt, don't install it.

### 3. Your API Keys = Access to Your Accounts
If someone gets your API keys, they can use your accounts. That's why we locked down file
permissions and the server itself. Never share your `.env` file or paste keys into
untrusted skills.

### 4. Back Up Your SSH Key
If you lose your SSH private key (`~/.ssh/id_ed25519` on your Mac), recovery becomes difficult. Oracle's serial console can help (see Disaster Recovery), but it's much easier to have a backup. We covered this in Step 1.1b, but double-check: is your SSH key backed up to a USB drive right now? If not, do it immediately.

### 5. Free Tiers Can Change
Cloud providers and AI companies can modify their free tiers at any time. Google reduced
Gemini free limits in December 2025. Keep an eye on your usage dashboards and have backup
providers configured (which we do in this guide).

### 6. Tailscale Dependency for SSH Access
After Phase 2, your server ONLY accepts SSH connections via Tailscale VPN. If Tailscale
stops working (service outage, account issue, device deauthorized), you can't SSH in via
the public IP anymore. This is INTENTIONAL for security, but it means:

- Keep at least one device on your Tailscale network (your primary computer)
- Know how to use Oracle Cloud serial console for emergency access (see Disaster Recovery)
- Don't delete your Tailscale account or remove all authorized devices
- Consider keeping a second device (phone, tablet) with Tailscale installed as backup

The serial console is your fallback if Tailscale completely breaks.

---

## WHAT CLAUDE CODE CAN HELP WITH

| Phase | What Claude Code Can Do For You |
|-------|--------------------------------|
| Phase 1 (Server) | Navigate Oracle Cloud or Hostinger signup, click through instance creation |
| Phase 2 (Security) | Generate Tailscale + hardening commands, review firewall rules |
| Phase 3 (Install) | Generate install scripts, troubleshoot errors |
| Phase 4 (AI Providers) | Navigate Gemini/Groq/OpenRouter signups, grab API keys |
| Phase 5 (Configure) | Write/edit `openclaw.json` and `.env` files |
| Phase 6 (Telegram) | Update config files, troubleshoot connection issues |
| Phase 7 (Skills) | Review skill source code for security red flags |
| Phase 8 (Running) | Create systemd services, cron jobs, monitoring scripts |
| Phase 9 (Maintain) | Generate backup scripts, run diagnostics |

**What Claude Code can do with browser automation:**
- Navigate signup pages for Oracle Cloud, Gemini, Groq, OpenRouter
- Click through UI steps, fill non-sensitive fields, grab API keys
- Screenshot each step so you can follow along

**What YOU still need to handle:**
- Typing passwords and credit card numbers (security reasons)
- CAPTCHA / verification challenges
- SMS codes sent to your phone
- Scanning QR codes (Telegram, WhatsApp)
- Choosing which skills you want (that's your call)

---

## MONTHLY TIME COMMITMENT

Once everything is set up:

| Task | How Often | Time |
|------|-----------|------|
| Quick health check (Step 9.1) | Weekly | 2 min |
| Check free tier usage | Weekly | 2 min |
| Security audit | Weekly | 5 min |
| System updates | Automatic | 0 min |
| **Total** | **Weekly** | **~9 min** |

---

## TOTAL COST SUMMARY

| Item | One-Time | Monthly |
|------|----------|---------|
| Oracle Cloud server | $0 | $0 |
| OpenClaw software | $0 | $0 |
| Google Gemini API | $0 | $0 |
| Groq API | $0 | $0 |
| OpenRouter API | $0 | $0 |
| Telegram | $0 | $0 |
| **Total (free plan)** | **$0** | **$0** |
| | | |
| *Optional: Claude API* | *$0* | *$10-35* |
| *Optional: OpenRouter credits* | *$10* | *$0* |

---

## SPEED UP YOUR SETUP (CUT 2-3 HOURS DOWN TO 45-75 MINUTES)

These tips are sourced from community guides, forums, and open-source projects. They can
dramatically reduce your setup time.

### Speed Tip 1: Use Cloud-Init to Automate Most of Phase 2

Instead of manually running every security hardening command, you can paste a **cloud-init
template** into the "User Data" field when creating your Oracle Cloud instance (Step 1.4).
This runs most hardening steps automatically at first boot -- you SSH in and it's mostly done.

**Note:** This cloud-init template does NOT include Tailscale setup. You'll still need to
manually run Steps 2.1, 2.1b, and 2.1c (Tailscale installation and SSH configuration) after
the server boots. The cloud-init handles user creation, basic SSH hardening, fail2ban, swap,
and auto-updates.

In the Oracle instance creation form, expand **"Show Advanced Options"** at the bottom,
click **"Cloud-Init Script"**, paste the template below, and click Create. Most of Phase 2
runs itself.

**Replace `YOUR_PUBLIC_KEY_HERE` with your actual SSH public key from Step 1.1b:**

```yaml
#cloud-config

package_update: true
package_upgrade: true

users:
  - name: deploy
    groups: []
    lock_passwd: true
    shell: /bin/bash
    ssh-authorized-keys:
      - ssh-ed25519 YOUR_PUBLIC_KEY_HERE openclaw-server
    sudo: []
  - name: admin
    groups: [sudo]
    lock_passwd: true
    shell: /bin/bash
    ssh-authorized-keys:
      - ssh-ed25519 YOUR_PUBLIC_KEY_HERE openclaw-server
    sudo: ['ALL=(ALL) NOPASSWD:ALL']

write_files:
  - path: /etc/ssh/sshd_config.d/hardened.conf
    content: |
      PermitRootLogin no
      PasswordAuthentication no
      ChallengeResponseAuthentication no
      # UsePAM intentionally omitted -- PAM must stay enabled for systemd --user sessions (required by OpenClaw)
      X11Forwarding no
      MaxAuthTries 3
      AllowUsers admin deploy
  - path: /etc/fail2ban/jail.local
    content: |
      [sshd]
      enabled = true
      port = 22
      filter = sshd
      logpath = /var/log/auth.log
      maxretry = 3
      bantime = 3600
      findtime = 600

packages:
  - fail2ban
  - unattended-upgrades
  - build-essential
  - git
  - curl
  - wget

runcmd:
  - systemctl restart sshd
  - systemctl enable fail2ban
  - systemctl start fail2ban
  - fallocate -l 4G /swapfile
  - chmod 600 /swapfile
  - mkswap /swapfile
  - swapon /swapfile
  - echo '/swapfile none swap sw 0 0' >> /etc/fstab
  - dpkg-reconfigure -plow unattended-upgrades
```

> **Note:** This template creates the two-user setup (admin + deploy). If you prefer the
> single-user setup from Phase 2.2, remove the `admin` user block and add `sudo: ['ALL=(ALL) NOPASSWD:ALL']`
> to the `deploy` user instead. This template does NOT set up the custom SSH port (2222)
> or iptables -- you'll still need to do those steps manually from Phase 2, or add them
> to the `runcmd` section if you're comfortable with cloud-init. If you change the SSH
> port to 2222, also update the `port = 22` line in the fail2ban `jail.local` block above
> to `port = 2222`.

### Speed Tip 2: Beat "Out of Capacity" with Auto-Retry Scripts

The biggest time sink is often waiting for Oracle ARM capacity. These scripts retry
automatically every 60 seconds until capacity appears, and notify you when your instance
is ready:

- **Python:** https://github.com/mohankumarpaluru/oracle-freetier-instance-creation
  - Run `./setup_env.sh` then `./setup_init.sh` -- it retries in the background
- **PHP:** https://github.com/hitrov/oci-arm-host-capacity
  - Set up a cron job to run every minute

**Pro tips for faster capacity:**
- Upgrade to Pay-As-You-Go FIRST (PAYG accounts get capacity more reliably)
- Start with 1 OCPU / 6 GB (smaller shapes have better availability), resize later
- Try early morning in your region's timezone
- Avoid US East (Ashburn) and US West (Phoenix) entirely

### Speed Tip 3: Docker-Based OpenClaw Deployment (38 Seconds)

Instead of manually installing Node.js + OpenClaw + configuring systemd services, use the
official Docker setup that handles everything:

```bash
# Install Docker first (as admin)
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
less /tmp/get-docker.sh  # Review it
sudo sh /tmp/get-docker.sh
sudo usermod -aG docker deploy
rm /tmp/get-docker.sh

# Then as deploy user
git clone https://github.com/openclaw/openclaw.git
cd openclaw
./docker-setup.sh
```

This replaces Phases 3, 5, and 8 with a single command. Reported completion time: **38
seconds** on a fresh Ubuntu VPS.

**Security trade-off:** Adding `deploy` to the `docker` group (line above) grants
root-equivalent access because Docker containers can mount the host filesystem. This
partially negates the two-user security model from Phase 2. If security is your top
priority, skip this tip and use the manual Phase 3 installation instead. If speed is
more important, understand that the Docker path trades some security isolation for
significant convenience.

### Speed Tip 4: Parallelize AI Provider Signups

Phases 4.1 through 4.4 are independent -- sign up for Gemini, Groq, OpenRouter, and Z.AI
at the same time in different browser tabs. This cuts 15-20 minutes down to 5-10.

### Speed Tip 5: Pre-Write Your Config Files

Before you even create the server, prepare your `openclaw.json` and `.env` files on your
Mac. Once the server is ready, just `scp` them over:

```bash
scp -P 2222 ~/openclaw-configs/.env deploy@YOUR_IP:~/.openclaw/.env
scp -P 2222 ~/openclaw-configs/openclaw.json deploy@YOUR_IP:~/.openclaw/openclaw.json
```

### Time Savings Summary

| Phase | Manual | With Speed Tips | How |
|-------|--------|----------------|-----|
| Phase 1 (Oracle) | 30-45 min | 15-20 min + auto-retry | Auto-retry script runs in background |
| Phase 2 (Security + Tailscale) | 30-40 min | 5-10 min | Cloud-init + Tailscale one-liner (ListenAddress still manual) |
| Phase 3 (Install) | 15-20 min | 2-5 min | Docker setup or combined script |
| Phase 4 (AI Keys) | 15-20 min | 5-10 min | Parallel browser tabs |
| Phase 5 (Configure) | 15-20 min | 2-3 min | Pre-written config files via scp |
| Phase 6 (Telegram) | 10 min | 5 min | Template config ready to paste |
| Phase 8 (Running) | 5-10 min | 0 min | Handled by Docker or --install-daemon |
| **Total** | **~2-3 hours** | **~45-75 min** | |

---

## REDUCE TOKEN BURN AND MAXIMIZE EFFICIENCY

Once your bot is running, these strategies will help you get the most out of your free
API quotas and minimize costs if you use paid providers.

### Why Tokens Get Burned

Every time you send a message to OpenClaw, the **entire conversation history** gets sent
back to the AI provider. A 20-message conversation means the AI re-reads all 20 messages
(and pays for them) just to generate reply #21. Additionally:

- Workspace files (AGENTS.md, SOUL.md, USER.md) are injected into every request
- Large tool outputs are saved in logs and re-sent with every message
- Session history grows indefinitely if not reset
- Heartbeats consume tokens if using an expensive model
- Sub-agents each create their own context windows

### Strategy 1: Reset Sessions Regularly (40-60% Estimated Savings)

Likely the single most impactful habit. Use `/new` or `/compact` frequently:

- `/new` -- Start a fresh session (clears all accumulated context)
- `/compact` -- Compress current session (keeps key info, removes bloat)
- `/status` -- Check how many tokens your current session is consuming
- `/usage full` -- Enable real-time usage display so you can see token cost per message

**Rule of thumb:** Reset sessions after completing each distinct task. Don't let
conversations grow past 50+ messages. As a rough guide, 1,000 tokens is about 750 words --
so a 50-message conversation can easily exceed 50,000 tokens being re-sent every single time.

**Nuclear option -- clear all old sessions:**
```bash
rm -rf ~/.openclaw/agents.main/sessions/*.jsonl
```
This deletes all session history. Your bot will still work, but past conversations are gone.
Only use this if disk space is tight or sessions have grown very large.

### Strategy 2: Smart Model Routing (50-80% Estimated Savings)

Don't use your best model for everything. Route tasks by complexity:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "gemini-2.5-flash",
        fallbacks: [
          "groq/kimi-k2",
          "openrouter/free"
        ]
      },
      // Use the cheapest model for heartbeats (status checks)
      heartbeat: {
        every: "30m",
        model: "gemini-2.5-flash-lite"
      },
      // Use a mid-tier model for sub-agents
      subagents: {
        model: "groq/kimi-k2",
        maxConcurrent: 1,
        archiveAfterMinutes: 60
      }
    }
  }
}
```

**Note:** The exact field names above (`heartbeat`, `subagents`, `archiveAfterMinutes`)
are illustrative. Check the OpenClaw documentation for the exact configuration schema, as
field names may differ between versions.

You can also switch models mid-session with `/model`:
- `/model flash` -- cheap model for simple questions
- `/model pro` -- powerful model for complex tasks

### Strategy 3: Maximize Free Tier Stacking (~3,000+ Requests/Day for $0)

Your free tiers are more generous than they seem when stacked:

| Provider | Model | Free RPD | Best For |
|----------|-------|----------|----------|
| Gemini | Flash-Lite | 1,000 | Simple tasks, high volume |
| Gemini | Flash | 250 | General use |
| Gemini | Pro | 100 | Complex reasoning |
| Groq | Kimi K2 | 1,000 | Fast responses |
| Groq | Llama 4 Scout | 1,000 | General use |
| OpenRouter | Free models | 50 (1,000 with $10) | Variety + fallback |
| **Total** | | **~3,000+** | |

**Key detail:** Gemini limits are per Google Cloud **project**, not per API key. Creating
extra keys in the same project doesn't help. But creating a second project with its own
key does give you a separate quota.

**All Gemini limits reset at midnight Pacific Time.** Groq and OpenRouter reset daily
based on your account's timezone.

### Strategy 4: Cache Responses (30-50% Estimated Savings)

Set a lower temperature (0.2) for more deterministic responses that cache better:

```json5
{
  agents: {
    defaults: {
      "cache-ttl": 3600,
      temperature: 0.2
    }
  }
}
```

> **Note:** The `cache-ttl` field name is illustrative. Check your OpenClaw version's documentation for the exact caching configuration syntax.

Provider-side prompt caching (Anthropic, Google) makes cached tokens 75% cheaper. Move
static system prompt parts to the top of your prompts for maximum cache hits.

### Strategy 5: Control Output Tokens (20-30% Estimated Savings)

Output tokens cost 2-5x more than input tokens. Keep responses concise:

- Set `max_tokens` limits in your config
- Request structured formats (bullet points, JSON) instead of essays
- Use stop sequences to prevent verbose completions

### Strategy 6: The $10 OpenRouter Play (Best Value Investment)

Adding just $10 of OpenRouter credits:
- Increases your daily free model quota from 50 to **1,000 requests**
- Gives you access to paid models (Claude, GPT-4o) via OpenRouter too
- Even paid models through OpenRouter are often cheaper than direct API access
  (e.g., Kimi K2.5 output tokens are 8x cheaper than Claude)

**If you're only going to spend money on one thing, this is it.** $10 once, 20x more
daily requests permanently.

### Quick Reference: Token Savings by Strategy

> **Note:** Savings percentages are estimates based on general LLM usage patterns, not validated against specific OpenClaw configurations. Your actual savings will vary based on usage patterns.

| Strategy | Savings | Difficulty |
|----------|---------|------------|
| Reset sessions regularly (`/new`) | 40-60% | Easy |
| Smart model routing (cheap for simple, powerful for complex) | 50-80% | Medium |
| Free tier stacking (Gemini + Groq + OpenRouter) | $0 cost | Already done |
| Response caching (low temperature + cache-ttl) | 30-50% | Easy |
| Output control (max_tokens, structured formats) | 20-30% | Easy |
| $10 OpenRouter credits | 20x more daily requests | $10 once |
| **Combined** | **Up to 80%+** | |
