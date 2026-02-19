# Free & Cheap Cloud Options for Running a 24/7 Python/Node Bot (February 2026)

## Quick Recommendation Summary

| Rank | Provider | Cost | 24/7 Capable? | Best For |
|------|----------|------|---------------|----------|
| 1 | **Oracle Cloud Free Tier** | $0 forever | Yes | Best overall free option |
| 2 | **Google Cloud Free Tier** | $0 forever | Yes | Reliable always-free runner-up |
| 3 | **Hetzner CAX11 (ARM)** | ~$3.79/mo | Yes | Best cheap paid option |
| 4 | **AWS Free Tier** | $0 for 12 months | Yes (12 mo only) | Good if you have a new account |
| 5 | **Azure Free Tier** | $0 for 12 months | Yes (12 mo only) | Good if you have a new account |
| 6 | **Render Free Tier** | $0 forever | No (spins down) | Web-facing bots only, with workarounds |
| 7 | **Fly.io** | Pay-as-you-go | Yes | No longer has a free tier |
| 8 | **Railway** | $5/mo after trial | Yes | Not free long-term |

---

## 1. Oracle Cloud Free Tier (Always Free) -- BEST FREE OPTION

### What's Actually Free
- **Duration**: Forever ("Always Free") -- no expiration
- **Compute**: Up to 4 ARM Ampere A1 OCPUs + 24 GB RAM total (split across up to 4 instances)
- **Also available**: 2 AMD x86 instances (1/8 OCPU, 1 GB RAM each)
- **Storage**: 200 GB total block volume storage
- **Network**: 10 TB/month outbound data transfer
- **Extras**: 2 Autonomous Databases, Load Balancer, Object Storage (10 GB), and more

### CPU/RAM/Storage Limits
- **ARM (recommended)**: Up to 4 OCPUs, 24 GB RAM (e.g., one 4-core/24GB instance, or four 1-core/6GB instances)
- **x86 (AMD)**: 2 instances, each with 1/8 OCPU and 1 GB RAM
- **Boot volume**: Up to 200 GB total across instances (minimum ~47 GB per instance)

### Can It Run 24/7?
**Yes**, but with a critical caveat. Oracle has an **idle reclaim policy**: if your instance's CPU utilization stays below ~10-20% (95th percentile) over a 7-day period, Oracle may reclaim (stop/terminate) the instance. Common workarounds:
- Run a lightweight cron job that creates periodic CPU activity
- Use tools like `lookbusy` or a simple script to maintain minimal CPU usage
- Running an actual bot typically generates enough activity to avoid this

### Security Features
- **VCN (Virtual Cloud Network)** with built-in security lists (acts as a firewall)
- Default security list blocks most inbound traffic; you open only what you need
- Network Security Groups for fine-grained rules
- Free DDoS protection
- SSH key-based authentication by default (no password login)
- **Setup effort**: Moderate -- you need to configure VCN security lists and iptables on the instance

### Gotchas & Hidden Costs
- **Account creation can be difficult**: Oracle is known to reject signups from certain regions/IPs. You may need to try multiple times with different browsers/addresses.
- **Idle reclaim**: Your instance can be stopped if it appears idle for 7 days (see above).
- **Instance availability**: ARM instances are frequently "out of capacity" in popular regions. You may need to script repeated creation attempts or try less popular regions.
- **Free trial vs Always Free confusion**: Oracle gives $300 in credits for 30 days on top of Always Free. After the trial ends, paid resources are deleted, but Always Free resources persist.
- **No credit card workaround**: A valid credit card is required at signup, but you won't be charged for Always Free resources.

---

## 2. Google Cloud Free Tier (e2-micro) -- RELIABLE RUNNER-UP

### What's Actually Free
- **Duration**: Forever ("Always Free") -- no expiration
- **Compute**: 1 e2-micro VM instance per month
- **Storage**: 30 GB standard persistent disk
- **Network**: 1 GB egress from North America to all regions (excluding China/Australia) per month
- **Extras**: Free external IP address, 5 GB Cloud Storage, 1 GB Cloud Functions invocations, and more

### CPU/RAM/Storage Limits
- **vCPU**: 2 shared vCPUs (but only 25% sustained CPU time -- 12.5% per core)
- **RAM**: 1 GB
- **Disk**: 30 GB standard persistent disk (not SSD)
- **Region restriction**: Must be in us-west1 (Oregon), us-central1 (Iowa), or us-east1 (South Carolina)

### Can It Run 24/7?
**Yes**. The e2-micro runs continuously without spin-down. You get enough hours each month to run one instance 24/7. No idle reclaim policy like Oracle.

### Security Features
- Google Cloud Firewall (VPC firewall rules) -- deny-all ingress by default
- IAM roles and service accounts
- SSH via browser (Cloud Console) or SSH keys
- Free DDoS protection at the network level
- **Setup effort**: Low-to-moderate -- default firewall rules are secure; you just open the ports you need

### Gotchas & Hidden Costs
- **1 GB RAM is tight**: For Python bots, this is workable. For Node.js, you may need to tune memory (set `--max-old-space-size`).
- **25% CPU cap**: The e2-micro is a shared-core instance. If your bot has CPU-intensive tasks, it will be throttled.
- **Region locked to US only**: If you're outside the US, latency will be higher. No free tier in EU/Asia.
- **Network egress limit**: Only 1 GB/month of free outbound traffic. If your bot makes many external API calls with large payloads, you could exceed this and incur charges.
- **Billing account required**: You must set up a billing account. Charges begin automatically if you exceed free limits. Set up billing alerts!
- **No guaranteed SLA**: Free tier has no uptime SLA.

---

## 3. AWS Free Tier (t2.micro / t3.micro) -- 12-MONTH ONLY

### What's Actually Free
- **Duration**: 12 months from account creation (NOT always free)
- **Compute**: 750 hours/month of t2.micro (or t3.micro in regions where t2 is unavailable)
- **Storage**: 30 GB of EBS (Elastic Block Storage)
- **Network**: 100 GB data transfer out per month (first 12 months), 750 hours of public IPv4 per month
- **Extras**: 750 hours RDS (db.t2.micro/db.t3.micro), S3 (5 GB), Lambda (1M requests), and more

### CPU/RAM/Storage Limits
- **vCPU**: 1 vCPU (burstable)
- **RAM**: 1 GB
- **Disk**: 30 GB EBS (gp2 or gp3)
- **CPU credits**: t2.micro earns CPU credits that allow short bursts; sustained high CPU usage will be throttled

### Can It Run 24/7?
**Yes, for 12 months**. 750 hours/month is enough for one instance running 24/7. After 12 months, you pay standard on-demand pricing (~$8-12/month for t3.micro depending on region).

### Security Features
- **Security Groups** (stateful firewall) -- deny-all ingress by default
- VPC with network ACLs
- IAM for access management
- AWS Shield (basic DDoS protection) included free
- SSH key pairs required by default
- **Setup effort**: Moderate -- AWS has the most complex console, but security defaults are good

### Gotchas & Hidden Costs
- **Expires after 12 months**: This is the biggest issue. After 12 months, you'll be billed at full price.
- **Easy to accidentally incur charges**: AWS has hundreds of services. Accidentally leaving a NAT Gateway, Elastic IP, or extra EBS volume running can generate surprise bills.
- **Billing complexity**: AWS billing is notoriously complex. Set up billing alerts and AWS Budgets immediately.
- **No Always Free compute**: Unlike Oracle and Google, AWS has no permanently free VM option.
- **t2.micro CPU credit exhaustion**: If your bot runs at high CPU continuously, it will run out of CPU credits and be throttled to baseline (10% of a vCPU).

---

## 4. Azure Free Tier -- 12-MONTH ONLY

### What's Actually Free
- **Duration**: 12 months for VMs (NOT always free for compute)
- **Compute**: 750 hours/month of B1S Linux or Windows VM
- **Also free for 12 months**: B2pts v2 (ARM) and B2ats v2 (AMD) burstable VMs, 750 hours/month each
- **Storage**: 2 x 64 GB P6 SSD Managed Disks
- **Extras**: Azure Cosmos DB (25 GB), Azure SQL Database (250 GB), and more
- **$200 credit**: For the first 30 days, usable on any Azure service

### CPU/RAM/Storage Limits
- **B1S**: 1 vCPU, 1 GB RAM, 4 GB temp storage
- **B2pts v2 (ARM)**: 2 vCPU, 1 GB RAM
- **B2ats v2 (AMD)**: 2 vCPU, 1 GB RAM
- **Managed Disks**: 2 x 64 GB P6 SSD

### Can It Run 24/7?
**Yes, for 12 months**. 750 hours/month covers continuous operation. After 12 months, VMs convert to pay-as-you-go pricing automatically unless you deprovision them.

### Security Features
- **Network Security Groups (NSGs)** -- deny-all ingress by default
- Azure Firewall (basic tier)
- Azure DDoS Protection (basic, free)
- Azure Active Directory (Entra ID) for identity management
- SSH key authentication
- **Setup effort**: Moderate -- similar to AWS in complexity

### Gotchas & Hidden Costs
- **Expires after 12 months**: Like AWS, the free compute expires.
- **Hidden charges from associated resources**: Creating a "free" VM often triggers billable resources like additional managed disks, public IP addresses, and diagnostic storage. The free tier only covers the VM compute itself.
- **Public IP cost**: Azure began charging for public IPv4 addresses. Make sure any IP you use is covered by the free tier allocation.
- **Automatic conversion to paid**: After 12 months, resources automatically start billing. You must proactively delete them.
- **Complex pricing**: Like AWS, Azure billing can be confusing with many line items.

---

## 5. Fly.io -- NO LONGER FREE

### What's Actually Free
- **Free tier is effectively dead for new users** as of 2024/2025. Fly.io no longer offers a free plan or free trial for new organizations.
- **Legacy users** who signed up when the Hobby plan existed may still have free allowances: 3 shared-cpu-1x 256MB VMs, 3GB persistent volume, 100GB outbound transfer.

### Current Pricing (New Users)
- No monthly fee, pure pay-as-you-go
- Shared CPU 1x, 256MB RAM: ~$1.94/month
- Dedicated IPv4: $2/month per app
- Outbound data: $0.02/GB
- Volume storage: $0.15/GB/month
- **Minimum realistic cost for a small bot: ~$4-6/month**

### Can It Run 24/7?
**Yes**, machines run continuously by default (no spin-down unless you configure auto-stop).

### Gotchas
- No free tier for new signups
- Requires credit card
- Volume snapshot charges started January 2026 ($0.08/GB/month, first 10GB free)
- Dedicated IPv4 costs $2/month (shared IPv4/IPv6 is cheaper)

---

## 6. Railway -- FREE TRIAL ONLY

### What's Actually Free
- **Duration**: 30-day free trial with $5 in credits
- **After trial**: Hobby plan at $5/month (includes $5 in credits) or Pro at $20/month
- **No always-free tier exists**

### Free Trial Limits
- **RAM**: 1 GB
- **CPU**: Shared vCPU
- **Services**: Up to 5 per project
- **Network**: Full access if GitHub account is verified; restricted if not

### Can It Run 24/7?
**Yes, during the trial**. Railway does not spin down services. But after 30 days, you must pay.

### Gotchas
- Only 30 days free -- not viable for long-term free hosting
- Network restrictions if GitHub account cannot be verified
- $5/month Hobby plan is the minimum for continued use

---

## 7. Render Free Tier -- FREE BUT SPINS DOWN

### What's Actually Free
- **Duration**: Forever (free tier does not expire)
- **Compute**: Free web services with 0.1 CPU and 512 MB RAM
- **Bandwidth**: 100 GB/month
- **Build minutes**: 500/month
- **Instance hours**: 750 hours/month

### CPU/RAM/Storage Limits
- **CPU**: 0.1 vCPU
- **RAM**: 512 MB
- **Bandwidth**: 100 GB/month
- **No persistent disk** on free tier

### Can It Run 24/7?
**No, not natively**. Free web services spin down after 15 minutes of inactivity and take up to 60 seconds to cold-start on the next request. Additionally, **background workers are NOT available on the free plan** -- only web services.

**Workarounds to keep it alive**:
- Use an external service like UptimeRobot (free, pings every 5 minutes)
- Set up a cron job that hits your service endpoint regularly
- These are technically against the spirit of the free tier and Render may suspend high-traffic free services

### Security Features
- HTTPS by default (automatic TLS certificates)
- Private networking between services
- No SSH access (managed platform)
- **Setup effort**: Very low -- Render handles security for you

### Gotchas
- **Spin-down is the deal-breaker**: For a bot that needs to maintain a persistent connection (WebSocket, Discord, Telegram polling), the 15-minute spin-down makes this unreliable.
- **No background workers on free tier**: You can only run web services, not long-running background processes.
- **May be suspended**: Render can suspend free services that generate high outbound traffic.
- **No SSH/shell access**: You can't SSH into the instance for debugging.

---

## 8. Hetzner Cloud VPS -- BEST CHEAP PAID OPTION

### Pricing (Not Free, But Extremely Cheap)
- **CAX11 (ARM)**: 3.79 EUR/month (~$4.10 USD) -- 2 vCPU Ampere, 4 GB RAM, 40 GB NVMe, 20 TB traffic
- **CX22 (x86)**: 3.49 EUR/month (~$3.80 USD) -- 2 vCPU Intel/AMD, 4 GB RAM, 40 GB NVMe, 20 TB traffic
- **Hourly billing with monthly cap** (cheaper of the two is applied)

### CPU/RAM/Storage
- **CAX11**: 2 ARM vCPU, 4 GB RAM, 40 GB NVMe SSD, 20 TB traffic
- **CX22**: 2 x86 vCPU, 4 GB RAM, 40 GB NVMe SSD, 20 TB traffic
- Far more powerful than any free tier option

### Can It Run 24/7?
**Yes**, with no restrictions. Full VPS with root access. No spin-down, no idle reclaim, no usage caps.

### Security Features
- Built-in cloud firewall (free)
- DDoS protection included
- IPv4 + IPv6 included
- Full root access -- you manage your own security (SSH, firewall rules, updates)
- **Setup effort**: Moderate -- standard Linux server administration required

### Gotchas
- **Not free** -- minimum ~$3.80/month
- **EU-only for ARM instances** (Germany and Finland data centers)
- **x86 instances available in US** (Ashburn, VA) and EU
- **You're responsible for all security**: OS updates, firewall configuration, SSH hardening
- **No managed services**: You install and maintain everything yourself

---

## 9. Other Notable Options

### IBM Cloud Free Tier
- 40+ always-free products, but **no always-free VM/compute instance**
- Free tier includes Cloud Functions (serverless), Cloudant NoSQL DB, Object Storage
- $200 credit for first 30 days
- **Not suitable for 24/7 bot hosting** in the free tier

### DigitalOcean
- **No free tier** -- only a $200 credit / 60-day trial
- After trial: cheapest Droplet is $4/month (1 vCPU, 512 MB RAM)
- Good option if you want simplicity, but not free

### Vultr
- Free trial with $100 credit (limited time)
- Cheapest VPS: $2.50/month (1 vCPU, 512 MB RAM, IPv6 only)
- $3.50/month with IPv4
- No always-free tier

### GratisVPS
- Claims to offer a free forever VPS
- Some reports of it working for Discord bots
- **NOT RECOMMENDED** -- unclear business model, no accountability, no transparency about
  how they fund free infrastructure. Your data and API keys would be on their hardware with
  no guarantees about privacy or security. Use Oracle or Google Cloud instead.

---

## Final Recommendation

### For $0/month (Best Free Option): Oracle Cloud Always Free

**Configuration**: 1 ARM instance with 2 OCPUs and 12 GB RAM (or split as needed)

**Why**:
- The most generous free tier by far (4 cores, 24 GB RAM, 200 GB storage)
- Runs 24/7 as a real VM with full root access
- ARM is perfectly fine for Python and Node.js bots
- 10 TB/month outbound transfer is more than enough

**Mitigations for the downsides**:
- Run a simple cron job to avoid idle reclaim: `*/5 * * * * dd if=/dev/urandom bs=1M count=10 | md5sum > /dev/null` or similar
- Script the instance creation to handle "out of capacity" errors
- Configure iptables + VCN security lists to lock down the instance

### For $0/month (Backup Option): Google Cloud e2-micro

**Why**: More reliable than Oracle (no idle reclaim), simpler setup, well-documented. The trade-off is much less power (1 GB RAM, 25% CPU vs Oracle's 24 GB RAM and 4 full cores).

### For ~$4/month (Best Value): Hetzner CAX11

**Why**: If you can spend a few dollars a month, Hetzner gives you 4 GB RAM, 2 ARM cores, 40 GB NVMe, and 20 TB traffic with no restrictions, no gotchas, and no fear of your instance being reclaimed. Peace of mind for the cost of a coffee.

---

## Security Checklist (Applies to All VPS Options)

Regardless of which provider you choose, follow these basics:

1. **SSH key authentication only** -- disable password login
2. **Change the default SSH port** (e.g., to 2222) -- reduces automated scan noise by 95%+
3. **Enable a firewall with default-deny** -- use iptables with `INPUT DROP` policy, allow only SSH; also lock down IPv6
4. **Keep the OS updated** -- `apt update && apt upgrade` regularly (or enable unattended upgrades)
5. **Don't run the bot as root** -- create a dedicated non-sudo user for the bot process
6. **Use environment variables for secrets** -- never hardcode API keys in config files
7. **Set up fail2ban** -- blocks repeated failed login attempts; add `ignoreip` for your home IP
8. **Enable automatic security updates** -- `unattended-upgrades` on Ubuntu/Debian
9. **Set up intrusion detection** -- install AIDE for file integrity monitoring
10. **Enable audit logging** -- install `auditd` to trace what happened if compromised
11. **Enable 2FA/MFA** on all cloud provider accounts -- prevents API key theft via account compromise
12. **Encrypt backups** -- GPG-encrypt any backup containing API keys or SSH keys
