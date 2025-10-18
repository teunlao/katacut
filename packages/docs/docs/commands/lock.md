---
title: lock
---

# lock

Lockfile utilities.

## lock generate
```
ktc lock generate [options]
```
Options
- `-c, --config <path>`: Config file path.
- `--client <id>` / `--clients <a,b>`: Validate adapters exist; the snapshot is shared across clients.
- `--scope <scope>`: Scope of desired snapshot (`project` default).
- `--out <path>`: Write to path (prints to stdout if omitted).

Behavior
- Produces a clean snapshot (no merge) for the selected clients and scope.

## lock verify
```
ktc lock verify [options]
```
Options
- `--file <path>`: Path to `katacut.lock.json` (default).
- `--client <id>`: Client used to read current project/user state for verification.

Behavior
- Compares the lock snapshot against current `project` and `user` states.
- Reports `ok` or `mismatch` with detailed reasons (missing, fingerprint, scope, extra).

Exit codes
- 0: ok
- 1: mismatch
