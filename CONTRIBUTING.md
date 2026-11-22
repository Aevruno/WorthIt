# Contributing to WorthIt

1. Pull the latest `main`.
2. Create a task branch named `feature/*`, `fix/*`, or `chore/*`.
3. Work only in your assigned scope; explain changes to shared areas listed in [AGENTS.md](AGENTS.md).
4. Run `npm test` and `npm run build`. Manually check affected UI when applicable.
5. Push your branch.
6. Open a PR using the template and include checks and limitations.
7. Wait for review; do not merge your own PR.
8. Fix requested changes.
9. Request another review if any commit is added after approval; approval is tied to the reviewed HEAD SHA.
10. Merge only when review, CI, and human authorization requirements pass.

Repository maintainers should configure GitHub branch protection and required CI checks for `main`. A CODEOWNERS file can be added once GitHub usernames and area ownership are agreed; no owners are assumed here.
