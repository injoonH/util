# Implementation and verification

Latest verification: 2026-11-09 (Asia/Seoul). Earlier release results are retained below.

The first-release implementation is complete in this checkout: eight tools, responsive shadcn UI, themes, search, favorites, command palette, resizable desktop editors, anonymous clipboard API, D1 migrations, and deployment configuration. The original decisions remain in [PLAN.md](PLAN.md).

## Initial release checks: 2026-10-28

- Biome formatting, recommended lint rules, and import checks passed.
- Frontend, server, and configuration TypeScript checks passed.
- 67 unit/integration tests passed across nine test files. The API tests use an actual local D1 database through Miniflare, including expiry, deletion, hashed credentials, malformed requests, Unicode byte limits, rate limits, and concurrent storage-cap enforcement.
- All 11 Chromium browser tests passed together against a freshly optimized development server. Tests fail on unexpected page or console errors.
- Desktop and mobile screenshots were inspected. Mobile navigation reached every tool without horizontal page overflow. Browser checks recorded no uncaught page errors.
- Dark theme selection survived a reload. Editor input survived switching between resizable desktop and stacked mobile layouts.
- The final production build passed, producing static assets under `dist/client` and a Worker under `dist/utility_workbench`.
- The deployment guard correctly refused the placeholder database ID before building or uploading.
- A development dependency-reload issue was resolved by prebundling the tool libraries, deduplicating React, and excluding browser-test reports from Vite's file watcher. The final browser suite passed with console-error assertions enabled.

## Browser coverage

The browser suite covers catalog search/favorite persistence, command palette navigation, Unicode Base64 round trips and invalid-input output clearing, JSON numeric precision, Markdown safe rendering, clipboard sharing between separate browser contexts by link and code, deletion invalidation, skip navigation preserving share fragments, cancellation of pending retrieval, receipt persistence when creation finishes after navigation, keyboard panel resizing, and mobile navigation/layout.

Tests ran on Linux using the environment's installed Chromium executable. Its missing runtime libraries were extracted into a temporary directory; no system packages were installed. The Playwright config supports `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_BASE_URL` overrides. Firefox, Safari/WebKit, and a live Cloudflare deployment have not been verified.

## Reproduce

Follow the setup instructions in [README.md](../README.md), then run:

```sh
pnpm check
pnpm db:migrate:local
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser suite can start its own local development server. Integration and browser tests need loopback sockets. Restricted environments may require permission to run the local emulators.

## Deployment handoff

Since the initial verification, the owner supplied the production D1 ID and the existing `DB` binding was updated; a duplicate auto-generated binding was removed. The deployment guard and production build passed with that configuration. See [DEPLOYMENT.md](DEPLOYMENT.md) for future releases. Use `pnpm run deploy`; `pnpm deploy` is pnpm's separate workspace-packaging command.

## Production domain verification: 2026-10-29

Attached [https://util.yuwol.dev](https://util.yuwol.dev) to Worker `utility-workbench` through its tracked custom-domain route. Deployment version: `5202344a-2a72-4e8d-84d7-96c7a21a97da`. The existing workers.dev endpoint remains enabled. No database migrations were pending.

The source configuration passed Biome, the deployment guard, and a production build. Cloudflare confirmed the domain attachment and deployment. HTTPS requests to the homepage and `/tools/base64` returned the application with status 200. A temporary Unicode clipboard share was created, retrieved by token and code, deleted, and confirmed unavailable afterward. The retrieval response used `Cache-Control: no-store`. The temporary test share was deleted.

## Clipboard passwords and short codes: 2026-11-09

Deployment version: `19398713-8d31-4031-9a5e-aa73902d6d1f` at [https://util.yuwol.dev](https://util.yuwol.dev). Migration `0001_clipboard_passwords.sql` was applied locally and to production before publishing.

Passed Biome, frontend/server/configuration TypeScript checks, 74 unit/integration tests in ten files, all 12 Chromium browser workflows, and the production build. Drizzle reported no remaining schema changes. New tests cover password derivation against an independent PBKDF2 reference, missing/wrong/correct keys for both credentials, no plaintext/password-key persistence, per-share failed-attempt limits and recovery, six-character code generation/collision retries, and legacy 12-character code compatibility. Desktop and mobile password controls were inspected with zero horizontal page overflow.

Production HTTPS verification created protected and unprotected temporary shares. Both token and code access required the protected share's password, rejected wrong keys, and returned the original Unicode text with the right key. Generated codes contained six characters. Unprotected shares remained accessible without a password. All temporary test shares were deleted, and subsequent retrieval returned status 404. Protected retrieval used `Cache-Control: no-store`.
