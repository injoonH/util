# Repository workflow

## Git and GitHub

- Use the `gh` CLI for GitHub operations.
- Sign local commits using the existing GPG configuration and signing key.
- Commit titles and PR titles must start with a capital letter and contain at most 50 characters.
- Assign every new PR to `injoonH`, the user's GitHub account. Use `gh pr create --assignee injoonH`; `--assignee @me` is equivalent when authenticated as that account.
- Use squash merges by default to maintain linear history: `gh pr merge <PR> --squash`.
- Ensure the final squash commit title also meets the title rule. Set `--subject` explicitly when needed to avoid an automatic PR-number suffix exceeding the limit.

## Project tooling

- Use pnpm and the Node version pinned in `.node-version`, managed through fnm.
- Use Biome and EditorConfig for formatting and linting.
- Follow the shared decisions in `docs/PLAN.md` and the deployment instructions in `docs/DEPLOYMENT.md`.
