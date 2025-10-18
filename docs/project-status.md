# KataCut — статус проекта (продуктовый обзор)

Обновлено: 18 октября 2025 года

## Идея и ценность
KataCut — «единая точка правды» для инструментов разработчика с ИИ. Команда хранит нужные инструменты (MCP‑серверы) в одном конфигурационном файле репозитория и одним действием приводит рабочую среду в требуемое состояние на любой машине.

Зачем это нужно:
- Быстрый онбординг: «клонировал репозиторий → применил конфиг → работаешь».
- Единообразие в команде: у всех одинаковый набор инструментов и настроек.
- Предсказуемость: повторное применение ничего лишнего не меняет (идемпотентность).
- Прозрачность: всегда видно, что подключено в проекте и у пользователя.

## Что уже готово (MVP для Claude Code)
- Единый конфиг проекта: `katacut.config.jsonc` — перечень требуемых MCP‑инструментов (HTTP/STDIO).
- Просмотр текущего состояния:
  - `kc mcp list --client claude-code` — сводка по проектным и пользовательским настройкам.
  - `--scope project` — показывает содержимое файла проекта.
  - `--scope user` — показывает пользовательские настройки.
- Приведение системы к конфигу:
  - `kc install --client claude-code` — применяет конфигурацию.
  - `--scope project` — обновляет проектный файл; изменения можно коммитить.
  - `--scope user` — обновляет пользовательские настройки.
  - `--dry-run` — сначала показывает план действий (add/update/remove/skip).
  - `--prune` — удаляет лишнее, не описанное в конфиге.
- Идемпотентность: повторный `kc install` без изменений даёт только `skip`.

## Пользовательские сценарии
- Новый разработчик: клонирует проект и одной командой получает готовую среду в Claude Code.
- Командное выравнивание: у всей команды одинаковый набор MCP‑инструментов за счёт проектного файла в репозитории.
- Чистка «дрейфа» настроек: `--prune` убирает лишние записи.
- Безопасное применение: `--dry-run` показывает, что именно будет сделано, перед тем как вносить изменения.

## Новое (диагностика и lockfile/CI)
- Диагностика окружения:
  - `kc doctor --client claude-code` — JSON‑отчёт о доступности CLI, правах на project/user файлы, конфликтах и общем статусе (`ok|warn|error`).
  - Показывает `capabilities` клиента (какие scope поддерживаются) и краткую табличную сводку «Doctor Summary» с рекомендациями.
  - Учитывает локальный state (см. ниже): при его отсутствии выдаёт предупреждение (warn) с подсказкой прогнать `install`.
- Lockfile и проверка в CI:
  - Lockfile проекта: `katacut.lock.json` фиксирует желаемое состояние по конфигу (для выбранного scope).
  - `kc lock generate` — сформировать lockfile из конфига (без применения).
  - `kc lock verify` — сверить lockfile с фактическим состоянием; ненулевой код при расхождении (под CI).
  - `kc ci` — обёртка над `lock verify` с JSON‑отчётом и ненулевым кодом при mismatch (удобно для пайплайнов).
  - Поведение `kc install` (аналог npm/pnpm):
    - По умолчанию после успешного применения обновляет `katacut.lock.json`.
    - `--no-write-lock` — не трогать lock при применении.
    - `--frozen-lock` — требует существующий lock и точное соответствие.
    - `--lockfile-only` — обновить/создать lockfile и выйти.

## План исследований (lockfile и пакетные менеджеры)
- Изучение поведения lock у пакетных менеджеров (pnpm/npm/yarn):
  - Скачать репозиторий pnpm в каталог `external/pnpm` (read‑only, как референс) и просмотреть реализацию формирования/обновления lockfile.
  - Разобрать стратегию merge при частичных изменениях, поддержку диапазонов semver и режимов `--frozen-lockfile`/`ci`.
  - Сопоставить с нашей моделью `katacut.lock.json` (snapshot, resolvedVersion), зафиксировать лучшие практики и edge‑кейсы, которые стоит учесть, чтобы «не изобретать велосипед».
  - Результат: короткий отчёт с рекомендациями и перечнем адаптируемых решений.

## Новое (установка по ссылке из официального реестра MCP)
Поддерживаем добавление MCP напрямую по ссылке на карточку версии в реестре:
- Формат ссылок: `https://registry.modelcontextprotocol.io/v0.1/servers/{url-encoded-name}/versions/{latest|X.Y.Z}` (также `/v0/...`).
- Команда: `kc mcp add <ссылка>`
  - Реестр → нормализация транспорта → запись в конфиг → план → применение → lock/state.
  - Приоритет транспорта: remotes (HTTP/Streamable HTTP/SSE) → packages (npm + STDIO; `npx -y <package>`).
  - По умолчанию — project‑scope (для user добавь `--scope user`).
- Примеры (реальные):
  - HTTP (remotes): `kc mcp add "https://registry.modelcontextprotocol.io/v0.1/servers/ai.smithery%2FHint-Services-obsidian-github-mcp/versions/latest" --scope user`
  - STDIO (npm): `kc mcp add "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.bytedance%2Fmcp-server-filesystem/versions/latest"`
- Ограничения:
  - Обязательные аргументы пакета (например, `allowed-directories`) пока не запрашиваются интерактивно — доработаем отдельно.
  - Секретные заголовки из remotes (например, `Authorization`) нужно задавать явно.

## Новое (поддержка прямых Smithery URL)
Поддерживаем добавление MCP по прямым ссылкам Smithery (управляемые удалённые серверы):
- Формат: `https://server.smithery.ai/@org/name/mcp`
- Команда: `kc mcp add "https://server.smithery.ai/@org/name/mcp" [--scope user|project]`
- Нормализация: трактуется как HTTP‑транспорт `{ type: "http", url }`.
- Если нужен `Authorization: Bearer <key>` — добавляется на стороне клиента (пока вручную).

## Архитектура CLI (резолверы ссылок)
Обработку ссылок выделили в отдельные резолверы (SOLID/DRY):
- `lib/resolvers/registry.ts` — карточки версий MCP Registry (`/v0`, `/v0.1` → ServerJson).
- `lib/resolvers/smithery.ts` — прямые URL `server.smithery.ai/.../mcp`.
- `lib/resolvers/json-url.ts` — произвольные JSON‑дескрипторы `{type: http|stdio, ...}`.
Команда `mcp add` детектирует источник и дальше использует общий конвейер: запись в конфиг → план → apply → lock/state.

## Тесты и безопасность (lock/config)
- Интеграционные тесты создают отдельные временные каталоги и мокают `cwd`, поэтому реальный `katacut.lock.json` проекта не затрагивается.
- Для ручных проверок используйте `--dry-run` или временные директории (текущая реализация не требует переменных окружения).

## Что узнали про MCP Registry
- Хост: `registry.modelcontextprotocol.io`; поддерживаются `/v0` и `/v0.1`.
- Поиск/получение: список `GET /v0.1/servers?search=…&version=latest`; карточка версии `GET /v0.1/servers/{name}/versions/{version|latest}`.
- Структура:
  - `server.remotes` — HTTP/Streamable HTTP/SSE с заголовками.
  - `server.packages` — npm‑пакеты для STDIO с `runtimeHint` (`npx`) и идентификатором.
- Нормализация в KataCut:
  - remotes → `{ type: "http", url, headers? }`.
  - npm+stdio → `{ type: "stdio", command: "npx", args: ["-y", "<package>"] }`.

## Состояние данных в репозитории
- Project‑scope очищен (пустой `.mcp.json`), user‑scope оставлен без изменений.
- Готовы оперативно добавить выбранные MCP по ссылкам из реестра одной командой.
  - `--frozen-lock` — «замороженный» режим: требует существующий lock и точное соответствие конфигу; при расхождении — ошибка, без изменений.
  - `--lockfile-only` — обновить/создать lockfile и выйти, не применяя изменения.
  - По умолчанию scope=`project`. Для `--prune` требуется подтверждение `-y/--yes`.

## Локальный state (факт применения)
- Путь: `./.katacut/state.json` (локально, не коммитится — добавлен в `.gitignore`).
- Содержит сведения о последнем успешном `install`: `requestedScope`, `realizedScope`, `mode (native|emulated)`, сводку результатов и fingerprints по каждой записи.
- Используется `kc doctor` для сопоставления Desired (lock) ↔ Current (файлы) ↔ Realized (state) и формирования рекомендаций.

## Флаги вывода (машинные форматы)
- `--json` — печатать только JSON (без заголовков и таблиц) для `install` и `doctor`.
- `--no-summary` — подавить человеко‑читаемые таблицы/подписи; оставить JSON.

## Управление записями MCP (уточнения)

### Установка
- По умолчанию: `kc install --client claude-code` (def. scope=`project`) приводит состояние к конфигу и обновляет lockfile. Пишется локальный state (`intent="project"`).
- Локально: `kc install --local` — применяет изменения только у клиента, записывает state с `intent="local"`, конфиг/lock не меняет. Комбинация `--local` + `--prune` запрещена.
- Подтверждение для деструктивных действий: для `--prune` требуется `-y/--yes`.

### Удаление
- По умолчанию (аналог npm): `kc mcp remove <name...> --client claude-code [--scope project|user|both]` — удаляет запись(и) из конфига и запускает prune; lock/state обновляются.
- Локально: `kc mcp remove <name...> --local -y` — удаляет запись(и) только у клиента (конфиг и lock не меняются), state фиксируется как `intent="local"`.

### Doctor
- Отображает `localOverrides` (последний локальный прогон с `intent="local"`), чтобы отличать осознанные локальные отступления от проектной истины. Такие отступления не являются ошибкой (статус `ok`), если нет других проблем.

## Ограничения сейчас
- Поддерживается один клиент — `claude-code`.

## Ближайшие шаги
- Улучшенный отчёт `install/doctor`: компактная таблица изменений и рекомендации.
- Capabilities/эмуляция scope: маркировка `native|emulated`, политика fallback при отсутствии `project` у клиента.
- Глобальные операции (по аналогии с `-g`): явные команды/флаг, учёт в пользовательском состоянии, интеграция с `doctor`.
- Документация и примеры конфигов для типовых сценариев.
- Research: enterprise overrides и кроссплатформенный резолвер путей (см. `.tasks/2025-10-18-enterprise-overrides-research.md`).

## Кроссплатформенные пути (актуализировано)
- Project: `./.mcp.json`.
- User (порядок поиска):
  - POSIX: `~/.claude/settings.json`, `~/.claude.json`, `$XDG_CONFIG_HOME/claude/settings.json`, затем `$XDG_CONFIG_HOME/claude/config.json`.
  - Windows (fallback): `%USERPROFILE%/.claude/settings.json`, `%USERPROFILE%/.claude.json`, при наличии — `%APPDATA%/Claude/settings.json`.
- Enterprise (перекрытие, планируется детекция в `doctor`):
  - macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`, `/Library/Application Support/ClaudeCode/managed-mcp.json`.
  - Linux/WSL: `/etc/claude-code/managed-settings.json`, `/etc/claude-code/managed-mcp.json`.
  - Windows: `C:\\ProgramData\\ClaudeCode\\managed-settings.json`, `C:\\ProgramData\\ClaudeCode\\managed-mcp.json`.

## Критерии успеха
- Онбординг в новый проект занимает минуты, а не часы/дни.
- Одинаковая среда у всей команды без ручных инструкций.
- Минимум расхождений между конфигом и фактическим состоянием на машинах разработчиков.

## Демо за 2 минуты
1) Показать `katacut.config.jsonc` — что требуется проекту.
2) Выполнить `kc mcp list --client claude-code` — «как сейчас».
3) Выполнить `kc install --client claude-code --dry-run` — план действий.
4) Выполнить `kc install --client claude-code` — применить.
5) Повторить `kc install --client claude-code --dry-run` — только `skip`.
