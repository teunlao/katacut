Окей, собрал «боевой» конспект по MCP из спеки и актуальных гайдов — чтобы дальше проектировать KataCut без сюрпризов.

TL;DR
	•	MCP = протокол на JSON-RPC 2.0, с двумя стандартными транспортами: stdio (локально) и Streamable HTTP (удалённо). SSE исторически встречается, но сейчас фокус на Streamable HTTP.  ￼
	•	Сервер может отдавать четыре ключевые «формы» возможностей: tools, resources, prompts, sampling.  ￼
	•	Жизненный цикл: initialize → operation → shutdown, с переговором возможностей и версии протокола при старте.  ￼

⸻

Транспорты
	•	stdio — простой локальный процесс, минимальная латентность, без сети. Рекомендуется поддерживать в клиентах «когда возможно».  ￼
	•	Streamable HTTP — современный удалённый вариант; поддерживает потоковое взаимодействие. Для входящего канала сервер может держать SSE-stream (Accept: text/event-stream) — сейчас это часть «streamable HTTP» модели.  ￼

⸻

Формы/возможности сервера

1) Tools

Сервер объявляет набор инструментов (имя + схема входа/метаданные). Клиент делает:
	•	tools/list → получить список инструментов
	•	tools/call → вызвать инструмент по имени с аргументами (JSON Schema)  ￼

2) Resources

Read-only контент по URI (статический или динамический), для контекста модели:
	•	resources/list → перечислить
	•	resources/read → получить содержимое
	•	Подписки: resources/subscribe / resources/unsubscribe; при изменениях сервер шлёт уведомление notifications/resources/updated.  ￼

3) Prompts

Параметризуемые шаблоны подсказок/workflow:
	•	prompts/list → доступные шаблоны
	•	prompts/get → получить заполненный шаблон (с учётом аргументов)  ￼

4) Sampling

Сервер может просить клиента сделать выборку у LLM (то есть «комплишн» выполняет клиент, ключи/модели остаются у него):
	•	стандарт описывает вызов выборки и расширения (текст/аудио/изображения), при этом клиент управляет доступом/моделями. Подходит для «агентских» сценариев без утечки API-ключей на сервер.  ￼

⸻

Формат сообщений
	•	JSON-RPC 2.0, UTF-8. Базовые типы: request, response, notification. MCP добавляет доменные методы (см. выше).  ￼

⸻

Жизненный цикл сессии
	1.	Initialization — переговор возможностей (какие формы доступны: tools/resources/prompts/sampling), номер ревизии спецификации.
	2.	Operation — обычные вызовы; при HTTP возможны стримы/уведомления.
	3.	Shutdown — корректное закрытие.
Сессии stateful; при потере — клиент должен корректно реинициализироваться.  ￼

⸻

Настройки/параметры, которые обычно указывают
	•	Для tools: имя, описание, JSON Schema для arguments; иногда — политика/ограничения.  ￼
	•	Для resources: URI-схема, поддержка subscribe/listChanged, формат контента.  ￼
	•	Для prompts: список параметров, шаблон сообщений, возможные связи с tools/resources.  ￼
	•	Для HTTP транспорта: базовый URL, заголовки (Authorization, др.), политика доменов; для stdio — command/args. (Это попадает в конфиги клиентов/реестровые манифесты.)  ￼

⸻

Экосистема/инструменты
	•	MCP Inspector — интерактивный инструмент, помогает тестировать сервер (поддерживает stdio и HTTP, выдаёт готовые вставки для mcp.json).  ￼
	•	Клиенты/IDE: Claude Code (CLI-мастер claude mcp add), Cursor (.cursor/mcp.json), VS Code (.vscode/mcp.json или команда “MCP: Add Server”), Visual Studio (несколько локаций mcp.json). Это данность, которую мы будем закрывать в KataCut.  ￼

⸻

Почему это важно для KataCut
	•	Мы можем брать нормализованные манифесты (из community/GitHub-реестров) и превращать их в установку «в один шаг» во все найденные клиенты, не заставляя пользователя читать разношёрстные доки.
	•	Поддержим оба транспорта и все формы (tools/resources/prompts/sampling), включая подписки на ресурсы и прогресс/уведомления — это важно для UX и «агентских» сценариев.  ￼

⸻

Мини-чек-лист готовности сервера (по спеке)
	•	Объяви возможности (какие формы поддерживаешь) при initialize.  ￼
	•	Для stdio — корректно читай/пиши JSON-RPC в stdout/stdin; для HTTP — реализуй endpoint’ы, поддержи потоковые ответы/уведомления.  ￼
	•	Проверь tools/list, tools/call; resources/list/read/(un)subscribe; prompts/list/get; sampling.  ￼
	•	Прогоняй MCP Inspector и следи за корректной реинициализацией сессий.  ￼

Если нужно, разверну это в «памятку разработчика» с JSON-RPC примерами (tools/call, resources/subscribe, prompts/get, sampling/createMessage) и минимальными конфигами для stdio/HTTP.

Ок, вот шпаргалка по полям конфигурации MCP в основных клиентах и как это настраивается на практике.

⸻

VS Code (.vscode/mcp.json или профиль пользователя)

Структура файла

{
  "servers": { /* список серверов */ },
  "inputs": [ /* опционально: запросы секретов */ ]
}

STDIO-сервер

"servers": {
  "my-local": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y","@modelcontextprotocol/server-memory"],
    "env": { "API_KEY": "${input:api-key}" },
    "envFile": "${workspaceFolder}/.env"
  }
}

HTTP/SSE-сервер

"servers": {
  "github-mcp": {
    "type": "http",         // или "sse" (legacy)
    "url": "https://api.githubcopilot.com/mcp",
    "headers": { "Authorization": "Bearer ${input:token}" }
  }
}

inputs (встроенные промпты для секретов)

"inputs": [
  { "type":"promptString","id":"token","description":"GitHub PAT","password":true }
]

Дополнительно: есть автозаполнение схемы, CLI-добавление code --add-mcp '{"name":...}', авто-дискавери из других тулов, dev-поля (dev.watch, dev.debug), настройки политики (chat.mcp.access, галерея, discovery). Поля и примеры задокументированы в официальном гиде VS Code.  ￼

⸻

Visual Studio (Windows)

Где лежит конфиг:
%USERPROFILE%\.mcp.json (глобально), <SOLUTION>\.vs\mcp.json (user-для решения), <SOLUTION>\.mcp.json, и даже <SOLUTION>\.vscode\mcp.json — VS читает их в порядке приоритета. Форма записи такая же, как у VS Code (servers, type/command/args или type/url/headers). Можно добавлять из окна чата.  ￼

⸻

Cursor (~/.cursor/mcp.json или <repo>/.cursor/mcp.json)

Базовая форма

{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y","github-mcp-server"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PERSONAL_ACCESS_TOKEN}" }
    },
    "remote": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${env:API_TOKEN}" }
    }
  }
}

Что поддерживает Cursor в mcp.json: ключи command, args, env, а для HTTP — url, headers. Переменные можно подставлять в эти поля (например, ${env:NAME}). Также у Cursor есть Extension API для программной регистрации без правки файла.  ￼

Отличие от VS Code: у Cursor нет встроенного inputs (промптов для секретов) — рекомендуют либо прокидывать ENV, либо оборачивать команду в скрипт-лоадер .env (например, npx envmcp …).  ￼

⸻

Claude Code (через CLI, опционально .mcp.json по scope)

Добавление серверов (три транспорта):

# HTTP (рекомендуется)
claude mcp add --transport http <name> <url>

# SSE (устаревающее, но поддерживается)
claude mcp add --transport sse <name> <url> --header "X-API-Key: ..."

# STDIO (локальный процесс)
claude mcp add --transport stdio <name> -- <command> [args...]
# пример: claude mcp add --transport stdio github -- npx -y github-mcp-server

Scope установки: user / project / local (файловый .mcp.json в корне проекта создаётся/обновляется автоматически). Управление — claude mcp list/remove. Это всё описано в официальных доках Claude Code по MCP/CLI.  ￼

⸻

Резюме полей (по клиентам)
	•	Общее (везде):
	•	STDIO: type:"stdio", command, args?, env?
	•	HTTP/SSE: type:"http"|"sse", url, headers?
	•	VS Code доп.: inputs (promptString), envFile, dev.watch, dev.debug, установка code --add-mcp, политики chat.mcp.*.  ￼
	•	Visual Studio доп.: множественные локации mcp.json, чтение .vscode/mcp.json.  ￼
	•	Cursor доп.: подстановка переменных в command/args/env/url/headers, Extension API; нет inputs.  ￼
	•	Claude Code доп.: установка только через CLI claude mcp add с --transport и --scope, поддержка --env/--header.  ￼


