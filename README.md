# Utility workbench

A collection of nine everyday tools: instant clipboard sharing, Markdown preview, Base64, JSON formatting, URL utilities, text cleanup, file conversion, UUID generation, and timestamp conversion.

The conversion and preview tools run in the browser. Clipboard sharing uses a small Cloudflare Worker API and temporary D1 storage so text can move between devices without an account.

Live service: [util.yuwol.dev](https://util.yuwol.dev).

The agreed scope, architecture, hosting choice, and deferred ideas are recorded in [docs/PLAN.md](docs/PLAN.md). Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to publish updates to the owner's Cloudflare account. The production D1 database and custom domain are configured in `wrangler.jsonc`.

## Run locally

Completed checks and browser coverage are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).

Use [fnm](https://github.com/Schniz/fnm) for Node versions. This repository pins Node **24.22.1** in `.node-version` and pnpm **12.15.0** in `package.json`.

From the repository root:

```sh
fnm install
fnm use
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Open the local URL printed by Vite. The development server uses the Cloudflare Vite plugin to run the frontend, Worker API, and local D1 together. Local database state lives under ignored `.wrangler/` storage; it is separate from the production database. Cloudflare login is not needed for local tools or local clipboard testing.

If `fnm` is installed but has not initialized your shell, add its shell integration. For zsh, the project's original shell:

```sh
eval "$(fnm env --use-on-cd --shell zsh)"
```

Put that line in your zsh startup configuration to enable automatic version switching. `corepack enable` creates package-manager shims for the selected Node installation. If `pnpm` is missing, run the enable/install steps after `fnm use`. If shims cannot be created in your environment, `corepack pnpm <command>` runs the pinned pnpm directly. On Node installations without Corepack, install Corepack first using its [official instructions](https://github.com/nodejs/corepack#how-to-install).

## Commands

| Command                  | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `pnpm dev`               | Run Vite and the local Worker/D1 runtime                                |
| `pnpm build`             | Build static assets and the Worker                                      |
| `pnpm preview`           | Preview the production build locally                                    |
| `pnpm format`            | Apply Biome formatting                                                  |
| `pnpm lint`              | Check formatting, lint rules, and import organization                   |
| `pnpm lint:fix`          | Apply safe Biome fixes                                                  |
| `pnpm typecheck`         | Check frontend, server, tests, and configuration types                  |
| `pnpm test`              | Run unit tests and real local D1 integration tests                      |
| `pnpm test:watch`        | Run Vitest in watch mode                                                |
| `pnpm test:e2e`          | Run Playwright browser tests                                            |
| `pnpm check`             | Run lint, type checking, unit/integration tests, and a production build |
| `pnpm db:generate`       | Generate a migration after changing the Drizzle schema                  |
| `pnpm db:migrate:local`  | Apply pending migrations to local D1                                    |
| `pnpm db:migrate:remote` | Apply pending migrations to the configured production D1 database       |
| `pnpm run deploy`        | Build and deploy the Worker and static assets                           |

Use the explicit `run` in `pnpm run deploy`: pnpm also has an unrelated built-in `deploy` command for packaging workspace dependencies.

Install Playwright's Chromium browser before running browser tests:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` does not include the browser suite; run both before publishing. Miniflare, Vite, and Playwright need local loopback sockets. In a restricted coding sandbox, an `EPERM` error when binding `127.0.0.1` means the test runner needs permission to run outside that network sandbox. The D1 integration tests use a disposable database and do not contact the production service.

## Code layout

| Path                      | Responsibility                                                            |
| ------------------------- | ------------------------------------------------------------------------- |
| `src/app/`                | Router, application shell, themes, favorites, and recent-tool preferences |
| `src/components/ui/`      | Generated shadcn/ui primitives                                            |
| `src/components/tools/`   | Reusable tool panels, copy, download, and editor helpers                  |
| `src/features/catalog/`   | Tool metadata, lazy imports, search, and catalog UI                       |
| `src/features/<tool>/`    | Tool interface, transformation functions, and colocated tests             |
| `src/lib/`, `src/styles/` | Shared browser helpers and visual tokens                                  |
| `server/clipboard/`       | Clipboard routes, service logic, and repository                           |
| `server/db/`              | D1 connection and Drizzle schema                                          |
| `server/middleware/`      | Request-size validation and rate limiting                                 |
| `shared/`                 | Browser/server API types and Zod schemas                                  |
| `migrations/`             | SQL migrations and Drizzle metadata                                       |
| `tests/integration/`      | API tests against Miniflare's real D1 implementation                      |
| `tests/e2e/`              | Critical browser workflows                                                |
| `public/`                 | Static assets and static response headers                                 |

The frontend is React, TypeScript, React Router, Tailwind, and shadcn/ui. Hono handles `/api/*`; Drizzle accesses D1. Keep server imports out of browser code. Frontend aliases are `@/` for `src/` and `@shared/` for `shared/`.

### Add a tool

1. Add `src/features/<tool-id>/` with a default-exported React tool component. Keep transformation functions separate from React so edge cases can be tested directly.
2. Reuse shadcn primitives from `src/components/ui/` and the shared tool panels/actions. Provide labels, keyboard access, useful errors, and mobile layouts.
3. Add a metadata entry and lazy import to `src/features/catalog/registry.ts`. The registry drives the catalog, navigation, search, favorites, and `/tools/:toolId` route. Keep the ID stable because preferences store it.
4. Add focused `<name>.test.ts` tests alongside transformation code. Add browser or API tests when the feature introduces a meaningful workflow or server boundary.
5. Run `pnpm check` and relevant browser tests. Update [the plan](docs/PLAN.md) when adding scope or changing a decision.

Keep expensive operations in the browser, and load tool-specific dependencies only when needed. Browser tool inputs are transient. Themes, favorites, and recent tool IDs may be saved in `localStorage`; clipboard deletion receipts use `sessionStorage` for the sender's tab when browser storage is available. An in-memory receipt store also preserves receipts across SPA navigation. Clipboard content is not included in those receipts.

### Change the database

Edit `server/db/schema.ts`, then run:

```sh
pnpm db:generate
pnpm db:migrate:local
pnpm test
```

Review and commit the new SQL and `migrations/meta/` files together. Add a new migration for changes to an already-applied schema. Local migration success does not apply that migration in production; the deployment guide describes that separate step.

## File converter

Open [File converter](https://util.yuwol.dev/tools/file-converter) to convert images or export PDF pages. Files, previews, and PDF passwords stay in memory in your browser; they are never uploaded or saved in browser storage.

| Input                          | Output                                  |
| ------------------------------ | --------------------------------------- |
| JPG, PNG, WebP, GIF, BMP, AVIF | PNG, JPG, WebP, or one combined PDF     |
| PDF                            | One PNG, JPG, or WebP per selected page |

Image decoding depends on browser support. Animated images export a still image. JPG uses a white background for transparent areas. Images keep their dimensions; PDF pages offer 72, 144 (default), or 216 DPI, page ranges such as `1, 3-5`, and an optional document password. PDF output puts images on separate pages in source order; it does not merge existing PDFs.

Select up to 10 files, at most 25 MiB each and 50 MiB combined. Output is bounded to 100 files and 100 MiB, with a 16 megapixel / 8,192 pixel-per-side canvas limit. Lower PDF resolution or choose fewer pages when a document exceeds these limits. Download files individually or together as a ZIP; duplicate names are made unique. Cancel keeps completed files available, and changing inputs or settings clears outdated results.

Conversion uses browser canvas, PDF.js, pdf-lib, and fflate, loaded on demand. The PDF worker, fonts, character maps, codecs, and their licenses are served from this site's static assets. `pnpm dev` and `pnpm build` automatically copy the PDF support assets into the ignored `public/pdfjs/` directory using `scripts/prepare-pdf-assets.mjs`. Run those scripts rather than invoking Vite directly.

## Clipboard behavior

Shares accept up to **64 KiB of UTF-8 text**, expire after 10 minutes, one hour, or 24 hours, and default to one hour. The API generates random 192-bit link tokens, optional **six-character typing codes** grouped as `ABC-234`, and separate deletion tokens. Codes ignore letter case, spaces, and hyphens. Existing 12-character codes remain valid until expiry.

Enable **Protect with a password** before creating a share to require that password for both link and code access. The UI requires at least eight characters; passwords are case-sensitive and should be shared separately. Passwords are not added to links or browser storage. The browser derives a key using PBKDF2-SHA256 with a random salt and 600,000 iterations; the API stores only a SHA-256 verifier of the derived key. Shared text itself is stored as plain text in D1: password protection is access control, **not end-to-end encryption**.

Anyone with an unprotected share's link or code can retrieve its text before expiry. Links place the credential after `#`, and the frontend sends credentials in JSON request bodies. API responses use `Cache-Control: no-store`; shared content and credentials are not logged by the application. Five incorrect password attempts within a minute temporarily block password access to that share until the window ends, across both links and codes.

Each read checks expiry. Hourly cleanup removes up to 500 expired rows per run; an expired share becomes inaccessible before its row is cleaned up. Sender deletion removes the live row early. Neither operation promises immediate removal from provider backups. All unexpired sender receipts are retained in a session store backed by `sessionStorage` when available. If browser storage is blocked, receipts survive SPA navigation in memory but are lost on reload. Losing a receipt loses early-deletion access; the share still expires normally.

The API caps stored shares at 4,096 rows, including expired rows awaiting cleanup. Native Cloudflare rate limits are configured for 10 create requests and 30 retrieve/delete requests per minute per client IP and Cloudflare location. These limits are approximate; they are not a strict global quota. Missing rate-limit bindings make sharing unavailable rather than bypassing the limits.

See [deployment and operations](docs/DEPLOYMENT.md) for free-tier limits, cleanup, API endpoints, and production setup.
