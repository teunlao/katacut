---
title: ci
---

# ci

CI check: verify the current state against `katacut.lock.json`.

Usage
```
kc ci [options]
```

Behavior
- Reads the lockfile and uses the selected client to read current project/user states.
- Exits non‑zero on mismatches.

Options
- `--client <id>`: Client adapter used to read current state.
- `--file <path>`: Lockfile path (defaults to `katacut.lock.json`).

Exit codes
- 0: ok
- 1: mismatch

