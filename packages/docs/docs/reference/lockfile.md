---
title: Lockfile (katacut.lock.json)
---

# Lockfile (katacut.lock.json)

Format (v1)
```json
{
  "version": "1",
  "clients": ["claude-code", "gemini-cli"],
  "mcpServers": {
    "<name>": {
      "scope": "project" | "user",
      "fingerprint": "sha256:...",
      "resolvedVersion": "...optional...",
      "snapshot": { /* normalized server JSON */ }
    }
  }
}
```

Behavior
- `kc install --lockfile-only` writes a clean snapshot (no merge).
- `kc install` writes a clean snapshot after successful apply (unless `--no-write-lock`).
- `kc install --frozen-lockfile` requires the current desired state to match the lock and applies strictly from lock without writing.
- `kc install --from-lock` ignores config and applies strictly from lock snapshots.

Verification
- `kc lock verify` compares current state (project/user) with the lock and reports mismatches (`missing`, `fingerprint`, `scope`, `extra`).
