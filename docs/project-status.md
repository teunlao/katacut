# KataCut Project Status

## Overview
KataCut (`@katacut/cli`) — это «package.json для AI-инструментария». Один конфигурационный
файл (`katacut.config.jsonc`) описывает необходимых клиентов (IDE, агенты) и MCP-серверы,
после чего CLI генерирует и синхронизирует нативные настройки во всём стекe разработки.

Целевая архитектура:
- TypeScript/Node с `pnpm`-монорепозиторием.
- Hexagonal-подход: ядро (планировщик) отделено от адаптеров клиентов/регистров/секретов.
- Плагины-адаптеры для Cursor, Claude Code, VS Code, Visual Studio, реестров MCP и секретных хранилищ.

## Сделано на текущий момент
- **Монорепо**: базовые пакеты `schema`, `core`, `cli`, `utils-*`, `adapters/*` созданы с ESM-сборкой через `tsc -b`.
- **CLI**: реализованы команды `init` (генерация шаблона `katacut.config.jsonc`) и `sync --dry-run`
  (пока выводит пустой план). Бинарь доступен через `pnpm katacut` и алиас `pnpm kc`.
- **Инфраструктура**:
  - Vitest 3 с проектами (`schema`, `core`, `cli`, `utils`, `adapters`), команды `pnpm test`, `pnpm test:watch`.
  - Biome (линтер/форматтер), `.editorconfig`, обновлённый `.gitignore`.
  - Правила разработчика в `AGENTS.md` (формат коммитов, работа с типами, поиск информации, формат комментариев и т.д.).
- **Сборка и типизация**: `pnpm build` и `pnpm typecheck` проходят; `pnpm test` выполняется (пока без тестов).
- **Документы**: `Info.md`, `arch.md`, `AGENTS.md`, текущий файл `project-status.md`.
- **GitHub**: публичный репозиторий `github.com/teunlao/katacut`, push после каждого коммита.

## Что нужно реализовать дальше
1. **Строгая схема конфига**: добавить JSON Schema / AJV, типы и валидацию (пакет `@katacut/schema`).
2. **Планировщик (`@katacut/core`)**: формирование реальных `SyncPlan` с целями по клиентам и профилям.
3. **Адаптеры**: Cursor, VS Code, Claude Code, Visual Studio — чтение/запись конфигов, запуск CLI.
4. **Registry + secrets**: интеграция с GitHub MCP Registry и секретными менеджерами (1Password, Doppler).
5. **Команда `sync`**: применение плана, работа с профилями, rollback/diagnostics.
6. **Команда `doctor`**: health-check подключений, CLI, прав, окружающей среды.
7. **Тесты**: добавить unit/contract тесты на `schema`, `core`, адаптеры и e2e сценарии.
8. **Документация**: README/usage, примеры конфига, гайд по адаптерам и расширениям.

## Техническая структура (кратко)
```
packages/
  schema/            // парсер конфигурации
  core/              // доменная логика (план/дифф)
  cli/               // команды katacut, бинарь
  utils-fs|logging|errors
  adapters/
    client-cursor/
    client-vscode/
    ... (место для других клиентов/реестров/секретов)
```

В корне:
- `tsconfig.json` + `tsconfig.*.json` для `tsc -b` и Vitest.
- `vitest.config.ts` с проектами.
- Скрипты `pnpm build`, `pnpm typecheck`, `pnpm test`.
- Документы в `docs/` с контекстом и архитектурой.

## Следующие шаги (предложение)
1. Реализовать схему и базовую валидацию (`@katacut/schema`) + tests.
2. Развить `@katacut/core` до настоящего планировщика, подготовить тесты.
3. Подключить первые адаптеры (Cursor, VS Code) и добавить поддержку `sync`.
4. Наращивать тестовое покрытие и документацию по мере добавления функциональности.
