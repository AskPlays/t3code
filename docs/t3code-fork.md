# T3 Code integration: opencode subagents in the agents panel

Read when working on the t3code fork (`D:\Users\Adrian\Documents\t3code`), the
agents panel, or the wrapper's review dispatch. This is the plan and
evidence ledger for one goal: when a wrapper review runs, the t3code
subagents panel shows the review agent with live monitoring status.

Status: **implemented, validated end-to-end, review-gated clean, and in daily
use via the nightly client (2026-08-08)**. The fork lives at
`D:\github\t3code` (origin `AskPlays/t3code`, upstream `pingdotgg/t3code`),
working branch `feat/opencode-commands-and-skills`; the older
`feat/opencode-subagent-tasks` branch keeps the OpenCodeAdapter monitoring
lineage. The wrapper's t3 dispatch is
implemented in `scripts/run-opencode-worker.ps1` and validated live: a review
launched with `-NotifySession <thread-session-id>` shows as a
"review \<timestamp\>" row in the thread's agents panel (Working → activity →
tokens → Idle) with a working stop control.

## Upstream sync 2026-09-03 (2120fbc18)

Merged `upstream/main` into `feat/opencode-commands-and-skills`. Same resolution
rule as before: in shared files adopt upstream's shapes so future merges stay
small; keep fork-only logic in fork-only files. ~213 upstream commits behind
(last sync was 9b2d04317 on 2026-08-31).

- **Upstream now does per-cwd OpenCode skills — adopted for skills, fork keeps
  commands.** New `OpenCodeDriver.snapshotForCwd` probes `loadOpenCodeSkills`
  per cwd and maps through `openCodeSkillsToServerProviderSkills`; the composer
  resolves per-cwd via `resolveProviderSkillsForCwd` /
  `resolveProviderSlashCommandsForCwd` (`workspaceSnapshots`). Upstream still
  has no OpenCode slash commands, so the fork keeps: `commands` on
  `OpenCodeInventory`, `loadCommands` + `loadOpenCodeCommandCatalogFromClient`
  in `opencodeRuntime.ts`, `openCodeSlashCommands` + scope-aware
  `flattenOpenCodeSkills` in `OpenCodeProvider.ts` (kept alongside upstream's
  exported `openCodeSkillsToServerProviderSkills`, which `OpenCodeDriver`
  imports — both functions now live in that file), the `getCommandCatalog`
  RPC, and the composer's per-thread catalog query. Composer precedence is
  now `threadSlashCommands ?? selectedProviderSlashCommands` and
  `threadSkills ?? selectedProviderSkills`.
- **Adapter**: upstream renamed the abort exit (`abortExit` → `failedExit`);
  the fork's detached-command-failure block (`pendingCommandFailure` →
  `failDetachedCommand`) is kept, adapted to the new name.
- **ProviderServiceShape now has both** `getCommandCatalog` (fork) and
  `assertConversationRollbackSupported` (upstream); all test harnesses carry
  both. `makeFakeCodexAdapter` in `ProviderService.test.ts` accepts both call
  styles (fork's `{ getCommandCatalog }` options object, upstream's boolean)
  via a normalized union param.
- **UsageService**: upstream refactored the scan (`collectDirs` pre-walk +
  `ScannedDir`, concurrent rates fetch, resume-from-position transcript
  reads). The fork's `opencodeSqlite` source is adapted onto it: `ScannedDir`
  carries `kind`/`databasePath`, `collectDirs` gates existence on the sqlite
  path and skips the jsonl walk for it, the scan loop reads it via
  `readOpenCodeUsage` as before.
- **ChatComposer**: upstream's resting-composer transition (~400 lines) and
  the fork's `EMPTY_PROVIDER_COMMAND_CATALOG_ATOM` are adjacent additions —
  both kept.
- **Environment notes**: `apps/server/package.json` keeps the fork's nightly
  version string. After merging, `vp i` is required before typecheck
  (`vite-plus` 0.2.2→0.3.0, `yauzl` + `@types/yauzl` are new upstream deps;
  without install, `AntigravityInstallation.ts` fails on the missing module).
  `vp` lives in `node_modules/.bin` (`export PATH="$PWD/node_modules/.bin:$PATH"`).
- **Verified**: server typecheck clean (suggestions only); OpenCodeAdapter +
  OpenCodeProvider + opencodeRuntime.inventory + usageOpenCode 136/136;
  ProviderService + ProviderRuntimeIngestion + reconcile + UsageService
  114/114; CheckpointReactor + ProviderCommandReactor + ProviderSessionReaper
  82/82.

## Upstream sync 2026-08-31 (9b2d04317)

Merged `upstream/main` into `feat/opencode-commands-and-skills` (merge
`b99e491e7`). Same resolution rule as before: in shared files adopt upstream's
shapes so future merges stay small; keep fork-only logic in fork-only files.

- **Adapter rewritten on upstream's chassis.** Upstream rewrote the OpenCode
  interruption flow (cancellation Deferreds, prompt admission, `turn.aborted`
  replacing `turn.completed {state: "interrupted"}`), so the adapter was
  rebuilt from upstream's file with the fork's features grafted back:
  subagent task.\* monitoring (ensure/hydrate/emit/settle + the dispatch seam
  in `handleSubscribedEvent`, which now returns whether it consumed an event
  and lets upstream's child-request routing handle unmatched types), the
  owned-session token-usage snapshot + `resolveOpenCodeModelContextLimit`,
  subagent aborts in `stopOpenCodeContext`/`interruptTurn`, and
  `getCommandCatalog`. The fork's detached slash-command dispatch
  (`session.command` endpoint) lives inside upstream's `sendTurn`: commands
  skip prompt admission, fork detached into the session scope, and their
  failures surface through `failDetachedCommand`; a rejection racing an
  in-flight interrupt is parked on `OpenCodeCancellation.pendingCommandFailure`
  and emitted by the abort-failure path.
- **Fork tests updated to merged semantics** (one implementation each):
  "keeps a late command rejection..." now asserts `turn.aborted` + no second
  terminal event; the two plan-agent tests now assert upstream's precedence
  (explicit agent option wins over interaction mode; plan mode applies when
  no agent option). Upstream's child-approval/question routing tests take one
  extra stream event (the fork's `task.started` for the parented child).
  Upstream's old-interruption tests already cover the new machinery.
- **Contract**: `UsageProviderKind` is upstream's v5 (`USAGE_MERGE_COMPATIBLE_SINCE`)
  with the fork's `"opencode"` added; usage sources scan claude/codex/grok
  (upstream) + opencode sqlite (fork). Web/mobile usage provider tables carry
  both the upstream `grok` entry and the fork `opencode` stub.
- **Environment notes**: `apps/server/package.json` keeps the fork's nightly
  version string. `usageOpenCode.test.ts` now picks a platform-appropriate
  absolute path (the hardcoded `D:\...` failed on Linux). The server.test
  workspace-stat test fails when run as root (chmod 0o000 does not block
  stat for root) — pre-existing upstream behavior, not merge damage.
- **Verified**: server `tsgo` clean; OpenCodeAdapter 102/102,
  OpenCodeProvider + opencodeRuntime.inventory + usage 62/62 + reconcile
  suites green. Web/mobile untouched behaviorally (fork runs standard
  clients there); typecheck not run for them.

## Upstream sync 2026-08-21 (be7d35aae)

Merged `upstream/main` into `feat/opencode-commands-and-skills` (merge
`5e554f9c3`, plus a mobile typecheck stub). Resolution rule: in shared files
adopt upstream's shapes so future merges stay small; keep fork-only logic in
fork-only files (`opencodeCatalog.ts`, the adapter).

- Skills use upstream's shape (`ReadonlyArray<OpenCodeSkill>`, schema,
  `opencode debug skill` CLI parsing). The provider probe uses upstream's two
  paths: SDK client for configured servers, CLI with `cwd` for local.
- Fork keeps what upstream lacks: `commands` on `OpenCodeInventory`,
  `loadOpenCodeCommandCatalogFromClient` (used by `getCommandCatalog`),
  `openCodeSlashCommands`, and project/user/system scope classification added
  inside upstream's `flattenOpenCodeSkills`.
- **Finding** (verified live on opencode 1.18.21): `opencode debug skill` run
  from a project cwd lists that project's skills, covering `.opencode/skill/`
  and `.agents/skills/`. Commands have no CLI surface — `command.list` exists
  only on the server SDK — so the per-thread catalog RPC stays; if it ever
  needs slimming, commands-only is the cut.
- Upstream's new `apps/mobile` predates the fork-only `"opencode"`
  `UsageProviderKind`; its `usageProviders.ts` carries an unrendered stub
  entry to satisfy exhaustive records. Full-repo `pnpm typecheck` is green.

## Review gate — final (both tracks clean)

- **Fork** (`feat/opencode-subagent-tasks`): the adapter maps parented-session
  events into `task.*` (started/updated/progress/idle-non-terminal/failed/
  interrupted), with hydration for missed spawns, pinned status on progress
  rows, ingestion-preserved status on usage snapshots (retention-safe),
  stop-on-interrupt, wire-safety and lint cleanups. Typecheck clean, 38-39
  tests green across passes. Review passes (round-4, round-5c, cross-repo
  fallback): **no BLOCKERs/MAJORs in any; all MAJORs/MINORs fixed and
  verified**.
- **Wrapper** (`dev`): t3 dispatch with standalone fallback; SSE reads that
  wait on one pending read through quiet periods, reconnect on real failures
  only, and probe session health on a time basis; user-stops honored (no
  duplicate); stalled sessions retried once against a re-resolved host;
  `-NoT3` / `-T3TimeoutMinutes` / `-SessionDirectory` / `-ReviewSkillPath`
  flags; pwsh child with a `powershell` fallback. Flag semantics live in
  [`opencode-workers.md`](opencode-workers.md). Final round-7 (Luna,
  `-NoT3`): **"No actionable issues found"**; the on-myself review then found
  2 MAJORs (closest-serve math; user-stop duplicated the review) — both
  fixed and re-verified.
- Review-loop history worth keeping: the SSE re-arm spin bug, quiet-tick
  reconnect forcing mid-review fallback, faulted-read bypassing reconnect,
  text-accepted-without-idle, exit-2 skipping fallback, PID-0 spawn failure
  from an inline `if`, backslash-path stalls, and the serve-degradation
  discovery (below).

## Daily flow (option 1: nightly client via relay) — validated

1. Start the fork server in `apps/server` with the T3 Connect public config:
   `$env:T3CODE_RELAY_URL=...` + the three `T3CODE_CLERK_*` values from
   `.env.example`, then `node src/bin.ts serve` (server-only; the
   "No static directory configured and no dev URL set" message is expected —
   the UI is the hosted client, not a local page). The bundled build
   (`dist/bin.mjs`) needs the same vars in the shell — see "T3 Connect on the
   bundled build" below.
2. `node src/bin.ts connect login --headless` then `connect link` (with the
   same env vars) to authorize the relay link; the serve logs the share URL.
3. Open the share URL in `nightly.app.t3.codes` → pair. The nightly client
   talks to the fork server through the relay; the opencode provider +
   projects come from the REAL home (`C:\Users\adria\.t3` — a plain
   `t3 serve` does not apply the worktree-home override).
4. Run wrapper reviews with:
   `-Directory <review target>` + `-SessionDirectory D:\github\blox-server`
   (discovery/verify/notify against your session) + `-NotifySession <a t3
thread's session id>` + `-ReviewSkillPath D:\github\blox-server\.opencode\skills\review\SKILL.md`
   when the target repo has no review skill. The panel row appears in the
   parent thread; the completion notice lands there too.
5. **Panel visibility requires a t3-managed thread as parent.** A standalone
   CLI session is only adopted (and thus monitorable) once it has been opened
   in the client.

## Known issue: opencode serve degradation

A t3-managed opencode serve degrades after ~15 min: it keeps answering API
calls but stops processing NEW session prompts (parented and plain; reproduced
6/6 + plain probe on a degraded serve, fresh serves process fine). Not content-
related (a prompt shape that processed on a fresh serve stalls on a degraded
one). **Workaround: restart the fork server** — fresh serves process parented
sessions immediately. The wrapper's stall detection + standalone fallback keep
the review gate safe meanwhile. Recorded as a papercut (2026-08-08); likely
worth an upstream opencode issue.

## Preview host for local runs — resolved (2026-08-09)

The `t3-code_preview_*` tools need the **Electron desktop app** as their host;
no browser-only client can provision one. The renderer registers the host only
under `apps/web/src/components/preview/PreviewAutomationHosts.tsx:248`
(`if (!isElectron || !previewBridge?.automation) return null;`), one host per
connected environment, over `WS_METHODS.previewAutomationConnect`.

- The host's `environmentId` is the connected serve's persisted id
  (`apps/server/src/environment/ServerEnvironment.ts:115-126`, UUID written
  once per data dir), and the broker routes agent sessions by id equality
  (`apps/server/src/mcp/PreviewAutomationBroker.ts:444`), so host and agent
  match whenever they share one serve process.
- The broker is in-memory per serve: a host only serves sessions on the
  **same serve instance the Electron client is connected to**. The desktop app
  always spawns its own backend (port scan from 3773, or `T3CODE_PORT`); there
  is no adopt/attach path to an already-running serve.
- **Validated end-to-end (2026-08-09):** with the T3 Code (Alpha) app running,
  `t3-code_preview_status`/`open`/`snapshot` worked from a blox-server session
  (navigated example.com, full a11y tree + screenshot). With the app off and
  only the headless bundle serving, the tools fail again with "No preview
  automation host is available in environment ...". Headless-only serves
  therefore have no preview automation by design; enabling it there would need
  a fork change (web client hosting on local serve, or desktop adopting an
  existing serve).
- **Papercut:** opencode's bash tool exports `ELECTRON_RUN_AS_NODE=1`; an
  electron launched from an agent shell dies silently (or, in the app's case,
  is single-instanced into the already-open Alpha window). Launch desktop
  runs from a normal terminal.
- **Cosmetic quirk:** `preview_click`/`type`/`press`/`scroll` declare
  `success: Schema.Null` (tools.ts), so opencode reports them as failed
  ("expected record, received null") even though the action executes (the
  click navigated the tab). A fork fix would return an empty record instead.

## T3 Connect on the bundled build (2026-08-09)

`dist/bin.mjs connect` fails with "T3 Connect commands are unavailable: this
build is missing T3 Connect public configuration" unless the three public vars
(`T3CODE_RELAY_URL`, `T3CODE_CLERK_PUBLISHABLE_KEY`,
`T3CODE_CLERK_CLI_OAUTH_CLIENT_ID`) are in the process environment. The
`__T3CODE_BUILD_*` fallbacks are baked at build time from the **repo root**
`.env` via `scripts/lib/public-config.ts` (`loadRepoEnv`); the bundled server
**never reads .env at runtime** (no dotenv anywhere in `apps/server`). Set the
vars in the shell before `node dist/bin.mjs serve|connect`, or rebuild after
creating the root `.env`.

## Remaining work (deferred, not blockers)

- **Fork upstreaming**: the branch is local; a PR to `pingdotgg/t3code` is
  viable once `orchestrator v2` merges upstream (the adapter change is
  provider-local and review-clean).
- **Serve degradation root cause**: why t3-managed serves stop processing
  new sessions (opencode v1.18.15 + `OPENCODE_CONFIG_CONTENT="{}"` interplay)
  — needs upstream investigation; the restart workaround is sufficient daily.
- **CLIXML papercut** (fixed 2026-08-08 in `scripts/pwsh-utf8.cs`): opencode's
  reviewer bash-tool runs `run-opencode-worker.ps1 -SelfTest` through the
  `pwsh-utf8` proxy, which previously re-spawned pwsh with `-EncodedCommand`
  and so flooded the review log with "Cannot process the XML" errors. The
  proxy now runs pwsh with `-File <temp.ps1>` (plain-text output); verified 0
  flood lines with the papercut entry removed from `docs/PAPERCUTS.md`.

## Goal (user's dream scenario)

`run-opencode-worker.ps1 -Review` is launched from an opencode thread that
t3code manages. The thread shows a monitoring/"working" state, and the review
appears as a row in the thread's subagents panel with live status, activity,
and token usage. No changes to the wrapper's detach/log/notify contract.

## How it works (validated)

1. The wrapper resolves the server hosting the primary session (`-NotifySession`
   pins it; otherwise the newest primary session in the directory wins, which
   can be the wrong one when a competing CLI session exists).
2. It creates a **parented session** on that server
   (`POST /session?directory=<cwd>` with `{title, parentID}`) and posts the
   review prompt (`prompt_async {parts, agent, model:{providerID, modelID}}`).
3. The server processes it; the t3code fork's `OpenCodeAdapter` maps the
   parented session's events (`session.created/updated`, `session.status`
   busy/idle, `session.idle`, `session.error`, tool parts) into the shared
   `task.*` lifecycle; the client `subagentRuntime` fold renders it in the
   agents panel and the sidebar monitoring pills.
4. The wrapper streams deltas to the review log (SSE), waits for idle, fetches
   the verdict text (v1 `/session/:id/message?directory=`), writes `.exit`,
   and notifies — same contract as before. Any t3 failure falls back to the
   standalone `opencode run` path, so the review gate never degrades.

## Stop-subagent from the panel — implemented

The Agents panel's Stop (and the stop-everything interrupt) now aborts tracked
subagent sessions: `interruptTurn` and `stopOpenCodeContext` abort every live
parented session (`client.session.abort({sessionID})` — the task id IS the
opencode session id) before the owned session; the resulting session deletion
settles the rows and clears background liveness. Validated live (the row
flipped to "Aborted" on Stop).

## Key API facts (probed on opencode v1.18.15, no auth)

- `POST /session?directory=<dir>` body `{title?, parentID?}` — `parentID`
  creates a subagent-style session the server loop processes to completion.
- `POST /session/:id/prompt_async` body
  `{parts: [{type:"text", text}], agent, model: {providerID, modelID}}` —
  model must be the object form (string → 400).
- Terminal signal: SSE `session.status {type: idle}` or `session.idle`.
- Verdict text: v1 `GET /session/:id/message?directory=<cwd>` (the v2
  `/api/session/:id/message` returns nothing for parented sessions; the v1
  route without `?directory=` serves the SPA).
- The review skill loads fine on a t3-spawned serve even with
  `OPENCODE_CONFIG_CONTENT="{}"` — project `.opencode/` files still load.

## Adapter mapping (reference)

`OpenCodeAdapter.ts` maps parented-session
events into the shared `task.*` lifecycle; the client `subagentRuntime` fold
renders rows in the Agents panel and the sidebar monitoring pills.

| OpenCode event                         | Task event                                          |
| -------------------------------------- | --------------------------------------------------- |
| `session.created` (parentID = owned)   | `task.started` (title from session title)           |
| `session.updated`                      | metadata patch; usage progress rows (status pinned) |
| `session.status busy` / `retry`        | `task.updated running`                              |
| `session.status idle` / `session.idle` | `task.updated idle` (non-terminal, resumable)       |
| `session.error`                        | `task.updated failed`                               |
| `session.deleted`                      | `task.updated interrupted`                          |
| tool `message.part.updated`            | `task.progress` (lastToolName/summary)              |

Missed `session.created` (mid-run subscribe) hydrates via `session.get` with a
negative cache for confirmed non-children. The Agents panel Stop aborts every
tracked subagent (`client.session.abort` — the task id IS the opencode session
id), settling the rows and clearing liveness.

The fork also ships `.opencode/agent/review.md` (`mode: all`, read-only, loads
the review skill from the blox-server path) so thread-spawned review subagents
have a proper identity.

## Running the fork

The dev-runner's `--home-dir` flag is unusable in dev mode (it forwards to
vite-plus, which rejects it), so `pnpm dev` uses the worktree's fresh `.t3`.
For daily use run the server-only route (`node src/bin.ts serve` in
`apps/server`) — it uses the REAL home and the nightly client for UI (see the
Daily flow section). One opencode serve is spawned per thread session (ports
change); the wrapper discovers the right one via the session id.
