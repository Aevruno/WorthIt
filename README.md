# WorthIt

WorthIt helps people compare products or choices using the criteria they personally care about. It turns user-entered priorities and scores into an explainable result.

## MVP

The first version will let people create a comparison, add 2–5 options, define decision criteria, assign importance, and score each option. It will calculate an explainable winner, show tradeoffs, save comparisons locally, and support sharing or exporting results where available. The current app is a foundation, not the complete MVP.

## Technology

React, TypeScript, Vite, Vitest, browser localStorage, and plain CSS. There is no backend or account system.

## Development

Use Node.js 24 or later and npm.

```sh
npm install
npm run dev
npm run build
npm test
```

CI uses `npm ci` with the committed lockfile. The localStorage adapter and scoring engine are ready for feature work; the UI currently displays placeholders.

## Collaboration

Treat `main` as protected. Create a task branch and submit meaningful work through a pull request. Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) before changing code (Claude Code also reads [CLAUDE.md](CLAUDE.md)). PRs are reviewed before merging. Claude may mark a reviewed head commit `AEVRUNO_APPROVED`; ChatGPT may perform final verification and merge only after explicit human authorization. No developer or agent merges its own PR. See [docs/PR_REVIEW_PROTOCOL.md](docs/PR_REVIEW_PROTOCOL.md).
