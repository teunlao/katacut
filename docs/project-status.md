# KataCut Project Status

## Overview
KataCut (`@katacut/cli`) — это «package.json для AI-инструментария»: один конфигурационный
файл (`katacut.config.jsonc` / `katacut.jsonc`) задаёт клиентов (IDE/агенты), MCP-серверы и связанные
секреты, а CLI синхронизирует настройки между Cursor, VS Code, Visual Studio, Claude Code и другими.

## Сделано
- **Монорепо (TS/Node, pnpm workspaces)**: пакеты `schema`, `core`, `cli`, `utils`, адаптеры-заготовки.
- **CLI**: команды `init`, `sync --dry-run`; локальный бинарь через `pnpm katacut` / `pnpm kc`.
- **Валидация конфигурации** (`@katacut/schema`):
  - JSON Schema (draft-07) + AJV для парсинга JSONC и читабельных ошибок.
  - `parseConfig` возвращает структурированные `issues`, без использования `null` внутри кода.
  - Unit-тесты (Vitest project `schema`) с фикстурами валидных/невалидных примеров.
- **Ядро (`@katacut/core`)**: минимальный `createSyncPlan` (пока пустые таргеты), подготовлено к расширению.
- **Утилиты**: пакеты `utils-fs`, `utils-errors`, `utils-logging` объединены в `@katacut/utils` (чтение файлов,
  базовые ошибки, `isPlainObject`, `assert`).
- **Инфраструктура**:
  - Vitest с project-конфигурациями (`schema`, `core`, `cli`, `utils`, `adapters`).
  - Biome + `.editorconfig` (отступ 2 пробела, ширина строки 120).
  - `AGENTS.md` с жёсткими правилами (коммиты/пуши только по приказу, поиск только через `web.run`), ручные карточки задач в `.tasks`.
- **Документы**: `Info.md`, `arch.md`, `details-v0.md`, `project-status.md` отражают текущее видение и архитектуру.

## В процессе / Следующие шаги
1. **Развитие `@katacut/schema`**: расширять схему по мере появления новых сущностей (secrets, telemetry, dev).
2. **`@katacut/core`**: реализовать полноценный SyncPlan (цели по клиентам, профилям, диффы).
3. **Адаптеры клиентов**: Cursor и VS Code (project scope), затем Claude Code и Visual Studio.
4. **Registry & Secrets**: интеграция с GitHub MCP Registry, 1Password, Doppler (env-бриджи).
5. **Команда `sync`**: применение плана, роллбеки, логирование.
6. **`katacut doctor`**: health-check CLI/прав/проектных конфигов.
7. **Telemetry & testing**: OTel (опционально), расширение тест-пирамиды, e2e сценарии.
8. **Документация**: README, usage-гайды, примеры конфигов и адаптеров.

## Текущие ограничения
- `createSyncPlan` пока возвращает пустой список таргетов (только текстовое summary).
- Нет реальных адаптеров (CLI работает на заглушках).
- `doctor`, `lock`, `add` ещё не реализованы.
- Telemetry и секции `dev` в конфиге зарезервированы, но не поддерживаются.

## Ключевые правила разработки
- Русский в чате, английский в коде/доках.
- Семантические коммит-месседжи (feat/fix/chore/...). Коммиты и пуши — только после прямого приказа.
- Работаем по SOLID/DRY/YAGNI, без `null` внутри кода (используем `undefined`), без «функционала на будущее».
- Поиск свежей информации — только через `web.run`/`search`, без самодельного `curl`.
- Новые задачи ведём вручную в `.tasks` (черновик → утверждение → карточка по шаблону).

## Лог работ 17 октября 2025 г. (POC Claude Code — детальный таймлайн)
- 16:45–16:50 — фиксация цели POC. Требовалось подготовить конфигурационный слой под Claude Code: KataCut должен читать `katacut.config.jsonc`, проверять корректность описания MCP-серверов и быть готовым генерировать команды `claude mcp add`. В исходной схеме `packages/schema/src/schema.json` разрешались любые транспорты (`websocket`, `command`), что противоречило официальной спецификации MCP ревизии 2025-06-18. План: привести схему и типы к фактическим требованиям MCP (только `stdio` и Streamable `http`), обеспечить строгую валидацию, дополнить тесты и зафиксировать процесс в документации.
- 16:50–16:55 — аудит текущего состояния. Проверены файлы `schema.json`, `types.ts`, `parseConfig.test.ts`. Выявлено: 
  - Транспорт `websocket` допущен, хотя в новой спецификации он рассматривается как реализация на базе HTTP. 
  - Транспорт `command` использовался как отдельный тип, хотя по факту это лишь способ запуска stdio-сервера. 
  - Поля `url`, `command`, `args` не требовались явно, что позволяло записать некорректные конфиги. 
  - Тесты покрывали только базовый кейс (валидный HTTP) и отсутствие `transport`; проверок по комбинированным условиям не было.
- 16:55–17:05 — сверка спецификации MCP. Из локального зеркала `external/modelcontextprotocol` изучены файлы `docs/specification/2025-06-18/basic/transports.mdx` и `schema/2025-06-18/schema.json`. Подтверждено: официально задекларированы два транспорта — `stdio` и Streamable HTTP. SSE теперь часть HTTP, WebSocket как отдельный транспорт не упоминается. `command` описывается как способ запуска stdio. Вывод: конфиг KataCut должен отражать именно эти два варианта.
- 17:05–17:10 — формирование требований к новой схеме. Принято решение: 
  - Разрешить только `transport: "http" | "stdio"`. 
  - Добавить поле `scope` (значения `project`, `workspace`, `user`, `global`) для брейджа между клиентами (VS Code, Claude, Cursor). 
  - Оставить общие поля `name`, `description`, `metadata`, `permissions` как справочные (их используют адаптеры/логгирование). 
  - Для HTTP сделать обязательным `url`, разрешить `headers`. 
  - Для STDIO сделать обязательным `command`, разрешить `args`, `env`. 
  - Значения `cwd`, `protocols` убрать, чтобы не тащить клиент-специфичные детали. 
  - Согласовать типы в `types.ts` и тесты.
- 17:10–17:20 — правка `packages/schema/src/schema.json`. Реализовано: 
  - Полностью обновлён блок `mcp`: теперь он содержит свойства `transport`, `name`, `description`, `metadata`, `scope`, `permissions`, `url`, `headers`, `command`, `args`, `env`. 
  - Через `allOf` + `if/then` описаны условия: `http` требует `url`, `stdio` требует `command`. 
  - `url` валидируется через формат `uri`. 
  - `permissions` ограничены объектом с массивами `filesystem` и `network`, чтобы зафиксировать будущие предупреждения KataCut. 
  - `additionalProperties: false` остаётся, чтобы конфиг не захламлялся неслужебными ключами.
- 17:20–17:30 — синхронизация типизации (`packages/schema/src/types.ts`). Выполнено: 
  - Определён `McpTransport = "http" | "stdio"`. 
  - Введён `McpScope = "project" | "workspace" | "user" | "global"`. 
  - Созданы интерфейсы `BaseMcpServerConfig`, `HttpMcpServerConfig`, `StdioMcpServerConfig`, юнион `McpServerConfig`. 
  - `BaseMcpServerConfig` хранит общие данные (`name`, `description`, `metadata`, `scope`, `permissions`), чтобы адаптеры могли ссылаться на них при генерации логов/предупреждений. 
  - В `KatacutConfig` поле `mcp` теперь `Record<string, McpServerConfig>`, что делает использование транспорта строго типовым. 
  - `ProfileConfig` оставлено без изменений, но понимание: профили в дальнейшем будут связывать клиентов и серверы.
- 17:30–17:35 — обновление валидации (`packages/schema/src/index.ts`). Для проверки `url` по формату URI добавлен `ajv-formats`. Особенность: пакет экспортирует функцию без конкретной сигнатуры, поэтому TypeScript потребовал приведения типов (`(addFormats as unknown as (ajv: Ajv) => void)(ajv)`). Без этого `tsc` завершался с ошибкой `expression is not callable`.
- 17:35–17:45 — расширение тестовых данных. Подготовлены новые фикстуры в `packages/schema/test/__fixtures__`: 
  - `valid-stdio.jsonc` — демонстрирует корректный stdio-сервер с `command`, `args`, `env`. 
  - `invalid-http-missing-url.jsonc` — показывает обязательность `url` для HTTP. 
  - `invalid-stdio-missing-command.jsonc` — проверяет обязательность `command` для stdio. 
  Существующий `valid-basic.jsonc` оставлен для HTTP-кейса, `invalid-missing-transport.jsonc` — для проверки must-have поля `transport`.
- 17:45–17:55 — переработка тестов `packages/schema/test/parseConfig.test.ts`. Добавлены сценарии: 
  - Валидация stdio-конфига (`valid-stdio`). 
  - Проверка ошибок для отсутствия `url` (`invalid-http-missing-url`). 
  - Проверка ошибок для отсутствия `command` (`invalid-stdio-missing-command`). 
  - Существующие тесты (валидный конфиг, отсутствие `transport`, ошибки парсинга) адаптированы под новые ожидания.
- 17:55 — запуск `pnpm test`: vitest проходит, что подтверждает согласованность схемы, типов и тестов.
- 17:56 — запуск `pnpm typecheck`. На первом прогоне `tsc` упал из-за вызова `addFormats`; после приведения типов (описано выше) сборка проходит (`EXIT:0`). Повторный запуск `pnpm test` — зелёный.
- 17:57 — зачистка инфраструктуры тестов. `vitest.base.ts` приведён к минимальному виду: удалён устаревший репортёр `basic`, чтобы Vitest не выдавал предупреждение `DEPRECATED 'basic' reporter...`. Теперь используется дефолтный репортёр.
- 17:58 — контроль соответствия спецификации. В каталоге `external/modelcontextprotocol` проверены файлы `docs/specification/2025-06-18/basic/transports.mdx` и `docs/specification/2025-06-18/server/tools.mdx`, а также `schema/2025-06-18/schema.json`. Это подтверждает, что наши ограничения (только `http` + `stdio`) совпадают с официальными определениями. Зеркало служит доказательной базой, не правилось.
- 17:59 — попытка подготовить коммит (команда `git add …`). Система вернула `fatal: Unable to create '.git/index.lock': Operation not permitted`. Причина: среда не дала создать lock-файл (вероятно, защита файловой системы). Повторные попытки дают тот же результат. Без вмешательства пользователя (`sudo`, настройка sandbox) коммит невозможен. Ошибка зафиксирована, дальнейшие git-команды не выполнялись.
- 18:00 — документирование: текущее содержание `docs/details-v3.md` дополнено конспектом по MCP и Claude Code (CLI-команды `claude mcp add`, форматы `.mcp.json`). `docs/project-status.md` пополнен данным логом (все шаги, причины и выводы).

Обновлено: 17 октября 2025 г.

Обновлено: 17 октября 2025 г.
