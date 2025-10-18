---
title: mcp
---

# mcp

MCP utilities for listing, adding, and removing servers in client configs.

## mcp list
```
kc mcp list --client <id> [--scope project|user]
```
Behavior
- Reads project `./.mcp.json` (or client‑specific files) and user config files.
- Prints a JSON object with sources and discovered `mcpServers`.

## mcp add
```
kc mcp add <source>
```
`<source>` may be:
- A registry URL
- A short server name (resolved via registry search)
- A full name@version (pin for stdio packages)
- A direct server URL (HTTP/SSE) or package (stdio)

Flags
- `--scope project|user`
- Client selection flags as in `install` (filter subset of `config.clients`).

## mcp remove
```
kc mcp remove <name> [--scope project|user]
kc mcp remove --local <name>
```
Behavior
- Default: edits config and applies removal to clients; updates lock and state.
- `--local`: only at client (keeps config/lock intact); writes project state record.

