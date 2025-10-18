---
title: Scopes & Clients
---

# Scopes & Clients

Scopes
- project: configuration files inside the repository (e.g. `./.mcp.json`, `./.gemini/settings.json`).
- user: global user configuration (paths depend on the client and OS).

Selecting clients
- Put target client IDs into `clients: string[]` at the top level of `katacut.config.jsonc`.
- `--client <id>` / `--clients a,b` act as a filter subset of `config.clients`.
- If `config.clients` is not set, pass a client via `--client` for a single‑run bootstrap.

Missing clients
- By default, a missing client does not fail the command; it is reported as skipped.
- A strict mode flag may be added to fail on missing clients in CI.

