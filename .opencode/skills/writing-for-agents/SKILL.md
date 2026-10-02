---
name: writing-for-agents
description: Reference for writing or editing agent-facing documents, including AGENTS.md, skills, specs, backlog entries, and pointed-to docs. Use when changing instructions an agent will read.
---

Use this reference when editing a document an agent consumes. The target is a
predictable process, not identical output on every run.

## Context pointers

A context pointer is an always-loaded reference that names material outside the
current context and says when to read it. A skill description and an `AGENTS.md`
line pointing at a document are the same kind of pointer.

- Put the leading trigger word first.
- Name distinct trigger branches, not a list of synonyms for one branch.
- Remove identity or explanation that the target document already contains.
- Strengthen a weak pointer before copying the target material inline.

## Two loads

- **Context load** is material loaded on every turn, such as `AGENTS.md` or a
  skill description.
- **Cognitive load** is the human cost of knowing which documents exist and
  when to use them.

Keep standing rules in `AGENTS.md` only when they apply broadly. Put branch-
specific detail behind a clear pointer. Do not add a pointer merely to avoid
writing a sentence the agent needs on every relevant task.

## Information hierarchy

Keep ordered actions in the main document. Keep reference rules below the
actions, and disclose material used by only some branches in a pointed-to file.
Co-locate a concept's definition, rules, and caveats instead of scattering one
meaning across several sections.

## Steps and completion

Every ordered step needs a checkable completion criterion. Prefer criteria that
are both clear and exhaustive: the agent should know what done means and what
work must be accounted for. A vague phrase such as "understanding reached"
invites premature completion.

## Pruning

- Keep each meaning in one authoritative location.
- Treat `package.json`, config files, directory layout, and command help as
  environment truth. A document that merely repeats a cheap lookup is a stale
  cache.
- Delete irrelevant, stale, or no-op sentences instead of softening them.
- Prefer positive target behavior over a prohibition when both are possible.
- Use established leading words such as `seam`, `red`, or `tracer bullet` when
  they compress a repeated behavior without hiding its meaning.

## OpenCode skill mechanics

- Project skills live at `.opencode/skills/<name>/SKILL.md`.
- The frontmatter `name` must match the directory name.
- `description` is required and should state both what the skill does and when
  to use it. Use `Use ONLY when` when a skill must not trigger on adjacent work.
- OpenCode does not use the upstream `agents/openai.yaml` or Claude plugin
  manifests. Do not copy those files as if they controlled OpenCode.
- OpenCode does not automatically parse file references in `AGENTS.md`. For a
  lazy reference, explicitly tell the agent to read an `@path/to/file.md`
  mention; use `opencode.json`'s `instructions` field when a file must load on
  every session.
- If a skill depends on another skill, name that dependency explicitly and
  ensure the local dependency is installed. Do not assume the pointer loads it.

When changing a skill, check its description, body, references, and any
`AGENTS.md` or README pointer that names it. Preserve the repo's established
workflow rather than importing a larger process just because the source skill
contains one.
