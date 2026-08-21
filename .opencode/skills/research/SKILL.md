---
name: research
description: Investigate a narrow external or repository question using primary sources and leave one cited Markdown artifact. Use when a decision is blocked on facts, not when the answer is already in the current files.
---

Research is evidence gathering, not decision-making. A parent session may
delegate it, but the research run itself must stay focused. Keep the question
narrow enough to answer with evidence and tell the caller exactly where the
artifact was written.

## Process

1. State the question, scope, and the decision it informs.
2. Prefer primary sources: official documentation, source code, standards,
   specifications, and first-party APIs. Use secondary sources only to locate
   the primary source.
3. Record each material claim with a URL, file path, commit, or other citation.
4. Create `docs/research/` if it does not exist, then write one Markdown report
   there using a descriptive slug. Do not commit or delete the report unless
   the caller asks.
5. End with the answer, unresolved uncertainty, and the next decision the
   caller can now make. If the caller delegated this work, return the report
   path and a short result rather than starting another task.

## Delegation guard

If this skill is already running inside a worker or subagent, do the research
directly. Do not spawn another research agent. This prevents recursive
delegation and hidden token costs.

Do not turn research into a plan or implementation. Facts feed `grill`, design,
or a user-approved change; the caller decides what to do with them.
