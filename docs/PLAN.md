# Utility workbench: agreed plan

Decision date: 2026-10-25 (Asia/Seoul).

## Purpose and agreed constraints

Build a collection of useful, fast browser tools. No user accounts. All conversion and preview tools process content in the browser. “Instant clipboard” means sharing text between devices using a link or code, so it has a small server-side exception. Hosting must have no additional subscription cost. The owner already has Cloudflare, public domains, GitHub/Vercel, and a Docker host behind nginx.

Use pnpm, fnm, Biome, EditorConfig, React/TypeScript, and shadcn/ui wherever suitable. Pin Node 24.22.1 in `.node-version` (updated from the initial 24.22.0 pin on 2026-10-27); pin pnpm in `package.json` and commit its lockfile. Use the connected shadcn MCP and official generated components. Keep one package in this repository.

## Hosting decision

Target the owner's Cloudflare account directly: Workers Static Assets for the Vite frontend, a Hono Worker API for clipboard sharing, and D1 for temporary records. Browser tool routes should be served as static assets; only `/api/*` invokes the Worker. Use an existing domain after deployment is configured. GitHub holds the source and can run CI. No Sites-managed hosting is required for this deployment target.

Free-plan allowances checked on the decision date: static asset requests are free and unlimited; Workers provides 100,000 requests/day and 10 ms CPU/invocation; D1 provides 5 million rows read/day, 100,000 rows written/day, 500 MB/database and 5 GB/account. Quotas are shared with other usage on the account. Exceeding free quotas can interrupt clipboard sharing. Keep paid products disabled; this is not an unlimited-capacity promise.

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

The fallback is a Node API and SQLite volume on the existing Docker/nginx server. Keep database access behind a repository boundary to make that migration possible; a second runtime is not needed in the initial implementation. Vercel Hobby requires personal/non-commercial use. GitHub Pages alone cannot run the clipboard API.

## First release

| Tool              | Scope                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| Instant clipboard | Anonymous text sharing by link/code, expiry, early sender deletion            |
| Markdown preview  | Live split preview, GFM tables/task lists, code highlighting, import/download |
| Base64            | UTF-8 encoding/decoding, Base64URL, validation                                |
| JSON              | Format/minify/validate with error locations and preserved number precision    |
| URL               | Component encoding/decoding and URL/query inspection                          |
| Text              | Case conversion, word/character counts, trim, sort, deduplicate               |
| UUID              | Single/batch generation, copy/download                                        |
| Timestamp         | Unix seconds/milliseconds, readable dates, explicit display timezones         |

Shared UX: searchable sidebar, favorites, recent tool IDs, command palette, light/dark/system theme, responsive input/output panels, consistent copy/download/reset actions, accessible feedback. Persist preferences only by default. Do not silently save tool inputs.

## Clipboard behavior

Paste text, select expiry and optional password protection, create a share, then copy a link or optional code. The recipient retrieves and copies the text without signing in. Default lifetime is one hour, with ten-minute and 24-hour choices. Content is plain UTF-8 text capped at 64 KiB. Protected shares require the password with either credential; unprotected shares require only the link or code. Content is server-stored and is not advertised as end-to-end encrypted.

Generate cryptographically random link and delete tokens. New codes are six case-insensitive characters grouped 3-3; legacy 12-character codes remain accepted. Store hashes of credentials. Put link credentials in a URL fragment and submit credentials in API bodies so they do not enter ordinary request paths. Retain the deletion receipt in the sender's session, allowing manual early deletion. Enforce expiry on every retrieval; hourly bounded cleanup deletes expired records. Provider backups may retain deleted database history according to provider policy.

Validate payload limits on the server, rate-limit creation and lookups, cap stored records, disable response caching, use generic unavailable/expired responses, and avoid logging text or credentials. Read-once semantics, attachments, accounts, and editable public shares are deferred.

## Architecture and directory structure

- `src/app/`: router, providers, application shell.
- `src/components/ui/`: official shadcn primitives.
- `src/components/tools/`: shared tool panels and actions.
- `src/features/<tool>/`: tool UI, pure transformation functions, colocated unit tests.
- `src/features/catalog/`: metadata registry, search, favorites, recent tools.
- `src/lib/`, `src/styles/`: shared browser helpers and styling.
- `server/clipboard/`: routes, service, D1 repository.
- `server/db/`: database schema and connection.
- `server/middleware/`: limits and request validation.
- `shared/`: shared API schemas and types only; no server imports in client code.
- `migrations/`: tracked SQL migrations and schema metadata.
- `tests/integration/`: API tests using a local D1 runtime.
- `tests/e2e/`: cross-context sharing and critical browser flows.
- `public/`: static assets and response header rules.
- Root configuration: pnpm, fnm, Biome, EditorConfig, TypeScript, Vite, Wrangler, Drizzle.

React Router lazy-loads tools. Hono handles the API. Zod validates API inputs. Drizzle models D1. The Cloudflare Vite plugin provides the local Worker/D1 runtime. Markdown uses react-markdown and GFM with raw HTML disabled; external images require explicit opt-in. JSON formatting must preserve numeric lexemes. UTF-8 Base64 must support non-ASCII text. Timestamp input/output units and timezones must always be labeled.

## Delivery order and verification

1. Establish pinned tooling, repository documentation and shared UI.
2. Build the shell, routing, search, themes, favorites and reusable workspace.
3. Implement all eight tools with focused transformation tests.
4. Implement and test clipboard sharing, expiration, deletion and limits.
5. Run Biome, TypeScript, unit/integration tests and a production build. Exercise clipboard sharing in separate browser contexts, keyboard navigation, responsive layouts, malformed inputs and error states.
6. Document local migrations and Cloudflare deployment. Real deployment requires the owner's account login, a D1 database ID and the chosen domain; do not commit credentials.

## Later ideas

Text diff, hashes, JWT inspection, regex testing, QR generation, color conversion, CSV/JSON conversion, local image resizing/compression, and offline installation. More expensive tools should use lazy loading and workers where appropriate.

## Changes to decisions

Update this file when product scope or architecture changes. Record significant implementation tradeoffs and verification limits in the README or a new dated decision document. This plan is the shared record of the conversation, not a claim that every item has already shipped.

### 2026-10-27 implementation notes

The resumed environment provides Node 24.22.1 through fnm. Update the project pin, engine requirement, and setup documentation to that patch version while retaining the Node 24 major version. Clipboard deletion receipts retain all unexpired entries in a module-backed session store: `sessionStorage` is best effort, and the in-memory fallback survives SPA navigation but not reloads. Use `pnpm run deploy` for the project deployment script because `pnpm deploy` invokes pnpm's unrelated workspace-packaging command.

### 2026-10-28 implementation status

The first release is implemented and locally verified. See [VERIFICATION.md](VERIFICATION.md) for checks, browser coverage, and the production setup still required. No remote deployment has been performed.

### 2026-10-29 production hostname

The owner selected `util.yuwol.dev` in the Cloudflare-managed `yuwol.dev` zone. Configure it as a Worker Custom Domain in `wrangler.jsonc`, retaining the existing workers.dev endpoint. The custom domain is deployed and verified over HTTPS, including clipboard create/retrieve/delete. See [VERIFICATION.md](VERIFICATION.md) for the deployment record.

### 2026-11-09 passwords and shorter codes

The owner requested clipboard passwords and easier-to-remember codes. Add optional password protection to each new share, enforced for both token and code retrieval. New codes contain six random characters, grouped as `ABC-234`, with uniqueness checks and collision retries. Existing codes and unprotected shares remain compatible.

Use browser-side PBKDF2-HMAC-SHA256 at 600,000 iterations with a 128-bit random salt. The server stores a SHA-256 verifier of the derived key and uses constant-time comparison. This keeps expensive password derivation outside the Workers Free CPU budget while retaining a slow salted password derivation. Raw passwords are not transmitted or saved; shared content remains server-readable. The derivation parameters are an API contract and need versioning before a future change. A per-share D1 counter limits wrong password attempts across clients and both credentials. Migration `0001_clipboard_passwords.sql` adds nullable protection metadata and defaulted attempt counters without rewriting existing records.

References: [OWASP PBKDF2 guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2), [Workers CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).

### 2026-11-09 browser file conversion

Add a ninth tool, File converter, under the Files category. The requested JPG → PNG and PDF → PNG conversions expand to PNG/JPG/WebP output from supported raster images or PDF pages, plus images combined into one PDF. GIF, BMP, and AVIF inputs depend on the browser's decoder; animation becomes a still image. SVG, office documents, videos, and arbitrary extension renaming are outside this release.

Keep all files and optional PDF passwords in browser memory. Use native canvas for raster conversion, PDF.js in its own worker for PDF rendering, pdf-lib for PDF creation, and fflate for ZIP downloads. Lazy-load these libraries and serve PDF fonts, character maps, codecs, and licenses from the same origin. No API, D1 migration, external conversion service, account, or paid hosting addition is needed.

Use the existing feature layout: `src/features/file-converter/logic.ts` for content detection, filenames, page ranges and limits; `image.ts`, `pdf.ts`, and `convert.ts` for conversion and resource cleanup; and `file-converter-tool.tsx` for the shadcn UI. Prepare ignored PDF static resources with `scripts/prepare-pdf-assets.mjs` before development and production builds. Register the tool in the shared catalog and cover downloads with real browser tests.

Support batches of ten files (25 MiB/file, 50 MiB total), PDF page selection and resolution, password-protected PDF input, individual/ZIP downloads, safe unique filenames, cancellation, and per-file errors. Bound output to 100 files and 100 MiB, and canvases to 16 megapixels and 8,192 pixels per side. JPG transparency becomes white. Clear previews when settings change or the user leaves the tool; never persist inputs.

References: [PDF.js](https://mozilla.github.io/pdf.js/examples/), [pdf-lib](https://pdf-lib.js.org/), [canvas encoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [fflate](https://github.com/101arrowz/fflate).

### 2026-11-09 Firefox image-export compatibility

The owner reported black PNG → JPG output on Windows with Firefox 159.0.1. Use a fully decoded HTML image and a software-backed export canvas instead of the accelerated ImageBitmap path. Retain the source blob URL through encoding, then release the image, URL, and canvas. JPG output uses an opaque canvas with an explicit white background.

Check a fixed four-color canvas before converting files. If canvas access is denied or its pixels are replaced, stop with site-specific permission guidance rather than offering corrupt output. This check uses known colors, not the user's image, so legitimate black images remain valid. Respect browser privacy settings; do not change them or bypass permission checks. Firefox coverage and independent JPEG pixel decoding are part of regression testing.

Default and Strict profiles preserved test colors on Linux. Resist Fingerprinting reproduced pixel replacement, but the exact Windows/GPU-specific cause is unconfirmed. Record verified browser versions and limitations in [VERIFICATION.md](VERIFICATION.md).

References: [image decoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode), [software canvas readback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext), [Mozilla's Resist Fingerprinting explanation](https://support.mozilla.org/en-US/kb/resist-fingerprinting).
