---
title: Config (katacut.config.*)
---

# Config (katacut.config.*)

Top‑level fields
- `version: string` — configuration schema version (e.g. `"0.1.0"`).
- `clients?: string[]` — list of client IDs to target (e.g. `"claude-code"`, `"gemini-cli"`).
- `mcp: Record<string, Server>` — desired MCP servers by name.

Server types
- HTTP
  - `transport: "http"`
  - `url: string`
  - `headers?: Record<string, string>` (normalized; empty headers are omitted in snapshots)
- SSE (if supported by a client)
  - `transport: "sse"`
  - `url: string`
  - `headers?: Record<string, string>`
- STDIO
  - `transport: "stdio"`
  - `command: string`
  - `args?: string[]`
  - `env?: Record<string, string>` (normalized; empty env omitted)

Example
```jsonc
{
  "version": "0.1.0",
  "clients": ["claude-code", "gemini-cli"],
  "mcp": {
    "github": { "transport": "http", "url": "https://api.githubcopilot.com/mcp" },
    "fs": { "transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] }
  }
}
```

Notes
- The `clients` list defines the target adapters; flags `--client/--clients` only narrow this set.
- Missing clients do not fail commands by default.

