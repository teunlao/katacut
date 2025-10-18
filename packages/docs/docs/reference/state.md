---
title: State File (.katacut/state.json)
---

# State File (.katacut/state.json)

KataCut writes a lightweight local state in the repository to help diagnostics
(`ktc doctor`) and auditing. The file is located at `./.katacut/state.json`.

Structure (example)
```json
{
  "runs": [
    {
      "at": "2025-10-18T18:00:00.000Z",
      "client": "claude-code",
      "requestedScope": "project",
      "realizedScope": "project",
      "mode": "native",
      "intent": "project",
      "result": { "added": 1, "updated": 0, "removed": 0, "failed": 0 },
      "entries": [
        {
          "name": "github",
          "action": "add",
          "from": null,
          "to": { "type": "http", "url": "https://…" },
          "scope": "project"
        }
      ]
    }
  ]
}
```

Notes
- The state is append‑only and not required for operation; it is used for
  human‑friendly history and doctor recommendations.
- The file is safe to delete; it will be recreated on the next successful
  install.

