# OpenCode CLI Workers

Read this before starting a worker or review. `scripts/run-opencode-worker.ps1`
is the wrapper for launching a separate OpenCode CLI worker in the repository;
`AGENTS.md` has only the routing and review-gate summary, while this file holds
the mode, logging, notification, and model details.

## Quick models

Three preset model tiers, in increasing capability (see
[`model-selection.md`](model-selection.md) for the why):

1. `deepseek-0731` (default) -> `opencode-go/deepseek-v4-flash`
2. `luna-pro` -> `opencode-go/gpt-5.6-luna`
3. `terra-pro` -> `openrouter/openai/gpt-5.6-terra-pro`

The default is DeepSeek V4 Flash and it keeps its provider default reasoning
(high) - forcing `max` adds nothing. Luna/Terra default to `max` because they
collapse at their provider default; drop them with `-Variant high` if you want
speed. `-Model` supplies an arbitrary model (passed straight to
`opencode run --model`); `-Variant` always overrides the default reasoning.

## Examples

```powershell
.\scripts\run-opencode-worker.ps1 -Task "Inspect the render scheduler."
.\scripts\run-opencode-worker.ps1 -Task "Review this change." -QuickModel luna-pro -Variant high
.\scripts\run-opencode-worker.ps1 -Task "Research this API." -Model openrouter/google/gemini-3-flash-preview
.\scripts\run-opencode-worker.ps1 -Review                     # review the current worktree, no worker
```

## Logging / watching live

Pass `-LogFile <path>` to stream worker/reviewer output to a log (also shown on
your terminal). Any `-Review` run defaults to a timestamped log under
`.opencode/logs/` (git-ignored) when `-LogFile` isn't given.

Tail it live in another terminal - `scripts\tail-review-log.ps1` auto-picks the
newest log:

```powershell
.\scripts\run-opencode-worker.ps1 -Task "..." -Review -LogFile .opencode\logs\review.log
.\scripts\tail-review-log.ps1            # latest log, live
.\scripts\tail-review-log.ps1 -Tail 100
.\scripts\tail-review-log.ps1 -LogFile .opencode\logs\review.log
```

## Reviews

- **Bare `-Review` (no `-Task`) is review-only.** It inspects whatever is already
  in the worktree (`git diff` / `git status`) and never runs a worker. This is the
  right mode when the changes were made by the primary agent and only an
  adversarial pass is wanted.
- **`-Review` + `-Task` = worker then review.** The worker makes the change on
  `-Task` first, then the reviewer runs. This is the delegated workflow.
- **Detach by default.** `-Review` alone returns immediately, streams to a log,
  and writes its exit code to a `<log>.exit` file when done (same as `-Background`).
  The completion notification is the normal wake-up path; use the `.exit` file
  only as a fallback when `-NoNotify` was used or no primary session was found.
- **`-Foreground`** runs a blocking, visible review instead.
- **Reviewers run with auto-approval (`--auto`) by design**: they are read-only
  (never edit files) and usually detached, so a headless child has no TTY to
  answer permission prompts - auto-approving lets the review continue instead
  of hanging or exiting.
- **Reviewers do not launch reviews.** A reviewer reports its verdict to the
  caller; only the caller starts the next review pass after fixing findings.
- **Workers** get `-AutoApprove` only when you pass it explicitly - except a
  t3-dispatched worker, which inherits the serve's own permission config
  (auto-approving in the t3-managed setup), so an unattended `-Task` can
  auto-edit there even without the flag.
- **Model**: reviewer defaults to `opencode-go/gpt-5.6-luna` at `max` unless
  `-ReviewModel` is given. `-ReviewModel` accepts a quick alias
  (`deepseek-0731` / `luna-pro` / `terra-pro`) or a literal model ID.
  `terra-pro` is the escalation ceiling.

### t3-aware dispatch (default on)

A `-Task` worker **and** a `-Review` pass run as **parented subagent sessions**
on the opencode server that hosts the primary session, so our t3code fork (see
[`t3code-fork.md`](t3code-fork.md)) shows them live in the thread's
Agents panel with monitoring status. When no primary session/server resolves,
or the t3 path fails, the wrapper falls back to the standalone `opencode run`
path. The worker is conservative because it mutates files: it falls back
standalone only when the t3 failure provably happened before any work
(session-create failure; a prompt-post failure only when a probe shows the
session provably idle - a fresh or unreachable session is treated as ambiguous
and reported instead), so a mutating task is never applied twice. The review
(read-only) falls back on any t3 failure - the review gate never degrades.

- **`-NotifySession <ses_id>`** pins the primary session (and thus the server)
  for both the t3 dispatch and the completion notice. Without it, the newest
  primary session in the directory wins - a competing CLI session in the same
  directory can hijack the run, so pin the session when more than one
  primary session is plausible.
- Host resolution excludes any listening serve that started _after_ the run's
  `creating instance` instants (beyond a one-second clock-skew tolerance), so
  a freshly spawned sibling serve (same t3 server, seconds apart) cannot
  near-tie with the real owner. The exclusion applies only when it
  disambiguates: if it would empty the candidate set (the churn-recovery
  re-resolve can find only a serve spawned after the primary run's original
  instant), the in-window candidates are kept and API verification + the
  tie-break decide. A near-tie between remaining candidates still resolves to
  no host (safe fallback), never a guess.
- **`-NoT3`** forces the standalone path.
- **`-T3TimeoutMinutes`** (default 60) caps a t3 review **and a t3 worker**
  before the run is aborted. A worker exceeding the cap is reported as failed
  (not re-run standalone, to avoid double-applying edits) - size long tasks or
  raise the cap. A worker that takes >30s to its first token can be misread as
  the ambiguous "stalled" signal and reported the same way.
- **`-SessionDirectory <dir>`** separates host discovery/verification from the
  review's `-Directory`. Defaults to `-Directory`. Set it to your session's
  directory (e.g. `D:\github\blox-server`) when reviewing a different repo, so
  the review parents to and notifies your session while working elsewhere.
- **`-ReviewSkillPath <path>`** injects a skill path into the review prompt
  (normalized to forward slashes - backslashes in prompt text stall
  parented-session processing on the opencode serve). Default: the skill tool,
  which works when reviewing this repo. Needed when the target repo has no
  review skill.
- The SSE stream reconnects on drops (3 attempts); termination requires a real
  `session.idle`/`session.status idle` event - a lost stream never guesses
  "done". A **deleted** session (user stopped it from the agents panel) is
  honored as a stop: no fallback, no duplicate. A **stalled** session (created
  but never started processing - the t3 server's opencode serve degraded) is
  aborted, the host re-resolved, and the review retried once before falling
  back.
- `-ReviewVariant` is ignored in t3 mode (the verified `prompt_async` body has
  no variant field); a status line notes it.
- The detached child runs under `pwsh` (the t3 SSE reader needs the .NET
  CancellationToken read overloads). On a pwsh-less host the child falls back
  to `powershell` and forces `-NoT3`.

### Worked example: delegated worker + a review

```powershell
.\scripts\run-opencode-worker.ps1 -Task "Fix the X bug." -Review
```

This runs a worker then a review, back to back:

1. **Worker** - edits files on `-Task` (default DeepSeek V4 Flash), as an
   `opencode run`. Completion is a scoped worktree diff and a worker exit result.
2. **Reviewer** - a fresh Luna (`max`) pass (temporarily the routine worker
   model per the note above). With a resolvable primary session
   this runs as a t3 parented subagent (see above); otherwise as a standalone
   `opencode run`. Completion is a reviewer verdict in the log, not merely a
   spawned process.

The reviewer is a separate process that never sees the worker's session - it
only sees the worktree state the worker left behind. Check the log for
`[review] adversarial review pass (...)`.

**One pass per run.** Each `-Review` runs a single adversarial pass and writes
one aggregate `.exit` for the whole run; the per-pass verdict lives in the log.
For a second (or escalated) pass, run another detached `-Review` once the first
notifies - each run gets its own log, `.exit`, and completion notice, so passes
chain (or parallelize) naturally instead of being locked into a `-ReviewPasses`
chain.

### Reviewing committed work

A bare `-Review` inspects the **worktree diff** (`git diff` / `git status`). To
steer a review at specific commits, pass the focus as the review's argument -
it is injected into the **reviewer's** prompt only (never the worker's):

```powershell
.\scripts\run-opencode-worker.ps1 -Review "look at commit a63b75"
```

Do **not** use `-Task` for this: `-Task` runs a worker on the text and the
reviewer never sees it (the wrapper's own footgun below). The review skill also
falls back to the recent commits (`git log` / `git show`) when the worktree
diff is empty, so a bare `-Review` on committed work still reviews something.

### The review loop

Keep reviewing until the change is done: after every round of changes, run a
review; fix what it finds (BLOCKERs and MAJORs before committing); then review
again. Stop when a pass reports no actionable issues. The loop converged
quickly in practice - later passes mostly surface NITs.

Also, **prefer detached (`-Review` default) over `-Foreground` when launching
from a tool call**: a foreground review can be killed by the caller's timeout
mid-run and silently produce nothing; the detached child survives and writes
`<log>.exit` when done.

### Footgun - the review may not run with the model you asked for

When you pass `-Task` along with `-Review`, the wrapper always runs the
**cheaper worker first** (default deepseek-0731) on the same `-Task`; the
escalated reviewer only runs _after_ the worker finishes. If you hand the review
instructions to `-Task`, the deepseek worker does the review and the reviewer
may never run - yet it looks like you got a review. Also, a reviewer can fail
on provider/server errors and produce nothing while the run still exits from
the worker's output.

**Check the actual model before trusting a review:** confirm the log contains
`[review] adversarial review pass (<resolved-model>)`, ideally back that with
usage/cost on your provider, and make sure the reviewer pass actually completed
(its verdict in the log).

## Built-in subagents vs the wrapper (tested 2026-08-07)

The opencode `task` tool launches subagents (`general`, `explore`, ...) in
process. A `general` subagent was tried as a reviewer against a committed
diff; findings from that experiment:

- **Capable reviewer.** The `general` subagent followed the `review` skill's
  checklist and verdict format correctly and ran all verification commands.
  It can serve as a fallback reviewer if the wrapper breaks.
- **Blocks the parent thread.** The `task` tool call is synchronous: the
  primary session stalls until the subagent returns, so the parent cannot keep
  working or supervise while the review runs. The wrapper's detached
  child (log + `.exit` + completion notification) exists precisely to avoid
  this; the wrapper wins for the review loop.
- **Per-agent model/variant works.** Subagents can be assigned their own
  `model`/`variant` (`.opencode/agent/<name>.md` frontmatter or `agent` in
  `opencode.json`), covering the wrapper's model tiers. But the wrapper offers
  per-run control from the shell (`-Model`/`-ReviewModel`/`-Variant`), which
  subagents do not.
- **Verdict: keep the wrapper.** Built-in subagents are a fallback, not a
  replacement: no detach-and-notify, no per-run model choice, no
  `-AutoApprove` for headless reviewer runs.

## Completion notification (wake-up ping)

**On by default.** The wrapper posts a completion notice into a primary opencode
session when the worker/reviewer finishes - the session's agent wakes up and can
continue the review loop autonomously while the human keeps chatting. The notice
is sent through the session's server API (`POST /session/:id/prompt_async`), so
it arrives in the session exactly like a user message.

```powershell
.\scripts\run-opencode-worker.ps1 -Task "Fix the X bug." -Review   # notifies by default
.\scripts\run-opencode-worker.ps1 -Review -NoNotify                 # log / exit file only
.\scripts\run-opencode-worker.ps1 -Review -NotifySession ses_abc123  # target a specific session
```

- Default resolution is `auto`: it collects _primary_-session candidates from
  the bounded tail of `opencode.log` (filtered to sessions that logged
  `mode=primary`, so subagents are excluded), newest first. Each candidate is
  validated against the server API for the exact `-Directory`, primary status,
  and non-archived state; the first candidate with a live host wins. A literal
  `ses_...` targets a specific session, `-NoNotify` opts out entirely.
- The host server is resolved **deterministically from session ownership**, not
  guessed: the log's `message=process` line tells which run last processed the
  session; that run's `creating instance` log timestamp is matched against the
  start time of the listening `opencode` processes - exactly one must match.
  This works for long-lived servers (the instance timestamp is the process
  start) and dead runs resolve to no process. If a headless run does not own a
  listening socket, the wrapper accepts only one API-verified listening server;
  ambiguous ownership is rejected, never guessed. On an unresolved match it
  falls back to the `.exit` file / log.
- Servers started with `OPENCODE_SERVER_PASSWORD` are supported: the wrapper
  sends basic auth (username from `OPENCODE_SERVER_USERNAME`, default
  `opencode`) on both the discovery and notice requests.
- The notice contains only wrapper-authored status data: wrapper exit code,
  worker exit code, the review pass (name/exit), and the log file name.
  Raw log/model text is deliberately omitted from the agent prompt; read the
  referenced log separately when the verdict details are needed.
- Run `.\scripts\run-opencode-worker.ps1 -SelfTest` for fixture checks of
  candidate filtering and notification payload construction. Live host/API
  resolution is exercised by the normal integration path.
- Best-effort: if no active session or host server can be found, the wrapper
  skips the notice and falls back to the `.exit` file / log. Notification never
  changes the wrapper's exit code.

## Constraints

- Workers share the workspace. Keep delegated tasks narrowly scoped.
- Workers must not commit, push, reset, or modify unrelated files.
- Do not use `-AutoApprove` unless unattended edits are intentional.

A delegated task is complete only when the intended worktree changes are
accounted for, every requested verification command has been run, and (for
code changes) the review loop has no unresolved actionable finding. Reporting
the change done or committing is governed by the review gate in `AGENTS.md`.
