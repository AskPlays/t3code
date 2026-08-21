---
name: tdd
description: Test-driven development with a red-green loop for the Vitest suite. Use when building features or fixing bugs test-first, or when the user asks for tests or wants behavior verified through public interfaces.
---

TDD is the red → green loop. A good test verifies behavior through a public interface, not implementation details — it reads like a specification and survives refactors because it doesn't care about internal structure. run with `npm test` (Vitest) or `npm run test:watch`.

## Seams — where tests go

A seam is the public boundary you test at. **Test only at pre-agreed seams:** before writing any test, state the seams under test and confirm them with the user. No test is written at an unconfirmed seam. Agreeing the seams up front is how testing effort lands on critical paths and complex logic instead of every edge case.

## Anti-patterns (avoid)

- Implementation-coupled — mocks internal collaborators, tests private methods, or verifies through a side channel (querying the DB instead of the interface). Tell: the test breaks on refactor while behavior is unchanged.
- Tautological — the assertion recomputes the expected value the way the code does, so it passes by construction and can never disagree. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- Horizontal slicing — writing all tests first, then all implementation. Bulk tests verify imagined behavior and commit you to test structure before you understand the code. Work in vertical slices instead.

When the shape of the interface is itself in question — how deep the module is, where the seam belongs, or what the interface should expose — consult the `codebase-design` skill for vocabulary. It is a reference, not a redesign command.

## Rules of the loop

- Red before green: write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- One slice at a time: one seam, one test, one minimal implementation per cycle. Each test is a tracer bullet that responds to what the last cycle taught you.
- Refactoring is NOT part of the loop — it belongs to the review stage, not the red→green cycle.

## Completion criterion

Every pre-agreed seam has a passing test that fails when the behavior it specifies is broken, and the full suite (`npm test`) is green.
