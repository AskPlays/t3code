---
name: diagnosing-bugs
description: Disciplined diagnosis loop for hard bugs and performance regressions. Use when a bug is intermittent, hard to reproduce, or when a previous quick fix didn't take — rather than guessing at a fix.
---

A disciplined loop beats guessing. Especially for scheduling bugs in this repo (rAF/setTimeout loops, timers, event handlers), resist the urge to patch the symptom. The loop: reproduce → minimise → hypothesise → instrument → regression-test → fix.

## Loop steps

Before hypothesising, name and run one tight, red-capable command that drives
the reported bug and asserts its exact symptom. If no such feedback loop can be
built, stop and state what artifact or environment access is missing instead
of guessing from a code reading.

- **Reproduce** — get a reliable reproduction before changing anything. If you can't reproduce, instrument to capture state at the failure, and state what evidence you'd need to consider the bug reproduced.
- **Minimise** — shrink the scenario to the smallest case that still fails. This isolates which system is actually at fault (loop scheduling, state machine, event ordering, data).
- **Hypothesise** — form 3-5 ranked, falsifiable cause hypotheses before touching code. State what observation would distinguish each one, show the ranking to the user before testing, and guard against anchoring on the first guess.
- **Instrument** — add logging or a temporary counter to confirm a specific prediction, not to hunt around. Tag temporary logs with a unique `[DEBUG-...]` marker so cleanup is searchable. Verify the suspected code path actually runs, and how often.
- **Regression-test** — add a test that fails without the fix and passes with it, at the seam you confirmed, before the fix. If no seam can exercise the real bug pattern, record that as an architecture finding instead of adding a shallow test. Use the `tdd` skill for the red→green loop.
- **Fix** — make the smallest change that addresses the confirmed cause, then watch the regression test pass. Do not "fix" unrelated issues you noticed along the way.

## Completion criterion

The bug is reproduced by a tight command, minimised, and explained by a tested hypothesis. The regression test went red before the fix and green after it at a valid seam, the fix is minimal and scoped, and all temporary `[DEBUG-...]` instrumentation is removed.
