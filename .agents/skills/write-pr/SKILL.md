---
name: write-pr
description: Write or revise T3 Code pull request titles and bodies with concise explanations, small before/after sketches, and concrete evidence. Use for PR descriptions, not contribution moderation or code review.
---

# Write a PR

Read the final diff, the repository's PR template if present, and the relevant
[contribution requirements](../../../CONTRIBUTING.md). Describe the resulting
change for a reviewer who has not read the conversation.

## Explain the change

- Use a conventional commit title that names the concrete fix or resulting behavior.
- Lead with the failure or need, then explain the change and its purpose. Prefer
  one or two short paragraphs for a small fix. Use bullets when they make parallel
  changes easier to compare.
- Describe the final aggregate diff. Omit agent process, intermediate commits,
  abandoned approaches, and how much larger an earlier version was.
- Link required issue triage or maintainer approval when applicable. Avoid policy
  boilerplate: explain the actual defect and scope instead of narrating submission rules.

## Show the smallest useful view

Use a short diff sketch, sample output, call tree, or Mermaid diagram when it
explains the change faster than prose. Keep only the calls, states, or boundaries
needed to understand the change; place the sketch beside the explanation.
Do not add a diagram just to fill a template.

For example, a protocol-handler fix can be explained with:

```text
Before: electron.exe <callback-url>
After:  electron.exe <app>/main.cjs <callback-url>
```

Use before/after images for visual changes and a short recording when timing or
interaction matters, following the repository's evidence rules. For a performance
claim, show comparable target-branch and PR results in a small table, with the
measurement and environment needed to interpret them.

## Give concrete evidence

Keep verification brief, but retain the evidence required by CONTRIBUTING.md.
Explain what failed before and what worked afterward. A focused regression that
fails without the fix and passes with it is useful evidence; a bare “tests pass”
is not. Include relevant check commands or identifiable suites and results.

Distinguish actual platform testing from mocked or synthetic checks. Incorporate
platform verification supplied by the maintainer without treating the machine
used to submit the PR as the only test environment. Do not invent reproduction
details, screenshots, results, or successful runs. State material gaps plainly.

## Scale detail to the risk

Explain affected clients, providers, or connection modes when they help assess
the scope. Describe rollback constraints and possible impact when a change has
destructive, persistent, or difficult-to-reverse effects. Small reversible fixes
do not need a ceremonial risk section or a fixed multi-section template.

End with the model and harness attribution required by this repository, using
the actual model and harness that did the work.

Adapted from [mattpocock/skills' pr skill](https://github.com/mattpocock/skills/blob/v1.3.0/skills/engineering/pr/SKILL.md)
and the supplied writing-pr guidance. The visual approach in Matt's skill credits
[Dex Horthy's show-me skill](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md).
