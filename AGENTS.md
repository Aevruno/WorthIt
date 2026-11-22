# Aevruno WorthIt Development Rules

## Product

WorthIt helps people compare options using criteria, importance weights, and scores they enter themselves, then explains the result and tradeoffs.

## General Rules

- Read this file before modifying code.
- Never work directly on `main`. Every task uses its own branch.
- Keep changes limited to assigned scope. Do not rewrite unrelated code.
- Do not silently change shared interfaces; explain and coordinate such changes.
- Never commit credentials or secrets.
- Run the build and tests before opening a PR.
- No AI-generated claim should be considered tested unless it was actually tested.

## Branch Naming

Use `feature/<feature-name>`, `fix/<bug-name>`, or `chore/<task-name>`.

## Shared Files

Protected/shared areas: `src/types/`, `src/state/`, `src/lib/scoring.ts`, `src/App.tsx`, `package.json`, `vite.config.*`, and `.github/`. Feature agents should explain why changes to these areas are needed before modifying them.

## Current Feature Ownership

- `src/features/comparison/`: comparison flow.
- `src/features/results/`: results and decision explanation.
- `src/features/saved/`: saved comparisons and sharing.

## Pull Request Rules

Every meaningful change goes through a pull request. PRs contain a summary, important files changed, checks run, known limitations, and screenshots for major UI changes when practical. No developer or AI agent merges its own PR.

## Claude Review Protocol

Claude must inspect the full PR diff and current head commit. If blocking problems exist, do **not** use the approval marker; clearly explain what must be fixed. If the PR is genuinely ready to merge, leave this exact structure:

```text
AEVRUNO_APPROVED

Reviewer: Claude
Status: Approved for merge
Head SHA: <CURRENT PR HEAD SHA>

Checks:
- Scope reviewed
- No blocking issues found
- Build/tests checked where available
- Ready for merge
```

Approval applies only to the listed HEAD SHA. Any new commit makes it stale and requires another review. Never use `AEVRUNO_APPROVED` unless the PR is actually ready to merge.

## ChatGPT Merge Protocol

Developer or agent → feature branch → PR → Claude review → `AEVRUNO_APPROVED` with exact HEAD SHA → ChatGPT verifies the current HEAD SHA matches, no newer blocking review exists, CI passes, and required conversations are resolved → human authorizes merge → ChatGPT merges the exact reviewed commit. Prefer squash merge for feature PRs unless the team specifies otherwise.
