---
title: Clients & Paths
---

# Clients & Paths

KataCut targets multiple MCP‑capable clients. This page summarizes known
capabilities and locations used by adapters.

Supported clients (MVP)
- claude-code
  - Project scope: `./.mcp.json`
  - User scope (discovery candidates, OS‑dependent):
    - macOS/Linux (home): `~/.claude/settings.json`, `~/.claude.json`
    - XDG: `~/.config/claude/settings.json`, `~/.config/claude/config.json`
    - Windows: `%USERPROFILE%/.claude/settings.json`, `%USERPROFILE%/.claude.json`, `%APPDATA%/Claude/settings.json`
  - Enterprise managed (read‑only, if present): may override user settings.
- gemini-cli
  - Project scope: `./.gemini/settings.json`
  - User scope: `~/.gemini/settings.json` (Windows: `%USERPROFILE%/.gemini/settings.json`)
  - Enterprise managed (read‑only, if present):
    - macOS: `/Library/Application Support/GeminiCli/settings.json`
    - Linux/WSL: `/etc/gemini-cli/settings.json`
    - Windows: `C:\\ProgramData\\gemini-cli\\settings.json`

Notes
- Adapters read project/user files and treat enterprise paths as read‑only diagnostics.
- Write operations are scoped to project or user files only and use atomic write (temp + rename) when applicable.

