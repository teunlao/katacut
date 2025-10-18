---
title: install (i)
---

# install (alias: i)

Apply the desired MCP state from `katacut.config.jsonc` to selected clients.
By default, removes extraneous entries (prune) with interactive confirmation.

Usage
```
ktc install|i [options]
```

Key behavior
- Deterministic plan: prints a JSON plan and a human summary table.
- Prune by default: extraneous entries are removed after confirmation.
- Lockfile: after successful apply, writes a clean snapshot (no merge).

Options
- `-c, --config <path>`: Config file path (default autodetect).
- `--scope <scope>`: `project` (default) or `user`.
- `--client <id>` / `--clients <a,b>`: Filter subset of `config.clients`.
- `--dry-run`: Print plan without applying changes.
- `--no-prune` (or `--prune`): Disable (or enable) removing extraneous entries. Default: prune enabled.
- `-y, --yes`: Skip confirmation prompts (non‑interactive).
- `--no-write-lock`: Do not write `katacut.lock.json` after apply.
- `--lockfile-only`: Generate/refresh the lockfile without applying.
- `--frozen-lockfile`: Require lockfile to match config; if matches, apply strictly from lock without writing.
- `--from-lock`: Ignore config and apply strictly from `katacut.lock.json`.
- `--json` / `--no-summary`: Machine‑readable output controls.
- `--local`: Apply locally only (do not change config/lock); still records state.

Examples
```
# Preview changes for project scope
ktc i --dry-run --scope project

# Apply with confirmation on removals (default)
ktc i --scope user

# Apply without prompts
ktc i -y

# From lockfile strictly (no write)
ktc i --frozen-lockfile

# Lockfile only
ktc i --lockfile-only

# Disable pruning
ktc i --no-prune
```

Exit codes
- 0: success (including missing clients by default)
- 1: failures during apply or frozen/from‑lock mismatch
