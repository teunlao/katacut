---
title: doctor
---

# doctor

Diagnose environment and client availability.

Usage
```
ktc doctor [options]
```

Behavior
- Checks presence of selected clients in PATH and readable/writable locations.
- Prints a per‑client summary and recommendations.

Common options
- `--client <id>` / `--clients <a,b>`: Filter subset of `config.clients`.
- `--json` / `--no-summary`: Output controls.

Exit codes
- 0: diagnostic completed (warnings allowed)
- 1: strict mode (future flag) may fail on missing clients
