# Claude Code Workflow Guide

## The Golden Rules
1. One task per session. /clear between unrelated work.
2. Planning before coding delivers 2-3x better results.
3. Fresh context beats deep context — restart rather than correct.

## Explore -> Plan -> Code -> Test (EPCT)
Enter Plan Mode (Shift+Tab twice) for read-only analysis. Iterate the plan
until solid. Only then switch to normal mode for implementation.
If Claude starts coding during planning, press Escape.

## Token Management
- /compact at ~60% context with focus instructions:
  "/compact Focus on the API changes, discard debugging attempts"
- /clear aggressively — deep conversations cost 10-15x more per message
- Use @file:startLine-endLine for targeted reads, not whole files
- Check overhead with /context anytime

## Document & Clear Pattern (for complex multi-step tasks)
1. Have Claude write its plan and progress to a markdown file
2. Run /clear
3. Start a fresh session pointing to that file
Clean 200K context focused on execution, not polluted with exploration.

## Model Matching
- Haiku: quick questions, syntax checks, simple edits (2x faster, 1/3 cost)
- Sonnet: 80% of tasks — implementations, refactoring, reviews
- Opus: architecture, multi-step planning, security, hard debugging
- Switch with /model or Cmd+P mid-session

## Extended Thinking
- "think hard" — ~10K thinking tokens for moderate problems
- "megathink" — ~16K for architecture decisions
- "ultrathink" — ~32K for system redesigns
- Lower MAX_THINKING_TOKENS=8000 for routine tasks

## Subagent Delegation
80-90% of tokens often go to exploration, not coding.
Say "Use a subagent to investigate X" — it explores in its own 200K context
and returns only a summary (~1-2K tokens) to your main session.

## Mission Control Specific Tips

### Database Work
SQLite schema lives in `src/lib/db/schema.ts` with migrations in `migrations.ts`.
Always test schema changes with `npm run db:reset` in a fresh environment.
Never modify the production .db file directly.

### API Routes
All routes follow the pattern in `src/app/api/`. Validation schemas are in
`src/lib/validation.ts`. Add Zod schemas for new endpoints before implementation.

### Real-time Features
SSE broadcaster in `src/lib/events.ts`. Test with the SSEDebugPanel component.
WebSocket client for OpenClaw in `src/lib/openclaw/client.ts` — has exponential
backoff reconnect built in.

### Security Changes
This project has production security hardening. Before modifying auth, webhooks,
or file handling: read `src/middleware.ts` and the relevant API route completely.
Run `/security-audit` after changes.

## Anti-Patterns to Avoid
- Correction spiral: after 2 failed fixes, /clear and rewrite the prompt
- Sessions that never end: use Document & Clear, not endless conversation
- Auto-formatting hooks: run formatting manually between sessions
- Accepting without reviewing: always check diffs for edge cases
- Review EVERY diff before committing — Claude misses edge cases silently

## Interview Technique (for ambiguous features)
"Interview me about [feature]. Ask about implementation, UI/UX, edge cases,
and tradeoffs. Don't ask obvious questions. Keep going until we've covered
everything, then write a spec to SPEC.md."
Then /clear and implement from the spec.

## Two-Conversation Pattern
First conversation: explore which files need editing, understand the problem.
Second conversation (fresh /clear): execute with laser focus.
"Context is like milk — best served fresh and condensed."

## Three-File Checkpoint Pattern (for complex features)
~/dev/active/[task-name]/
  task-plan.md       — The accepted plan with approach decisions
  task-context.md    — Key files, architectural constraints, decisions made
  task-checklist.md  — Step-by-step implementation checklist
Write during planning, /clear, then implement one checklist item per session.

## Git Worktrees (parallel development)
git worktree add ../mission-control-auth -b feature/auth-refactor
git worktree add ../mission-control-api -b feature/api-v2
Run separate Claude instances per worktree — each gets its own context.
Press Ctrl+B to background long operations.

## Rate Limits
- Sonnet for 80%+ of work (Opus burns quota ~5x faster)
- Track with /cost (session) and ccusage (daily breakdowns)
- Schedule intensive work near the start of a 5-hour window
- Claude Code and claude.ai share the same quota
- Enable "Extra Usage" in settings as overflow protection

## Headless Mode (for automation)
claude -p "prompt" --output-format json
claude -p "continue" --continue
Returns structured data with cost, duration, turns — ideal for pipelines.
