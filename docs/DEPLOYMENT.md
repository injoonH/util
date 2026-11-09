# Cloudflare deployment and operations

This project targets the owner's **Cloudflare Workers Free** account directly. One Worker serves the static frontend and clipboard API, with D1 for temporary shares. Use an existing domain after the initial deployment works. The decision record is [PLAN.md](PLAN.md), and local development instructions are in the [README](../README.md).

**Current deployment:** [https://util.yuwol.dev](https://util.yuwol.dev), verified on 2026-11-09 with password-protected clipboard shares and six-character codes. Worker `utility-workbench` uses the production `DB` binding and the tracked custom-domain route in `wrangler.jsonc`. Remote migrations are applied through `0001_clipboard_passwords.sql`. The existing [workers.dev endpoint](https://utility-workbench.yuwol036.workers.dev) remains enabled.

The `pnpm run deploy` script checks configuration before building or uploading and stops with setup instructions when the database ID is absent or a placeholder, or when the JSON configuration is invalid. This check does not verify the remote database or apply migrations.

## First deployment

### 1. Prepare and verify the checkout

Use the Node and pnpm versions pinned in the repository:

```sh
fnm install
fnm use
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

The local database and integration-test database are separate from production.

### 2. Authenticate and create the database

```sh
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm exec wrangler d1 create utility-clipboard
```

Select the intended Cloudflare account. If it already contains the project's database, reuse its existing ID instead of creating another database. To inspect existing databases:

```sh
pnpm exec wrangler d1 list
```

The owner's database ID is already configured. If targeting a different database, update the existing `DB` entry's `database_id` in the root `wrangler.jsonc`. Retain binding name `DB`, database name `utility-clipboard`, and migration directory `migrations`. If Wrangler offers to add a new binding during creation, decline and update this existing entry instead. A database ID is configuration, not an API token; keep credentials out of the repository.

If multiple Cloudflare accounts are available, set the intended `account_id` in `wrangler.jsonc` or use the appropriate Wrangler account configuration. Keep that selection consistent for database creation, migrations, and deployment.

### 3. Review configuration, migrate, and deploy

The checked-in rate-limit bindings use namespace IDs `10001` and `10002`. Choose unused namespace IDs if those are already used by another Worker in the same account; namespaces can share counters. Keep both bindings present:
- `CLIPBOARD_CREATE_LIMITER`: 10 requests per 60 seconds.
- `CLIPBOARD_READ_LIMITER`: 30 requests per 60 seconds, shared by retrieval and deletion.

Then apply the schema and deploy:

```sh
pnpm db:migrate:remote
pnpm run deploy
```

The migration command targets the configured remote D1 database using the root `wrangler.jsonc`. Review the listed migrations before confirming. `pnpm run deploy` runs the production build before `wrangler deploy`. The explicit `run` matters: `pnpm deploy` is a different, built-in pnpm workspace-packaging command.

The Cloudflare Vite plugin builds frontend assets into `dist/client` and the Worker into `dist/utility_workbench`. It writes the generated Worker configuration to `dist/utility_workbench/wrangler.json` and a deployment redirect to `.wrangler/deploy/config.json`; Wrangler uses that built configuration when deploying. Edit root source configuration, not generated files under `dist/` or `.wrangler/`. Running the deployment script rebuilds these outputs after configuration changes. The build and deployment outputs are ignored by Git. See Cloudflare's [Vite plugin workflow](https://developers.cloudflare.com/workers/vite-plugin/get-started/).

### 4. Add the custom domain

The project's hostname `util.yuwol.dev` is already attached and configured in source. Retain its `routes` entry on subsequent deployments. The steps below apply when attaching a different hostname.

Use an unused hostname in an active Cloudflare zone you control, such as `utils.example.com`. In the Cloudflare dashboard, select the Worker and open **Settings → Domains & Routes → Add → Custom Domain**. Cloudflare provisions its DNS record and certificate. An existing CNAME on the chosen hostname must be resolved before adding the Custom Domain. [Custom Domain documentation](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Alternatively, merge this field into the root `wrangler.jsonc`, using the real hostname:

```json
{
  "routes": [{ "pattern": "utils.example.com", "custom_domain": true }]
}
```

Run `pnpm run deploy` after changing the configuration. Preserve the rest of `wrangler.jsonc`; the snippet is an additional field, not a replacement file. Keep the dashboard and tracked domain configuration consistent on later deployments.

The frontend and API must share the same origin. The existing configuration sends `/api/*` to the Worker first, while other paths use static assets and the SPA fallback. Retain `assets.run_worker_first: ["/api/*"]`; otherwise an API request can receive `index.html` instead of JSON. Use one canonical public origin for sharing links. [Static asset routing](https://developers.cloudflare.com/workers/static-assets/).

### 5. Verify the deployed behavior

Open the reported HTTPS URL and check these flows:
1. Open a tool directly at `/tools/base64`, refresh, and verify that the route still loads.
2. Create a clipboard share with a typing code. Open the link in another browser or private session and retrieve the exact text.
3. Retrieve the same share with its code. Delete it from the original sender tab, then confirm both access methods return unavailable.
   Also create a password-protected share: the link and six-character code must both prompt for a password, reject a wrong password, and return the text only after the right password.
4. Check that clipboard API responses have `Cache-Control: no-store`, and that the database is bound to `DB`.
5. Confirm the cleanup Cron Trigger and both rate-limit bindings are present in the deployed Worker.

Record the deployed hostname and account/database ownership in the team's operational notes. Do not place tokens or sample sensitive shares in those notes.

## Keeping hosting at zero additional cost

Remain on **Workers Free** and use the existing domain. The allowances checked on 2026-10-25 are:

| Resource                                         | Free allowance              |
| ------------------------------------------------ | --------------------------- |
| Static assets served without running Worker code | Free, unlimited requests    |
| Worker requests                                  | 100,000 per day per account |
| Worker CPU                                       | 10 ms per invocation        |
| D1 rows read                                     | 5 million per day           |
| D1 rows written                                  | 100,000 per day             |
| D1 database size                                 | 500 MB per database         |
| D1 total account storage                         | 5 GB                        |

These quotas are shared with other usage on the account. D1 writes include inserts, deletes, and index updates; the write allowance is not a count of clipboard shares. Free quota exhaustion causes errors and may interrupt sharing. Browser-local tools do not need D1 or clipboard API calls. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

The application caps storage at 4,096 rows. At the maximum 64 KiB content size, that is 256 MiB of text before database/index overhead, leaving headroom within the single-database free limit. The cap includes expired records that have not yet been cleaned up. Creation returns a temporary-unavailability response when the cap is reached.

Rate limiting reduces accidental bursts and simple abuse, but Cloudflare's binding applies approximate limits separately in each location. It does not guarantee a global daily budget. Check usage in the Cloudflare dashboard and keep paid products disabled for this project. [Rate-limiting behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Expiry, deletion, and retained data

The server checks `expires_at` during every retrieval. The Cron Trigger `17 * * * *` runs at minute 17 of every hour in UTC; each run deletes at most 500 expired rows, oldest first. A backlog can remain for several runs, but expired rows are never returned to readers. The maximum share lifetime is 24 hours, with one hour as the default.

The sender receives a separate deletion token. Deleting a share removes its live row and invalidates both the link and code. A module-backed session store retains all unexpired deletion receipts and uses `sessionStorage` when browser storage is available. Receipt contents include credentials and expiry, not the shared text. If browser storage is blocked, the in-memory store preserves receipts across SPA navigation, but a reload loses them. Shares whose receipts are lost still expire normally.

Shared text is stored as plain text in D1 and is not end-to-end encrypted. Hashing access and deletion credentials does not encrypt content. Expiry and deletion do not remove older provider database snapshots: D1 Free currently retains seven days of Time Travel history. Do not describe expiration as immediate erasure from every backup. [D1 retention limits](https://developers.cloudflare.com/d1/platform/limits/).

Application logging intentionally excludes content and credentials, and Worker observability is disabled in the checked-in configuration. If adding logging, error reporting, or analytics, preserve that boundary. Keep `.env*`, `.dev.vars*`, credentials, `.wrangler/`, and local databases out of Git.

## API contract

All endpoints accept `Content-Type: application/json` on the same origin. Responses are uncached. Invalid, deleted, and expired valid-format credentials receive the same unavailable response. Malformed requests receive validation errors.

| Endpoint                       | Request                                                              | Success                                                          |
| ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/clipboard/create`   | `{ content, expiresIn?, includeCode?, password?: { salt, key } }`    | `201 { token, code, deleteToken, expiresAt, passwordProtected }` |
| `POST /api/clipboard/retrieve` | Exactly one of `{ token, passwordKey? }` or `{ code, passwordKey? }` | `200 { content, expiresAt }`                                     |
| `POST /api/clipboard/delete`   | `{ token, deleteToken }`                                             | `204`                                                            |

`expiresIn` is 600, 3600, or 86400 seconds; the API defaults to 3600. `includeCode` defaults to false in the API. Tokens are 48 hexadecimal characters, representing 192 random bits. New codes use six case-insensitive characters grouped three-three; legacy 12-character codes are still accepted. Errors have shape `{ error: string, code?, passwordSalt? }`; rate-limit responses use status 429 and `Retry-After`.

For optional password protection, the browser generates a 16-byte salt and derives a 32-byte key using PBKDF2-HMAC-SHA256 at 600,000 iterations. It submits `{ salt, key }` as lowercase hex strings during creation. The Worker stores the salt and `SHA256("password:" + salt + ":" + key)`, not the key or original password. The expensive derivation stays in the browser to respect the free Worker's CPU limit. These fixed derivation parameters are part of the API contract.

Retrieving a protected share without a key returns `401 { error, code: "PASSWORD_REQUIRED", passwordSalt }`, containing no content. The client derives `passwordKey` from the entered password and that salt, then repeats the same token/code request with the key. A wrong key returns status 403 and code `INCORRECT_PASSWORD`. Five wrong keys within a 60-second window block subsequent access to that share until the window ends: status 429, code `PASSWORD_RATE_LIMITED`, and `Retry-After` in seconds. The counter is shared by link/code access and is updated atomically in D1. A successful unlock resets previous failures. Missing-password prompts do not count as wrong attempts. Deletion uses the separate sender receipt and requires no password.

Migration `0001_clipboard_passwords.sql` adds the protection and failure-counter columns. Apply it remotely before deploying this release; existing records remain unprotected and retain their existing access credentials. Passwords and derived keys must never be added to URLs, deletion receipts, analytics, or logs. This is password access control over server-stored content, not end-to-end encryption.

The browser share URL is `/tools/clipboard#<token>`. The fragment is not sent in the page's HTTP request. The frontend extracts the token and submits it in the retrieval body. All three credential types are hashed before database storage.

## Subsequent releases

For code-only changes:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
pnpm run deploy
```

For a schema change, generate and test the new migration locally, review its SQL, commit both SQL and Drizzle metadata, then run `pnpm db:migrate:remote` before deployment. Never rewrite a migration that has already been applied. A failed application deployment does not undo an already-applied database migration; keep schema changes compatible with the currently deployed API where practical.

The file converter is a frontend-only release and requires no new migration or Cloudflare binding. `pnpm build` prepares PDF.js fonts, character maps, codecs, and licenses under ignored `public/pdfjs/`, then copies them into `dist/client/pdfjs/`. The PDF worker is emitted as a versioned Vite asset. Deploy the complete static build so those resources match the installed PDF.js version; no CDN or file-upload endpoint is used.

If moving to the existing Docker/nginx host later, keep the React static frontend and port the Hono entry point plus repository adapter to Node and a persistent SQLite volume. That fallback is documented in the plan; this repository currently implements the Cloudflare runtime only.
