# Mission Control

AI Agent Orchestration Dashboard — manage distributed AI agents via a web-based control center.

## Stack

- Next.js 14, React 18, TypeScript 5.7
- Tailwind CSS 3.4, SQLite 3, Zustand 5.0, Zod 4.3

## Coding Standards

- **TypeScript**: Strict mode, explicit return types on exports, FC<Props> pattern for components
- **API routes**: Consistent `{ data }` / `{ error }` responses, Zod validation on all inputs
- **Styling**: Tailwind utility classes, no inline styles, responsive-first
- **Accessibility**: Semantic HTML, ARIA roles where needed, keyboard navigable
- **Error handling**: Standardized HTTP status codes, never leak internal details in responses

## Workflow

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Feature branches off `main`
- Run `npm run lint && npm run build` before committing
- Update CHANGELOG.md for user-facing changes

## Constraints

- SQLite only (no ORM, raw SQL via better-sqlite3)
- SSE for browser push, WebSocket for OpenClaw Gateway only
- Bearer token auth (`MC_API_TOKEN`), same-origin exempt
- Never commit .env, .db, or .pem files
- File paths must be validated against allowed directories
