Отлично, двигаем это в “боевой” v0.1. Ниже — **что делать дальше** (по приоритету), с чёткими критериям готовности и источниками, чтобы ты не сомневался, что мы попадаем в реальность экосистемы.

---

## 1) Закрыть конфиг и валидацию

**Задачи**

* Зафиксировать формат `katacut.config.jsonc` (JSONC): парсим через `jsonc-parser`, валидируем через **AJV** по JSON Schema 2020-12.
* В схеме описать: `clients[]`, `profiles{}`, `mcp.servers{}`, `env/permissions`, `secrets`, `dev`, `telemetry`.
* Вынести `$schema` (версионирование схемы), строгие enum’ы для `transport` (stdio/http).

**DoD**

* `@katacut/schema`: схема + типы, `ajv` компиляция, читаемые ошибки.
* Snapshot-тесты на валидные/невалидные примеры.

**Релевантные доки:** JSONC-парсер (MS) и AJV (поддержка draft 2020-12). ([GitHub][1])

---

## 2) Реальный планировщик (core)

**Задачи**

* Модель `SyncPlan`: цели на клиенты, источники (registry), профили, дифф с существующими файлами.
* Idempotent-логика (повторный `sync` → ноль изменений), `--dry-run` с цветным `diff`.

**DoD**

* Юнит-тесты на план/дифф (без I/O), простые “golden fixtures”.

*(Hexagonal: core без `fs/exec` — всё через порты.)*

---

## 3) Первые адаптеры клиентов (минимум 2)

**Cursor**

* Писать проектный/глобальный `.cursor/mcp.json`. У Cursor есть Extension API для программного добавления — но на v1 хватит записи файла. ([Cursor][2])

**VS Code (Copilot)**

* Предпочесть официальный путь: `MCP: Add Server` / `code --add-mcp` и `.vscode/mcp.json`/user-profile `mcp.json`. ([Visual Studio Code][3])

**DoD**

* Контракт-тесты: из одного конфига генерятся корректные таргеты для обоих клиентов.

*(Далее добавим Visual Studio и Claude Code.)*

**Visual Studio** — поддержать набор локаций `%USERPROFILE%\.mcp.json`, `<SOLUTION>\.mcp.json` и др. ([Microsoft Learn][4])
**Claude Code** — автоматизировать через `claude mcp add …` (wizard). ([Claude Docs][5])

---

## 4) Интеграция с реестрами MCP

**Задачи**

* Резолв серверов из **GitHub MCP Registry** (официальный) + community-registry: slug → `{command/args/url/transport}`. ([The GitHub Blog][6])

**DoD**

* `@katacut/registry-github`: поиск, нормализация манифестов, кэш.
* `katacut add <server>` автозаполняет блок из реестра.

---

## 5) Секреты и окружение (bridge)

**Задачи**

* 1Password: `op run`/`op inject` для env и шаблонов конфигов. ([developer.1password.com][7])
* Doppler: `doppler run -- <cmd>` для локали/CI. ([Doppler][8])
* Dev-окружение: генерация `devcontainer.json` и/или `.envrc` (direnv). ([Visual Studio Code][9])

**DoD**

* `secrets-1password`/`secrets-doppler` адаптеры; E2E моки подтверждают, что CLI видит нужные env.

---

## 6) `katacut sync` (применение плана)

**Задачи**

* Применение по клиентам, профили (`--profile`), роллбек при ошибках.
* Логи: `{client, serverId, action, path}`.

**DoD**

* Смоук: “пустой проект → add github/playwright → sync → клиенты видят сервера”.
* В VS Code конфиг открывается/подсвечивается, как в доках. ([Visual Studio Code][3])

---

## 7) `katacut doctor`

**Задачи**

* Health-чек команд, путей, доступов; быстрый запуск тестовой сессии через **MCP Inspector** (с предупреждением по безопасности). ([Model Context Protocol][10])

**DoD**

* Отчёт: “что не так и как починить” (CLI/права/порты).

---

## 8) Телеметрия (встроенные метрики)

**Задачи**

* OTel GenAI: `gen_ai.client.token.usage`, `gen_ai.client.operation.duration`, `server.time_to_first_token` и пр.; экспорт OTLP (совместимо с Langfuse/Tempo). ([OpenTelemetry][11])

**DoD**

* Флаг `telemetry: { otel: true }` в конфиге; видны базовые метрики в локальном OTLP-коллекторе.

---

## 9) Тест-пирамида

* **Unit (schema/core)**, **contract** для адаптеров (golden JSON-фикстуры), **E2E-smoke** с tmp-директорией и моками внешних CLI.

---

## 10) Следом (v0.2+)

* **Visual Studio** адаптер (многолокационный `mcp.json`). ([Microsoft Learn][4])
* **Claude Code** автоматизация (серия `claude mcp add`). ([Claude Docs][5])
* **Lockfile** (хэши/версии MCP-пакетов) + подсветка дрейфа.
* **Preset-пакеты**: `@katacut/preset-dev` (Cursor+VS Code), `preset-win` (VS).
* **GUI-панель** позже (после стабилизации CLI).

---

### Почему именно так

* Мы целимся в официальные, уже существующие механизмы конфигурации MCP у клиентов: VS Code (`.vscode/mcp.json`/global и команды), Visual Studio (набор поддерживаемых путей), Cursor (`.cursor/mcp.json`), Claude Code (CLI-мастер). Это гарантирует, что `sync` не “ломает реальность”, а автоматизирует ручные шаги. ([Visual Studio Code][3])
* Реестры MCP (GitHub + community) — источник правды для установок/манифестов. ([The GitHub Blog][6])
* Секреты/окружение/телеметрия — стандартные инструменты, совместимые с индустрией (1Password/Doppler/DevContainers/direnv/OTel GenAI). ([developer.1password.com][7])

Если ок — я могу сразу выдать минимальный `katacut.config.jsonc` под **Cursor+VS Code** и показать результирующие файлы (`.cursor/mcp.json`, `.vscode/mcp.json`) после `kcut sync --dry-run`.

[1]: https://github.com/microsoft/node-jsonc-parser?utm_source=chatgpt.com "microsoft/node-jsonc-parser: Scanner and ..."
[2]: https://cursor.com/docs/context/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) | Cursor Docs"
[3]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Use MCP servers in VS Code"
[4]: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022&utm_source=chatgpt.com "Use MCP Servers - Visual Studio (Windows)"
[5]: https://docs.claude.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[6]: https://github.blog/ai-and-ml/github-copilot/meet-the-github-mcp-registry-the-fastest-way-to-discover-mcp-servers/?utm_source=chatgpt.com "Meet the GitHub MCP Registry: The fastest way to discover ..."
[7]: https://developer.1password.com/docs/cli/reference/commands/run/?utm_source=chatgpt.com "run | 1Password CLI"
[8]: https://docs.doppler.com/docs/accessing-secrets?utm_source=chatgpt.com "Secrets Access Guide"
[9]: https://code.visualstudio.com/docs/devcontainers/containers?utm_source=chatgpt.com "Developing inside a Container"
[10]: https://modelcontextprotocol.io/docs/tools/inspector?utm_source=chatgpt.com "MCP Inspector"
[11]: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/?utm_source=chatgpt.com "Semantic conventions for generative AI metrics"


Да, начинаем с **адаптера Claude Code**. Ниже — чёткий план v1: что именно делаем, какие команды вызываем, какие поля мэппим, и на что обратить внимание.

---

## Что должен уметь адаптер `@katacut/adapter-claude` (v1)

1. **Создание/обновление серверов MCP**

   * HTTP-сервер:
     `claude mcp add --transport http <name> <url> [--scope <local|project|user>]` ([Claude Docs][1])
   * SSE (устаревающий, но поддержим):
     `claude mcp add --transport sse <name> <url>` (лучше избегать — deprecated). ([Claude Docs][1])
   * stdio-сервер (локальный или через npx/uvx):
     `claude mcp add --transport stdio <name> -- <command> [args…]`
     (в доках есть аналоги; если конфигурация сложная — используем `add-json`, см. ниже). ([Claude Docs][1])

2. **Добавление из JSON** (сложные случаи: headers/env/комбинированные поля)

   * `claude mcp add-json <name> '<json>'` (поддерживает `type:http|stdio`, `url/headers` или `command/args/env`). ([Claude Docs][1])

3. **Скоупы установки**

   * `--scope local` (по умолчанию), `--scope project` (создаст/обновит `.mcp.json` в корне репо), `--scope user`. При `project` Claude сам ведёт **`.mcp.json`** стандартизированного вида. ([Claude Docs][1])

4. **Управление и диагностика**

   * Список/получение/удаление: `claude mcp list`, `claude mcp get <name>`, `claude mcp remove <name>`. ([Claude Docs][1])
   * Импорт из Claude Desktop (если надо): `claude mcp add-from-claude-desktop`. ([Claude Docs][1])

5. **Переменные окружения в `.mcp.json`**

   * Категории расширения: `command/args/env/url/headers`; синтаксис `${VAR}` и `${VAR:-default}`. (Важно для команд с токенами/базовыми URL.) ([Claude Docs][1])

6. **Альф-ограничения/нюансы**

   * SSE помечён как **deprecated** — предпочитаем HTTP или stdio. ([Claude Docs][1])
   * Для очень объёмных ответов MCP можно задать `MAX_MCP_OUTPUT_TOKENS` (иногда полезно в докторе/FAQ). ([Claude Docs][1])

---

## Мэппинг из `katacut.config.jsonc` → команды Claude

**Пример фрагмента конфига KataCut:**

```jsonc
{
  "mcp": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "scope": "user"
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y","@microsoft/mcp-playwright"],
      "env": { "PWDEBUG": "1" },
      "scope": "project"
    },
    "private-api": {
      "type": "http",
      "url": "https://api.company.com/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY}" },
      "scope": "project"
    }
  }
}
```

**Что вызовет адаптер:**

* `github` →
  `claude mcp add --transport http github https://api.githubcopilot.com/mcp/ --scope user` ([Claude Docs][1])
* `playwright` →
  `claude mcp add --transport stdio playwright --scope project -- npx -y @microsoft/mcp-playwright` ([Claude Docs][1])
* `private-api` (есть headers/env) → формируем JSON и:
  `claude mcp add-json private-api '{"type":"http","url":"https://api.company.com/mcp","headers":{"Authorization":"Bearer ${API_KEY}"}}'` (в проектный скоуп) ([Claude Docs][1])

> При `--scope project` Claude создаст/обновит `.mcp.json` в корне, где поддерживается **env-expansion**. ([Claude Docs][1])

---

## Интерфейс адаптера (внутри `@katacut/adapter-claude`)

```ts
export interface ClaudeAdapter {
  probe(): Promise<{ ok: boolean; version?: string }>; // проверка наличия `claude`
  plan(cfg: KatacutConfig): Promise<ClaudePlan[]>;     // набор действий по серверам
  apply(plan: ClaudePlan[], opts: { dryRun?: boolean }): Promise<ApplyResult>;
  list(): Promise<McpServerInfo[]>;                    // обёртка над `claude mcp list`
  remove(name: string): Promise<void>;                 // `claude mcp remove <name>`
}
```

* **`probe()`**: вызываем `claude --version` и/или `claude mcp list`; если нет — возвращаем actionable-ошибку (как поставить). ([Claude Docs][2])
* **`plan()`**: мэппинг `type/scope/url/command/args/env/headers` → либо `add`, либо `add-json`.
* **`apply()`**: исполняем команды (`child_process.spawn`) с логом `{client:"claude", action, name, scope}`; `--dry-run` показывает ровно те команды, что пойдут в shell.

---

## Тесты (контракт)

* **Golden-файлы**: входной конфиг → список ожидаемых CLI-команд (snapshot).
* **Smoke**: мокаем `claude` и проверяем, что при `scope: project` появился валидный `.mcp.json`. (Claude сам создаёт, но мы валидируем, что путь/структура корректны по контенту из `add-json`/`add`.) ([Claude Docs][1])
* **Ошибки**: отсутствие `claude`, неверный `type`, пустой `url`/`command` → понятные сообщения и рекомендации.

---

## Что включить в `doctor` сразу (для Claude)

* Проверка наличия `claude` и версии;
* `claude mcp list` — доступность, базовый парсинг;
* Проверка, что при `scope: project` **проект доступен для записи** и `.mcp.json` не урезан политиками;
* Хинт про `MAX_MCP_OUTPUT_TOKENS`, если встречены большие выводы (необязательно в v1). ([Claude Docs][1])

---

## Мини-roadmap (адаптер только под Claude)

* **v0.1**: `probe/plan/apply/list/remove`, `add`/`add-json`, `local|project|user`, `--dry-run`.
* **v0.2**: `doctor`, импорт из Claude Desktop (`add-from-claude-desktop`), улучшенные сообщения. ([Claude Docs][1])
* **v0.3**: защита от дублирования (если `mcp get <name>` уже совпадает — ничего не делать), улучшенная idempotency.

---

Если ок, дальше могу накинуть **точные сигнатуры `ClaudePlan`/`McpServerInfo`** и шаблон модульных тестов (golden-фикстуры), чтобы ты сразу добил реализацию.

[1]: https://docs.claude.com/en/docs/claude-code/mcp "Connect Claude Code to tools via MCP - Claude Docs"
[2]: https://docs.claude.com/en/docs/claude-code/cli-reference "CLI reference - Claude Docs"


Да, целимся в **project-level** и не трогаем глобальные конфиги по умолчанию. Ниже — чёткая политика и как это реализовать в `@katacut/adapter-claude` (и дальше для других клиентов), с бэкапами/версированием и откатом.

---

## Политика по умолчанию

1. **Только project-scope.**

   * **Claude Code:** добавляем серверы с `--scope project`, чтобы конфиг попал в корневой `.mcp.json` и жил в git. Это штатный путь, описанный в доке Claude Code (“Project-scoped servers… store in `.mcp.json` at project root”). ([Claude Docs][1])
   * **VS Code:** пишем в `./.vscode/mcp.json` (workspace-уровень), что тоже рекомендовано в официальной доке. ([Visual Studio Code][2])
   * **Visual Studio:** используем `<SOLUTIONDIR>\.mcp.json` (версионируемый слой); глобальный `%USERPROFILE%\.mcp.json` — только как осознанный fallback. ([Microsoft Learn][3])
   * **Cursor:** поддерживаем проектный `.cursor/mcp.json`, но учитываем, что поведение в некоторых версиях/окружениях бывает нестабильно — поэтому **показываем варнинг и не пишем в глобальный** без флага. ([Cursor][4])

2. **Никаких изменений user-level без явного флага.**
   По умолчанию: `--no-touch-user` (вкл. всегда). Включить глобальную запись можно только с `--allow-user-scope`.

3. **Секреты никогда не хардкодим в проектные JSON.**
   Для VS Code прямо рекомендовано использовать переменные/окружение вместо ключей; в Claude `.mcp.json` поддерживается подстановка env (`${VAR}`). Мы всегда генерим плейсхолдеры. ([Visual Studio Code][2])

---

## Бэкапы, история и откат

* При любом применении `sync` мы делаем **снапшот до правок** целевого файла:

  ```
  .katacut/
    backups/
      vscode/2025-10-17T21-10-00Z.mcp.json
      claude/2025-10-17T21-10-00Z.mcp.json
      cursor/...
      visual-studio/...
    state.json    // индексы снапшотов, SHA256, версия клиента
  ```
* **Lockfile**: `katacut.lock.json` — фиксируем версии/команды MCP-серверов (supply-chain).
* Команда **`kcut rollback --client claude --to <timestamp>`** — вернуть исходное состояние файла.
* Всегда есть **`--dry-run`** с цветным диффом (ничего не записывает).

---

## Поведение адаптера Claude Code (v1)

* Генерация плана: для `type:http` → `claude mcp add --transport http <name> <url> --scope project`; для сложных вариантов (headers/env) — `claude mcp add-json <name> '<json>' --scope project`. ([Claude Docs][1])
* Применение: последовательно выполняем команды, логируя `{client:"claude", action:"add", scope:"project"}`.
* **Никогда** не пишем `--scope user`, если не передан `--allow-user-scope`.
* В `doctor`: проверка наличия `claude`, чтение списка `claude mcp list`, валидация проектного `.mcp.json`. (Есть известные нюансы отображения project-scope в `list` — диагностируем, но не используем это как источник истины.) ([GitHub][5])

---

## Поведение для других клиентов (на старте)

* **VS Code:** создаём/обновляем `./.vscode/mcp.json` либо через команду установки (“MCP: Add Server”) / URL-хендлер `vscode:mcp/install?...`, если это доступно; по умолчанию — workspace, а не user. ([Visual Studio Code][2])
* **Visual Studio:** предпочитаем `<SOLUTIONDIR>\.mcp.json`; глобальный `%USERPROFILE%\.mcp.json` только по флагу. ([Microsoft Learn][3])
* **Cursor:** пишем `./.cursor/mcp.json`. Если обнаружили, что проектный конфиг не подхватывается (известные репорты), выдаём actionable-варнинг с ссылкой и предлагаем вручную включить в настройках/обновить версию — **без автозаписи в глобальный**. ([GitHub][6])

---

## Флаги CLI, чтобы всё было прозрачно

* `kcut sync --dry-run` — только план/дифф.
* `kcut sync --profile <name>` — подмножество серверов.
* `kcut sync --allow-user-scope` — разрешить запись в user-level там, где нет project-уровня.
* `kcut sync --backup-mode copy|git` — помимо локальной копии можно делать `git stash-like` сохранение.
* `kcut rollback --client <id> --to <ts>` — откат к снапшоту.

---

## Алгоритм применения (безопасный)

1. **Probe**: версия клиента/доступность CLI (Claude/VS Code/…); проверка прав записи.
2. **Read**: считываем текущий проектный конфиг (и **только** его).
3. **Plan**: считаем дифф (idempotent: если нет изменений — не пишем).
4. **Backup**: сохраняем снапшот и `katacut.lock.json`.
5. **Apply**: выполняем записи/команды в проектный файл/скоуп.
6. **Verify**: быстрая валидация и, где возможно, «list/get» для подтверждения.
7. **Log & Telemetry**: события OTel (duration/TTFB, ошибки, изменённые сущности).

---

## Почему так

* Это полностью соответствует тому, **как сами клиенты советуют** хранить проектные MCP-конфиги: `.mcp.json` в корне (Claude), `.vscode/mcp.json` (VS Code), `<SOLUTIONDIR>\.mcp.json` (Visual Studio). Мы не изобретаем формат, а автоматизируем. ([Claude Docs][1])
* Мы учитываем **фактические баги/особенности** (например, проекты в Cursor), поэтому делаем предупреждение и **не** лезем в user-level без явного разрешения. ([GitHub][6])

---

## Предлагаю следующий шаг

* Я делаю минимальный контракт `ClaudePlan` и схему блока `mcp` (type/url/headers/command/args/env/scope).
* Реализуем `@katacut/adapter-claude` с **единственной целью: project-scope**, `add`/`add-json`, снапшоты и `--dry-run`.
* После — подключаем VS Code (`.vscode/mcp.json`) с той же политикой.

Хочешь — накину пример валидного куска `katacut.config.jsonc` под твой первый набор серверов и список реальных команд, которые `kcut sync --dry-run` покажет для Claude.

[1]: https://docs.claude.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[2]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Use MCP servers in VS Code"
[3]: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022&utm_source=chatgpt.com "Use MCP Servers - Visual Studio (Windows)"
[4]: https://cursor.com/docs/context/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) | Cursor Docs"
[5]: https://github.com/anthropics/claude-code/issues/5963?utm_source=chatgpt.com "Project scope MCP servers not displayed in claude mcp list ..."
[6]: https://github.com/cursor/cursor/issues/3479?utm_source=chatgpt.com "Local .cursor/mcp.json MCP configuration not working ..."
