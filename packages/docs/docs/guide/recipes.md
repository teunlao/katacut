---
title: Recipes
---

# Recipes

Add two servers and apply to project
```bash
echo '{
  "version":"0.1.0",
  "clients":["claude-code","gemini-cli"],
  "mcp":{
    "github":{"transport":"http","url":"https://api.githubcopilot.com/mcp"},
    "fs":{"transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}
  }
}' > katacut.config.jsonc

ktc install --scope project
```

Remove everything from project (prune)
```bash
jq '.mcp={}' katacut.config.jsonc > katacut.config.tmp && mv katacut.config.tmp katacut.config.jsonc
ktc install --scope project -y
```

CI verify
```bash
ktc lock generate --out katacut.lock.json
ktc ci
```

