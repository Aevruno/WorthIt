# Claude Code Instructions — WorthIt

These rules apply whenever Claude Code works in this repository. They add to [AGENTS.md](AGENTS.md); if the two ever disagree, stop and report the conflict instead of picking one.

Full review/merge flow: [docs/PR_REVIEW_PROTOCOL.md](docs/PR_REVIEW_PROTOCOL.md).

## Before modifying anything

1. Read [AGENTS.md](AGENTS.md).
2. Read the assigned GitHub Issue / PR / task.
3. Check the current branch (`git branch --show-current`). If it is `main`, stop and create or switch to the assigned task branch.
4. Confirm the assigned file/folder scope. If the task does not state one, ask before editing.
5. Inspect existing code before writing replacements. Extend what exists; do not rewrite it from scratch.

## Claude must NEVER

- work directly on `main`
- merge its own changes (or any PR, unless a human explicitly authorizes that specific merge)
- silently rewrite shared architecture
- change unrelated files
- change shared interfaces (`src/types/`, `src/state/`, `src/lib/scoring.ts`, and the other shared areas in AGENTS.md) without reporting the need first
- claim tests or builds passed unless they were actually executed in this session, against the current code
- use `AEVRUNO_APPROVED` casually — not in examples posted to PRs, not "conditionally", not for a SHA it did not review

## Commands

```sh
npm ci          # install from lockfile (what CI uses)
npm test        # vitest run
npm run build   # tsc -b && vite build (type-checks, then builds)
```

There is no lint script configured. Do not report lint as "passing".

## Implementation mode

**Before coding**

- State which files are expected to change.
- Identify any shared dependencies (types, state, scoring, `App.tsx`, `package.json`, CI). If a shared change is needed, report it and wait for confirmation before making it.

**After coding**

- Run relevant tests (`npm test`).
- Run the build (`npm run build`).
- Summarize the changes, file by file.
- Identify unverified behavior (e.g. UI not checked in a browser, mobile layout not checked, storage errors not exercised).
- Commit to the assigned feature branch only.
- Open a PR (using the template) only if requested. Never merge it.

## PR review mode

When instructed to review a pull request:

1. Fetch the latest PR branch: `gh pr checkout <number>` then `git pull`.
2. Determine the current PR HEAD SHA: `gh pr view <number> --json headRefOid,baseRefName`. Record the full 40-character SHA.
3. Read the full diff against the PR's base branch (usually `main`): `git fetch origin <base>` then `git diff origin/<base>...HEAD`. Read all of it, not only the summary.
4. Read AGENTS.md and the PR's assigned scope (PR body, linked issue).
5. Check for unintended edits outside that scope, including shared files, `package-lock.json`, and CI.
6. Inspect for:
   - logic bugs
   - regressions
   - broken state behavior (localStorage reads/writes, stale or lost data)
   - unsafe assumptions
   - TypeScript issues (`any`, unchecked casts, non-null assertions hiding real nulls)
   - accessibility problems for UI changes (labels, keyboard use, focus, contrast, semantics)
   - mobile/responsive problems where relevant
   - dead controls (buttons/links that do nothing)
   - hardcoded fake data presented as real (prices, ratings, reviews, "recommended" claims)
   - unnecessary dependencies
   - security/privacy problems (secrets, unsafe HTML, data sent off-device)
7. Run available automated checks (there is no lint script today).
8. Run `npm run build`.
9. Run `npm test`.
10. Check CI status if GitHub access allows: `gh pr checks <number>`.

Report exactly which of steps 7–10 were run and their real results. If a step could not be run, say so; do not imply it passed.

### If blocking issues exist

**Do not approve.** Leave feedback where each item states:

- **Issue** — what is wrong
- **Severity** — `blocking` (must fix before merge), `non-blocking` (should fix, can follow up), or `nit`
- **File/location** — `path/to/file.ts:line`
- **Expected fix** — what a correct change looks like

If GitHub tooling allows it, submit this as a `REQUEST_CHANGES` review; otherwise post it as a PR comment and say it was a comment.

## Approval format

**Only** if the PR is genuinely ready to merge, leave this exact marker:

```text
AEVRUNO_APPROVED

Reviewer: Claude
Status: Approved for merge
Head SHA: <CURRENT EXACT HEAD SHA>

Checks:
- Scope reviewed
- No blocking issues found
- Build/tests checked where available
- Ready for merge
```

Rules:

- Use the full 40-character SHA that you actually reviewed.
- Immediately before posting, re-run `gh pr view <number> --json headRefOid`. If the SHA changed during your review, do not post — review the new commits first.
- Approval applies **only** to that HEAD SHA. If any commit is pushed afterward, the approval is stale immediately.
- On a new commit, re-review the diff (at minimum everything since the approved SHA, plus its interaction with the rest of the PR) and post a **new** approval containing the **new** HEAD SHA.
- Never reuse, edit, or copy forward an old approval.
- Below the marker you may add a short list of what was run (e.g. `npm test: 9 passed`, `npm run build: ok`, `CI: green`) and any non-blocking notes.

## GitHub approval vs comment

- If the GitHub tooling can submit a native **APPROVE** review, use it **and** put the `AEVRUNO_APPROVED` marker in the review body.
- If native APPROVE is unavailable, post the marker as a normal PR comment.
- GitHub does not allow an account to approve its own PR. If `gh` is authenticated as the PR author, native APPROVE will fail — post a comment instead.
- Never claim a native approval was submitted if it was not. In your report, say which one you did.

## ChatGPT handoff

After a Claude approval, a human **may** instruct ChatGPT to inspect the PR. Approval does not trigger any merge by itself. ChatGPT independently verifies that:

- a Claude approval exists
- the approval's Head SHA equals the PR's current HEAD SHA
- no newer `REQUEST_CHANGES` review exists
- required checks pass
- the PR is still mergeable

ChatGPT merges only after explicit human authorization for that PR. Claude must never describe the process as ChatGPT automatically merging approved PRs.
