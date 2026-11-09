# Implementation and verification

Latest verification: 2026-11-09 (Asia/Seoul). Earlier release results are retained below.

The implementation now includes nine tools, responsive shadcn UI, themes, search, favorites, command palette, resizable desktop editors, anonymous clipboard API, D1 migrations, and deployment configuration. The original decisions and subsequent additions remain in [PLAN.md](PLAN.md).

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

Tests ran on Linux using the environment's installed browser executables. Missing Chromium runtime libraries were extracted into a temporary directory; no system packages were installed. The Playwright config supports `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `PLAYWRIGHT_FIREFOX_EXECUTABLE`, and `PLAYWRIGHT_BASE_URL` overrides. Later converter checks include Firefox; Safari/WebKit has not been verified. Production checks are recorded in the dated deployment notes below.

## Reproduce

Follow the setup instructions in [README.md](../README.md), then run:

```sh
pnpm check
pnpm db:migrate:local
pnpm exec playwright install chromium firefox
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

## File converter: 2026-11-09

Passed `pnpm check`: Biome, frontend/server/configuration TypeScript checks, 92 unit/integration tests across eleven files, and the production build. All 21 Chromium workflows passed together against the built application using `pnpm preview`. Desktop and mobile converter screenshots were inspected; a 390-pixel viewport had zero horizontal overflow.

Nine converter browser workflows verify genuine PNG/JPG/WebP download signatures, decoded dimensions and color pixels, white JPG backgrounds and preserved WebP transparency, selected PDF pages and DPI, actual ZIP entries, image order and dimensions in a readable generated PDF, missing/wrong/correct PDF passwords and password clearing, damaged or renamed files, duplicate filenames, outdated-result clearing, and cancellation followed by a fresh conversion. Requests recorded during PDF conversion remained GET requests on the application origin; file content was not uploaded. Fixtures contain generated images, PDFs, and a documented public test password.

New unit tests cover content signatures, bounded page-range expansion, input/output naming, filename sanitization, duplicate names, file limits, and canvas limits. Existing clipboard API and browser workflows passed alongside the converter. A development-server run had one clipboard timing failure during a simultaneous build; it passed in isolation and in the complete production-preview run.

`pnpm audit --prod` reported no known vulnerabilities, and Gitleaks found no secrets. PDF.js fonts, character maps, codecs, and licenses are included in static assets. PDF rendering and its worker are loaded on demand; Vite reports the PDF.js chunk's size above its default warning threshold. This release changes no database schema or API contract.

## Firefox image exports: 2026-11-09

The owner reported black PNG → JPG output on Windows with Firefox 159.0.1. Image conversion now fully decodes an HTML image, keeps its blob URL alive through encoding, and uses a software canvas with an opaque white background for JPG. A fixed four-color readback check stops conversion when browser canvas access is blocked or replaced; it does not classify user images as corrupt based on their colors.

Before the change, clean and Strict Firefox profiles preserved the sample's colors on Linux, while Resist Fingerprinting replaced exported pixels with unrelated values. The restricted profile now gets an actionable site-permission error and no download. Normal conversion is tested with an independently encoded PNG containing opaque red/green, half-transparent blue, and transparent regions; jpeg-js decodes the downloaded JPG outside the browser to check the actual colors.

Passed `pnpm check`, including all 92 unit/integration tests and the production build. The complete production-preview browser run passed 33 workflows: 22 Chromium and eleven Firefox 157 checks. The PNG → JPG color test and restricted-canvas permission test also passed with Firefox 159 on Linux using `PLAYWRIGHT_FIREFOX_EXECUTABLE`. Runtime dependency audit and Gitleaks found no issues.

The exact Windows 159.0.1/GPU-specific cause could not be directly reproduced in this Linux environment. Playwright remains pinned at 1.64.1: the newer bundled Firefox 159 stalled WebP downloads even on a minimal page outside the app, with both old and new drivers, while Firefox 157 passed. The two focused Firefox 159 checks above exclude WebP. Recheck this download behavior before upgrading the bundled browser; do not infer complete Firefox 159 compatibility from the focused checks.
