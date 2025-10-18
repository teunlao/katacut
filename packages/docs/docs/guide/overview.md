---
title: Overview
---

# KataCut: Overview

KataCut is a unified CLI that brings IDE/CLI clients with MCP support into a
desired state described by a single configuration file: `katacut.config.jsonc`.

Core principles
- Single source of truth: the config file defines desired MCP servers.
- Deterministic and idempotent install: repeatable, safe operations.
- Lockfile snapshot: `katacut.lock.json` captures the exact desired state.
- Multi‑client: one config can target multiple clients (e.g. `claude-code`, `gemini-cli`).

Quick start
```bash
# 1) Add desired servers to katacut.config.jsonc
# 2) Apply to project scope (prune by default with confirmation)
pnpm kc install --scope project

# 3) Generate lockfile
pnpm kc lock generate --out katacut.lock.json

# 4) Verify in CI
pnpm kc ci
```

Next steps
- Read about scopes and client selection.
- Explore command reference for all flags and workflows.

