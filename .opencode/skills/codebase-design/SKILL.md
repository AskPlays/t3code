---
name: codebase-design
description: Reference for module, interface, depth, seam, adapter, locality, and leverage vocabulary. Use when choosing or reviewing a module shape, not to start an unrequested redesign.
---

Use this as a reference, not as a task runner. It supplies the vocabulary for
design discussions and stops there.

## Vocabulary

- **Module** - anything with an interface and an implementation: a function,
  class, package, or slice across layers.
- **Interface** - everything a caller must know to use a module correctly:
  types, invariants, ordering, error modes, required configuration, and
  relevant performance behavior.
- **Depth** - how much behavior a caller can access per unit of interface they
  must learn. A deep module hides substantial behavior behind a small interface.
- **Seam** - the place where behavior can be changed without editing the code
  at the call site. A seam is the location of an interface, not a synonym for
  every boundary in the system.
- **Adapter** - a concrete implementation that satisfies an interface. An
  in-memory fake and a production database adapter can both be adapters.
- **Leverage** - the capability callers get from a deep interface.
- **Locality** - the concentration of change, bugs, and verification in one
  place.

## Design checks

- **Deletion test** - if the module disappeared, would its complexity vanish or
  spread across every caller? A pass-through module is not earning its seam.
- **Interface as test surface** - callers and tests should cross the same seam.
  Tests that reach behind it are evidence that the interface is misplaced or
  too shallow.
- **One adapter means a hypothetical seam** - do not add indirection for a
  variation that does not exist. A second adapter is evidence that the seam is
  real.
- **Depth belongs to the interface** - internal decomposition is compatible with
  a deep public module. Do not judge depth by implementation line count.

When a design question is still open, use the repo's `grill` skill to interview
the user. When a concrete behavior needs testing, use `tdd` at an agreed public
seam. Do not turn this reference into an autonomous refactoring session.
