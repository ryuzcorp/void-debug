# Void Debug

A backend compatibility probe for [Void](https://void.cloud) platforms:
one page that exercises every backend binding — D1, KV, R2, Durable
Objects, Queues, Cron, WebSockets, SSE, Auth, sandboxes — with a
run-everything table plus interactive browser probes. Deploy the same
code to [Outer](https://outer.now) and to Noite; green across both means
the platforms agree.

## What it checks

Server-side checks (one click each, or all at once; results persist in KV):

- **env** — bindings the platform wired (DB, KV, STORAGE, SANDBOX) plus
  whether `DEBUG_PING` is set (set it as an app secret to verify secret
  injection end to end).
- **d1** — insert, read back, and delete one row. The table comes from
  `db/migrations/0002_debug.sql`, so a green check proves the platform
  applied migrations on deploy.
- **kv** — put, get, list, and delete in the default namespace.
- **r2** — put, get, head, list, and delete in `STORAGE` (`debug-storage`).
- **do** — increment a named Durable Object counter twice across RPCs.
- **queue** — send one message and wait for the consumer receipt in KV.
- **cron** — read the last per-minute heartbeat tick from KV.
- **sandbox** — run `node --version` inside a managed sandbox container.
- **auth** — resolve the current session (signed out counts as pass: the
  stack answered); a throw means misconfiguration.

Browser-driven probes (islands on the same page, reporting back to the
same table):

- **auth-ui** — sign up / sign in / sign out through the Better Auth
  client, then verify the session against the `requireAuth`-guarded
  `/api/me`. This is the full cookie flow.
- **ws** — typed echo round trip through `/echo` (ping out, pong back).
- **sse** — read `/api/events` to completion (three ticks, then close).

Deliberately skipped: AI, email sending, and external Postgres/MySQL —
celld-based platforms offer no Workers AI or SMTP egress, and external
databases need your own credentials.

## Local development

```sh
bun install
bun run dev        # Vite dev server on http://localhost:5173
bun run fmt        # format with oxfmt
bun run check      # typecheck + lint + format check + tests
bun run build      # production build: dist/ + dist/wrangler.json
```

`bun run build` also emits the deploy config the platforms read. After
editing `void.config.ts`, rebuild and confirm `dist/wrangler.json`
carries your bindings (`d1_databases`, `r2_buckets`, `durable_objects`,
`queues`, `triggers`).

## Deploy to Outer

Hand this directory to an agent connected to Outer over MCP (or paste
files through the console). The agent commits the files with Outer's
`commit` tool — there is no `git push to deploy`. Outer runs
`bun install` + `bun run build`, applies `db/migrations`, and deploys to
celld; the call returns `success` plus the URL, `failed` plus the log
tail, or `blocked` plus the offending lines to fix.

Two setup notes:

- **Auth secret.** Outer mints `BETTER_AUTH_SECRET` at deploy when the app
  has none (a value you set yourself always wins), so the auth checks work
  with no extra step. Noite provisions the same variable.
- **DEBUG_PING.** Optionally set a `DEBUG_PING` secret to any value; the
  env check reports it and thereby proves secret injection works.
- **Better Auth tables.** Void ships the Drizzle schema
  (`.void/better-auth-schema.ts`) but no DDL, so
  `db/migrations/0003_better_auth.sql` creates `user`, `session`, `account`
  and `verification`. Without it every Better Auth query fails with
  `no such table: user`.

`POST /api/checks/<name>` also runs one check, for curl verification
once live.

## Deploy to Noite

Hand the same directory to an agent driving Noite (same commit flow —
no `void connect` needed). Noite detects the Void build, provisions the
fleet, applies migrations against the staged generation, and mints
`BETTER_AUTH_SECRET` automatically, so auth works with no extra step.
Sandbox checks exercise Noite's sandbox controller; report what you see.

## Interpreting red

A red row names the platform gap, not an app bug: the check reports the
exact failure (missing binding, unknown table, consumer silence, guard
throw). Compare the same row across both platforms — a check that is
green on one and red on the other is a Void compatibility difference
worth filing with the failing detail attached.
