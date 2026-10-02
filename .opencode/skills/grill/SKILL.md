---
name: grill
description: Interview the user about a plan, design, or feature request until every decision that could change the implementation is resolved. Use when the request is ambiguous; do not use it for facts the repository or tools can establish.
---

The most common failure mode with agents is misalignment. You think you know what the user wants; you build it; it is wrong. Ask the user to resolve decisions that the repository cannot answer, one at a time, until the plan is concrete enough to implement.

## Rules of the loop

- Ask questions ONE at a time. Do not dump a questionnaire; a single question focuses the user and keeps the session a conversation.
- Start broad, then narrow. Begin with intent ("what outcome are you after?"), then constraints, then specifics.
- Keep digging until every implementation-changing branch is resolved: scope, target users/inputs, edge cases, failure behaviour, and what "done" looks like.
- Do not propose solutions prematurely. The goal is to understand, not to design. Resist the urge to answer your own questions.
- Facts are the agent's job: read the repository or use tools instead of asking the user for information the environment can answer. Decisions are the user's job: ask and wait for the answer.
- When an answer reveals an ambiguity, follow it. When the user says "I don't care," ask whether that means either answer is acceptable or you should pick one.
- End each answer by checking you understood it correctly before moving on.

## Completion criterion

The session is done when you can restate the full plan back and the user confirms it, with no unresolved question that could change the implementation. Do not edit or implement until that confirmation. If a question needs a runnable artifact rather than discussion, stop grilling and ask the user whether to build that narrowly scoped artifact before deciding.
