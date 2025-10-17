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

Обновлено: 17 октября 2025 г.
