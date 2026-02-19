# This project will initially be used for helping me speed up my job search effeciently, securely, and with my human sign off

Id like to create a custom job-application-generator skill using the skill-creator skill. that would standardize:

Parsing job descriptions
Tailoring resume bullets to match keywords
Generating cover letters with consistent structure
Drafting screening question responses
Ensuring output quality and formatting consistency

That's it. Then OpenClaw setup can handle the entire workflow:

Cron triggers daily search
Scrapes/fetches job descriptions
Uses docx skill to generate tailored materials
Saves to Google Drive folders
Updates Google Sheet tracker
Sends Telegram notification

Runs daily searches on Indeed/LinkedIn/Built In APIs or scrapers
Fetch full job descriptions
Generates tailored materials such as a tweaked copy of my resume, a cover letter, Screening question responses
Saves everything to a New Google Drive folder
Google sheet with job, job link, pay, location, and the tailored google drive photo
Sends me a telegram notification: "15 new applications ready for review"

# Safe OpenClaw skills for automated job applications: a minefield with a path forward

**No single safe, verified skill exists on ClawHub that fully automates job applications** — and the most feature-complete one (`linkedin-job-application`) is confirmed malware from the ClawHavoc campaign. However, a viable workflow can be assembled from **6–8 trusted skills** spanning official bundled tools and community-vetted options, combined with OpenClaw's native capabilities. The critical gap is job board scraping, where no pre-built safe skill exists, but trusted browser automation skills fill this role. Every skill recommended below has either passed VirusTotal scanning, ships as an official bundled skill, or appears in multiple curated safety lists.

The OpenClaw ecosystem exploded to **5,705+ skills** on ClawHub by February 2026, but security researchers found **12–17% are malicious**. The VirusTotal partnership (announced February 5, 2026) now scans every skill with behavioral analysis powered by Gemini's Code Insight, assigning "benign," "suspicious," or "malicious" verdicts. Skills scoring "malicious" are blocked from download. This report identifies which skills pass muster for each stage of the job application pipeline.

---

## The verified safe skills you can actually use

The following skills form the backbone of a secure job application workflow. Each has been cross-referenced against curated lists, official bundled status, and the VirusTotal integration.

### Google Workspace: `gog` by steipete (official bundled skill)

This is the **single most important skill** for the workflow. Published by OpenClaw's creator Peter Steinberger, `gog` handles Google Drive file storage, Google Sheets updates, Gmail integration, and Google Docs editing — four of the user's six requirements in one package.

- **ClawHub URL**: https://clawhub.ai/steipete/gog
- **Installs**: 468 (highest among official skills)
- **VirusTotal status**: Bundled/official — ships with OpenClaw, scanned and auto-approved
- **Authentication**: Google OAuth 2.0 with tokens stored locally and encrypted
- **Capabilities for this workflow**: Save generated resumes/cover letters to Google Drive, append rows to a Google Sheets job tracker (company, role, date applied, status), read template documents from Google Docs, and send application confirmation emails via Gmail
- **Setup**: Requires a Google Cloud Console project with Gmail, Calendar, Drive, Sheets, and Docs APIs enabled

### Resume generation: `resume-builder` by amruthpillai

The only legitimate resume generation skill on ClawHub, published by the creator of the open-source Reactive Resume project.

- **GitHub source**: https://github.com/openclaw/skills/tree/main/skills/amruthpillai/resume-builder
- **Curated list status**: Listed in VoltAgent/awesome-openclaw-skills (2,999 curated skills from 5,705+)
- **VirusTotal status**: Published in the official `openclaw/skills` repository; no malicious indicators found in curated list audits
- **Output format**: Generates resumes conforming to the Reactive Resume JSON schema, which supports PDF export
- **Limitation**: Focused on resume structure/formatting rather than AI-powered tailoring to specific job descriptions — OpenClaw's native LLM capabilities handle the tailoring when you prompt the agent with a job description and your base resume

### PDF and document tools: `nano-pdf` (official bundled) and `excel` by dbhurley

For generating and manipulating documents:

- **`nano-pdf`** — Official bundled skill, **164 installs**. Edits PDFs with natural-language instructions via the nano-pdf CLI. Use it to create polished PDF versions of resumes and cover letters. ClawHub URL: https://clawhub.ai (bundled, available via `openclaw skills list`)
- **`PDF-2`** by seanphan — Comprehensive PDF toolkit for extracting text/tables, creating new PDFs, merging/splitting, and handling forms. Source: https://github.com/openclaw/skills/tree/main/skills/seanphan/pdf-2. Listed in VoltAgent curated list
- **`excel`** by dbhurley — **1,009 downloads**. Read, write, and format .xlsx files, export to CSV/JSON/Markdown. ClawHub URL: https://www.clawhub.com/dbhurley/excel. Useful for maintaining local job tracking spreadsheets as a backup to Google Sheets

### Notifications: `slack` (official bundled) + native Telegram

- **`slack`** — Official bundled skill by steipete. **116 installs**. Controls Slack messaging including sending notifications, reacting to messages, and managing channels. ClawHub URL: https://clawhub.ai/skills/slack. VirusTotal: auto-approved as bundled skill
- **Telegram** — Not a skill but a **built-in first-class channel** in OpenClaw's gateway. Telegram is the recommended messaging platform for OpenClaw, supporting direct DM interaction, proactive notifications via cron jobs, typing indicators, voice messages, and markdown rendering. No separate skill installation needed — configure via @BotFather
- **`openclaw-watchdog`** by abdullah4ai — Sends Telegram alerts for system monitoring. Available at https://openclawskills.org/skills/abdullah4ai--openclaw-watchdog. This demonstrates the Telegram notification pattern that can be adapted for job application alerts

---

## Browser automation fills the job board gap

No safe, dedicated skill exists for searching Indeed, LinkedIn, Built In, or other job boards. The `linkedin-job-application` skill by publisher "zaycv" is **confirmed malware** — it contains a base64-encoded command that downloads the Atomic macOS Stealer (AMOS) from the C2 server at IP `91.92.242.30`, the same infrastructure used in the ClawHavoc campaign that planted 341 malicious skills on ClawHub. **Do not install it under any circumstances.**

Instead, browser automation skills provide a safe foundation for job board scraping:

- **`Agent Browser`** by TheSethRose — **4,765 downloads** (highest among browser skills). A Rust-based headless browser automation CLI with Node.js fallback. Enables navigation, clicking, typing, and page snapshots. ClawHub URL: https://clawhub.ai/TheSethRose/agent-browser. Listed in both VoltAgent and sundial-org curated lists
- **`Browser Use`** by ShawnPana — **1,476 downloads**. Cloud browser API that spins up persistent browser sessions with saved logins/cookies. Useful for authenticated job board access. Listed in sundial-org curated list
- **`browse`** by pkiv — Stagehand-based browser automation with deployment functions. Source: https://github.com/openclaw/skills/tree/main/skills/pkiv/browse. Listed in VoltAgent curated list

With any of these skills, you'd prompt your OpenClaw agent to navigate to Indeed.com, LinkedIn Jobs, or Built In, enter search criteria, extract job listings, and fetch full descriptions. The agent's native LLM capabilities then parse the HTML/text and extract structured data. This approach uses only documented browser automation — no suspicious executables, no obfuscated code.

---

## Workflow orchestration ties everything together

To chain these skills into a coherent pipeline, several orchestration options exist:

- **`n8n`** by thomasansems — **573 downloads**. Manages n8n workflow automations via API. If you already use n8n, this skill lets OpenClaw trigger and monitor multi-step workflows. ClawHub URL: https://www.clawhub.com/thomasansems/n8n
- **`Flow`** by bvinci1-design — **68 downloads**. Compiles natural language requests into secure, reusable workflows. Think of it as a workflow compiler for skill chains
- **`Agent Orchestrator`** by aatmaan1 — **203 downloads**. Meta-agent that decomposes complex tasks into subtasks, spawns specialized sub-agents, and coordinates their execution
- **`clawlist`** by arisylafeta — Multi-step task manager designed for long-running workflows and monitoring. Source: https://github.com/openclaw/skills/tree/main/skills/arisylafeta/clawlist

The most practical approach for a job application pipeline: use **OpenClaw's native cron jobs** to schedule daily job searches, pipe results through the agent's LLM for tailoring resumes and cover letters, save outputs via `gog` to Google Drive/Sheets, and send notifications through the built-in Telegram channel or the `slack` skill.

---

## What you'll need to build safely from scratch

Three components of the requested workflow have **no safe existing skill** and would need custom SKILL.md files:

**Job board scraping logic** — While `Agent Browser` provides the browser automation layer, you'd write a SKILL.md that instructs the agent on how to navigate specific job boards (Indeed search URLs, Built In category pages, LinkedIn Jobs filters), what data to extract (title, company, location, salary range, description URL), and how to structure the output. This is a prompt engineering task, not a code execution task, making it inherently safer than installing a third-party scraper.

**Cover letter and screening question generation** — OpenClaw's native LLM handles this without any skill, since it's fundamentally a text generation task. Create a SKILL.md that defines your cover letter template, tone preferences, and screening question response strategy. Include your base resume and career context in the system prompt. The agent uses this context plus the fetched job description to generate tailored outputs.

**Job application tracker schema** — Define the Google Sheets structure (columns, formulas, conditional formatting rules) in a SKILL.md so `gog` can consistently update your tracker. No third-party skill needed.

---

## How to verify every skill before installation

Before installing any skill, run it through this **three-layer verification process**:

- **VirusTotal on ClawHub**: Every skill page on clawhub.ai now displays its VirusTotal scan verdict with a direct link to the full report. Look for "benign" status. Skills scanned after February 5, 2026 have undergone Code Insight behavioral analysis, not just hash matching
- **Bitdefender AI Skills Checker**: Free tool at https://www.bitdefender.com/en-us/consumer/ai-skills-checker — paste any ClawHub skill URL for an independent security assessment
- **Gen Agent Trust Hub**: Norton/Avast parent company Gen Digital offers a free scanner at https://ai.gendigital.com/agent-trust-hub that analyzes skills for hidden logic, unauthorized data access, and malicious behavior

Additionally, **always review the SKILL.md source code** on GitHub (https://github.com/openclaw/skills) before installing. The red flags to watch for are: any "prerequisites" requiring you to download executables, base64-encoded commands, curl commands fetching from IP addresses rather than domains, password-protected ZIP files, and instructions to disable security features.

## Conclusion

The recommended safe workflow stack is: **`gog`** (Google Drive + Sheets + Docs + Gmail), **`resume-builder`** (resume generation), **`nano-pdf`** + **`PDF-2`** (document creation), **`Agent Browser`** (job board navigation), **`slack`** (notifications), and **native Telegram** (primary notification channel). All are either official bundled skills or community-vetted with clean security records. The total cost of "reinventing the wheel" is limited to writing 2–3 custom SKILL.md prompt files for job board navigation patterns, cover letter templates, and tracker schemas — tasks that take hours, not days, and avoid the **17% malware rate** lurking in untrusted ClawHub skills. Prioritize the official `gog` skill as your foundation since it covers the most workflow requirements in a single, creator-maintained package.
