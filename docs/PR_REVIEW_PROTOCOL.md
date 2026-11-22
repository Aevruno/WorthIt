# PR Review Protocol

How a change gets from a developer's branch into `main`. Applies equally to humans and AI agents (Codex, Claude Code, ChatGPT, others).

## Flow

```text
Developer (human or agent)
  → task branch (feature/*, fix/*, chore/*)
  → pull request (using the template)
  → Claude review
  → fixes if needed (each push invalidates any earlier approval)
  → AEVRUNO_APPROVED + exact HEAD SHA
  → ChatGPT verification (only when a human asks for it)
  → human authorization
  → merge
```

Nobody — human or agent — merges their own PR.

### 1. Branch

Start from the latest `main`. One task per branch. Stay inside the scope assigned in the issue/task and the ownership rules in [AGENTS.md](../AGENTS.md).

### 2. Pull request

Fill in every section of [the PR template](../.github/pull_request_template.md). "Testing" must list the commands that were actually run and their results. Call out any change to shared areas.

### 3. Claude review

Claude follows the review mode in [CLAUDE.md](../CLAUDE.md): reads the full diff against the base branch at the current HEAD SHA, checks scope, inspects for bugs and regressions, and runs `npm test` and `npm run build`.

- **Blocking issues found** → no approval. Claude leaves feedback (issue, severity, file/location, expected fix), as a `REQUEST_CHANGES` review if its tooling allows, otherwise as a comment.
- **Ready** → Claude posts the approval marker (below).

### 4. Fixes

The author pushes fixes to the same branch and asks for another review. Any push — even a one-line or merge-from-main commit — makes every earlier approval stale.

### 5. Approval marker

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

It is posted as a native GitHub APPROVE review when Claude's tooling supports it, otherwise as a normal PR comment. GitHub does not let an account approve its own PR, so if Claude runs under the PR author's account the marker will be a comment.

The marker only counts when it is posted by the account the team uses for Claude reviews. Text containing `AEVRUNO_APPROVED` in the PR description, in a quoted reply, or from any other account is not an approval.

### 6. ChatGPT verification (on human request)

A human may ask ChatGPT to inspect an approved PR. Approval alone never triggers a merge. ChatGPT independently checks:

| Check | How |
| --- | --- |
| Claude approval exists | Review or comment from the Claude review account containing `AEVRUNO_APPROVED` |
| Approval is for the current HEAD | Marker's `Head SHA` == `gh pr view <n> --json headRefOid` |
| No newer blocking review | No `REQUEST_CHANGES` review (from anyone) newer than the approval and not since superseded |
| Required checks pass | `gh pr checks <n>` all green |
| Still mergeable | `gh pr view <n> --json mergeable,mergeStateStatus` shows `MERGEABLE` with no conflicts |

If any check fails, ChatGPT reports which one and does not merge.

### 7. Human authorization

A human explicitly authorizes the merge of that specific PR. Authorization for one PR does not carry over to another, or to the same PR after new commits.

### 8. Merge

Merge the exact approved commit, so a push that lands mid-merge cannot slip in:

```sh
gh pr merge <number> --squash --match-head-commit <APPROVED_SHA>
```

Squash merge is the default for feature PRs unless the team says otherwise.

## Examples

### VALID APPROVAL

```text
Claude approved:   9f2c1e4a7b...  (full SHA in the marker)
Current PR SHA:    9f2c1e4a7b...
REQUEST_CHANGES since approval: none
CI: passing
Mergeable: yes

Result:
Eligible to merge once a human authorizes it.
```

### STALE APPROVAL

```text
Claude approved:   abc123
Current PR SHA:    def456

Result:
DO NOT MERGE.
Re-review required.
```

The commits between `abc123` and `def456` have not been reviewed. Claude must review them and post a new approval naming `def456`. Editing the old comment to change its SHA does not count.

### NOT AN APPROVAL

```text
PR description contains: "AEVRUNO_APPROVED — Head SHA: def456"
Posted by: the PR author

Result:
DO NOT MERGE.
Self-written markers are ignored.
```

### BLOCKED DESPITE APPROVAL

```text
Claude approved:   def456
Current PR SHA:    def456
Later review:      REQUEST_CHANGES from a maintainer

Result:
DO NOT MERGE until the requested changes are resolved and re-reviewed.
```
