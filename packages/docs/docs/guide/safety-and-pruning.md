---
title: Safety & Pruning
---

# Safety & Pruning

Install defaults
- Prune is enabled by default (like package managers). Extraneous entries are
  removed after an interactive confirmation.
- Use `-y` to skip prompts, or `--no-prune` to keep extra entries.
- Always preview with `--dry-run` to review the plan.

Lock policies
- `--lockfile-only`: write a clean snapshot without applying changes.
- `--frozen-lockfile`: require the lock to match desired; if matches, apply
  strictly from lock and do not write.
- `--from-lock`: ignore config and apply strictly from lock snapshots.

Idempotency
- Re‑running install on an already synchronized setup produces a plan of `SKIP`
  actions and no changes are applied.

Recommendations
- Start with project scope, then apply user scope if needed.
- Review doctor output for permissions and conflicts before CI integration.

