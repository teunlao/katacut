Окей, вот сжатая «памятка» по MCP и Claude Code — только факты и примеры.

⸻

1) Спецификация MCP (актуально на ревизии 2025-06-18)

Транспорты
	•	stdio — локальный процесс через stdin/stdout. Клиенты SHOULD поддерживать, когда возможно.  ￼
	•	Streamable HTTP — HTTP POST/GET; сервер может опционально стримить сообщения через SSE. Это текущая HTTP-модель.  ￼
	•	Отдельный «SSE-транспорт» — деприкейтед: используйте Streamable HTTP.  ￼

Что описывает спека, а чего — нет
	•	Спека фиксирует примитивы и методы (tools/*, resources/*, prompts/*, client-side sampling), JSON-RPC 2.0, lifecycle init/negotiation.  ￼
	•	Файлы конфигурации клиентов (полями command/url/args/env) — не часть спеки, это формат конкретных клиентов (VS Code, Cursor, Claude и т.д.). Поэтому «обязательные/опциональные» поля зависят от клиента.  ￼

⸻

2) Поля конфигов по клиентам (что реально пишется)

VS Code (.vscode/mcp.json или пользовательский mcp.json)

{
  "servers": {
    "github-mcp": { "type": "http", "url": "https://api.githubcopilot.com/mcp" },
    "local": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y","@modelcontextprotocol/server-filesystem"],
      "env": { "ROOT": "${workspaceFolder}" },
      "envFile": "${workspaceFolder}/.env"
    }
  },
  "inputs": [
    { "type": "promptString", "id": "token", "description": "GitHub PAT", "password": true }
  ]
}

Поля: type: "http"|"stdio", для HTTP — url, headers?; для stdio — command, args?, env?; VS Code поддерживает inputs, envFile, добавление через команду MCP: Add Server.  ￼

Visual Studio (Windows)

Читает те же поля, ищет конфиги в нескольких местах: глобально %USERPROFILE%\.mcp.json, на уровень solution (<SOLUTION>\.mcp.json), и т.п.; также понимает .vscode/mcp.json.  ￼

Cursor (~/.cursor/mcp.json или <repo>/.cursor/mcp.json)

{
  "servers": {
    "github": { "command": "npx", "args": ["-y","github-mcp-server"] },
    "remote": { "type": "http", "url": "https://example.com/mcp", "headers": { "Authorization": "Bearer ${env:TOKEN}" } }
  }
}

Поддерживает command/args/env (stdio) и type/url/headers (http); переменные окружения можно подставлять.  ￼

⸻

3) Claude Code (CLI и конфиги)

Добавление серверов

# HTTP (рекомендуется)
claude mcp add --transport http <name> <url>

# SSE (поддерживается, но помечен как deprecated в гайдах)
claude mcp add --transport sse <name> <url> --header "X-API-Key: ..."

# STDIO (локальный процесс)
claude mcp add --transport stdio <name> -- <command> [args...]
# напр.: claude mcp add --transport stdio github -- npx -y github-mcp-server

Есть также claude mcp add-json <name> '<json>' для прямой подачи JSON-конфига (type/url/headers или type:"stdio"/command/args/env).  ￼

Scopes
	•	--scope user | project | local
Project: записывает .mcp.json в корень проекта (шарится в VCS).
User: пользовательская конфигурация (хранение реализовано вне .mcp.json; в паблик-источниках часто упоминают ~/.claude.json). Точный путь для user-scope в официальных доках не зафиксирован, но сам флаг документирован.  ￼

Формат проектного файла (Claude Code)

{
  "mcpServers": {
    "shared-server": {
      "type": "stdio",
      "command": "/path/to/server",
      "args": [],
      "env": {}
    }
  }
}

(Автогенерируется при --scope project.)  ￼

Дополнительно
	•	Поддерживается расширение переменных в .mcp.json: ${VAR} и ${VAR:-default} для command/args/env и также для url/headers у HTTP.  ￼

⸻

4) MCP Inspector / примеры JSON для сверки

Inspector запуск

# инспектировать npm-сервер
npx -y @modelcontextprotocol/inspector npx @modelcontextprotocol/server-filesystem /path
# инспектировать локальный сборочный файл
npx @modelcontextprotocol/inspector node path/to/server/index.js --flag

В UI можно выбрать транспорт (stdio/http), задать env/аргументы, гонять tools/resources/prompts.  ￼

Мини-шаблоны конфигов (универсально читаемы клиентами)

HTTP:

{ "mcpServers": { "github": { "type": "http", "url": "https://api.githubcopilot.com/mcp", "headers": { } } } }

STDIO:

{ "mcpServers": { "local-fs": { "type": "stdio", "command": "npx", "args": ["-y","@modelcontextprotocol/server-filesystem","${HOME}"], "env": {} } } }

(Аналогичные примеры даёт VS Code/Visual Studio для servers-формата.)  ￼

⸻

Короткие выводы
	•	Официальные транспорты: stdio и Streamable HTTP; отдельный SSE как транспорт — устаревший, но SSE используется внутри HTTP для стриминга.  ￼
	•	Поля конфигов зависят от клиента:
HTTP → type/url/headers; STDIO → type/command/args/env; VS Code ещё даёт inputs/envFile.  ￼
	•	Claude Code: claude mcp add с --transport, --scope, --env, --header, есть add-json; проектный .mcp.json создаётся в корне.  ￼


https://modelcontextprotocol.io/specification/2025-06-18/server/tools?utm_source=chatgpt.com
