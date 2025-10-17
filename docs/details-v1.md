Ок, сводка по всему, что обсудили — от GitHub MCP до нашего CLI **KataCut**.

## MCP и реестры

* **MCP** — открытый протокол (клиент ↔ сервер), транспорты: **stdio** и **HTTP (streamable)**.
* **Реестры хранят не сервера, а метаданные/манифесты**: id, transport, `command/args` или `url`, требуемые ENV, разрешения.
* **GitHub MCP Registry** — официальный каталог в экосистеме GitHub/VS Code/VS (кнопки Install).
* **Community Registry** — API-first каталог (эндпоинт `…/v0/servers`), без «витрины», даёт сырой JSON.
* Единого «мирового npm» для MCP нет. Можно держать **свой реестр** или **федератор** (агрегировать GitHub + community).

## Зачем вообще реестр

* **Поиск и единый формат установки** (машиночитаемо).
* **Безопасность/кураторство**: видны требуемые права/ENV, верификация автора.
* Готовая база для авто-установщиков/витрин (в т.ч. нашего CLI).

## Как ставят MCP сегодня

* **VS Code**: команда «MCP: Add Server» / `.vscode/mcp.json` / спец-URL из витрины GitHub.
* **Visual Studio**: читает `mcp.json` из нескольких локаций (глобально/solution и т.д.).
* **Cursor**: `.cursor/mcp.json` (глобально/проектно).
* **Claude Code**: только через `claude mcp add …` (визард).
* Поэтому «единый config» невозможен без слоя автоматизации — и это как раз **KataCut**.

## Наша концепция: KataCut = «package.json для AI»

* **Цель**: скрыть различия клиентов. Пользователь указывает только список инструментов; всё остальное — автоматом.
* **Мини-конфиг (env-only):**

  ```json
  { "version": "0.1.0", "mcp": ["github","playwright","postman"] }
  ```

  — никаких `clients/servers`, никаких маппингов секретов; ENV берём из окружения, просто проверяем наличие.

## Команды CLI (как у npm)

* `kcut install` — привести систему к состоянию из конфига/локфайла (аналог `npm install`).
* `kcut install <id>` — добавить инструмент по id из реестра и сразу применить.
* `kcut ci` — детерминированная установка строго по lockfile (для CI/чистых машин).
* `kcut prune` — удалить то, чего нет в конфиге.
* Флаги:

  * `--registry <url>` или прямой URL на API (поддержка community/GitHub/собственных).
  * `--clients=vscode,cursor,claude,vs`, `--all`, `--prefer=http|stdio`, `--dry-run`.

## Что делает `kcut install` под капотом

1. **Резолвит** запись из реестра (по id/URL): transport + URL/command/args + список ENV.
2. **Авто-детект клиентов** и установка **только туда, где клиент найден**:

   * VS Code → `.vscode/mcp.json` или их «Add Server».
   * Visual Studio → один из поддерживаемых `mcp.json` путей.
   * Cursor → `.cursor/mcp.json` (дефолт глобально; проектный — флагом).
   * Claude Code → запускает `claude mcp add …` с нужным транспортом.
3. **Проверяет ENV** (если запись требует) и выдаёт понятные подсказки.
4. **Пишет lockfile** `katacut.lock.json` (id, транспорт, точная команда/URL, куда установлено).
5. **Идемпотентность**: повторный запуск не трогает, если всё совпадает.

## Профили

* Именованные наборы инструментов:

  ```json
  { "profiles": { "work": ["github","playwright"], "light": ["filesystem"] } }
  ```
* `kcut install --profile work` / `kcut use work` — применить конкретный профиль (во все найденные клиенты).
* Для Claude профили реализуем серией `remove/add` (у них нативных профилей нет).

## Распространение CLI

* **Локально в проекте (рекомендовано)**: `npm i -D @katacut/cli` → `npx kcut …` — воспроизводимо, хорошо для команд/CI.
* **Разово**: `npx @katacut/cli install`.
* **Глобально**: `npm i -g @katacut/cli` (с проверкой версии против lockfile проекта).

## Реестр KataCut (по желанию)

* Делаем **Katacut Registry**: нормализуем записи, агрегируем **GitHub MCP Registry + community**, показываем права/ENV, публикуем кнопку «Install with kcut».
* Поддерживаем **частные реестры** (enterprise) через `--registry`.

## Архитектура (вкратце)

* Монорепо; **ядро** (план/дифф) отдельно от **адаптеров** (vscode, vs, cursor, claude, registry, telemetry).
* Но конфиг для юзера — максимально простой (только `mcp` + опциональные `profiles`).
* Алиас CLI: **`kcut`**.

Готово. Это конденсированная «истина» нашей модели и текущих реалий MCP/DX. Если нужно — соберу минимальный пример конфига и покажу, какие файлы/команды будут сгенерированы на твоей машине под выбранный профиль.


___
Понимаю. Коротко и по сути — **что даёт комьюнити-реестр и как он относится к Claude Code**.

### Что это за ссылка

`https://registry.modelcontextprotocol.io/v0/servers?search=github` — это **API каталога**. Он возвращает **машиночитаемый список** MCP-серверов с полями: как к ним подключаться (HTTP/STDIO), какая команда/URL, какие ENV и какие разрешения нужны. Это **не установщик** и **не витрина** — это «сырой источник правды» для инструментов. ([GitHub][1])

### Что реестр **делает**

* Даёт единый формат метаданных/манифестов серверов (ID, transport, команда/URL, ENV, разрешения). Серверы запускаются у тебя локально (STDIO) или живут у автора как HTTP-сервис — сам реестр их **не хостит**. ([GitHub][2])
* Нужен, чтобы **инструменты** (IDE, CLI, «витрины») могли автоматически «перевести» запись в конкретную установку под клиента. Пример: GitHub MCP Registry строит человеческую витрину/кнопку «Install» поверх таких метаданных. ([The GitHub Blog][3])

### Что реестр **не** делает

* Не ставит и не запускает сервер «сам по себе».
* Не «подхватывается» автоматически Claude Code — у Claude нет встроенной авто-установки прямо из этого API. Нужен слой, который возьмёт JSON и сконфигурирует клиента. ([GitHub][1])

### Как это связано с твоим Claude Code (практически)

Есть **три нормальных пути** использовать **именно** community-реестр в связке с Claude — без ручного «гуглить README»:

1. **Через “Registry MCP Server”.** Это отдельный MCP-сервер, который сам ходит в реестр и даёт внутри Claude поиск/подсказки по установке других серверов. Ставишь его один раз — дальше находишь нужные записи прямо из Claude. ([GitHub][4])

2. **Через сторонний инструмент/витрину.** VS Code/Visual Studio уже умеют «в один клик» (GitHub MCP Registry). Community-реестр API-first: либо смотришь сырой JSON, либо пользуешься витриной третьей стороны (mcpservers.org / mcp.so), которая читает этот API и показывает список/инструкции. ([The GitHub Blog][3])

3. **Через автоматизатор (то, что мы строим — KataCut).** Инструмент берёт запись из API (**transport + URL/command/args + ENV**) и сам раскладывает её в клиенты (у Claude — через их установочный поток; у Cursor — в `.cursor/mcp.json`; у VS Code — в `.vscode/mcp.json`/«Add Server»). То есть **реестр = вход**, **CLI = «сделай, чтобы работало»**. ([GitHub][1])

### Зачем вообще реестр, если можно руками из README?

* **Масштаб и единообразие.** Один-два сервера — ок. Когда их десятки, API-каталог с нормализованными полями снимает расхождения по флагам/транспортам/ENV и позволяет автоматизировать. ([GitHub][1])
* **Кураторство/безопасность.** Появляются вредоносные MCP; реестры помечают права/ENV, могут верифицировать автора/снимать мусор. Это реально снизит риски supply-chain. ([IT Pro][5])

**Итог:** твоя ссылка — это **данные**, из которых берутся **URL/command/args/ENV**. Сам Claude Code из **community-реестра** напрямую «по ссылке» не ставит; либо ставишь «Registry MCP Server» и ищешь из Claude, либо используешь витрину/инструмент, который съест API и применит конфиг за тебя. Это и есть ценность реестра: **единый машинный источник**, на который ложится UX-слой установки. ([GitHub][1])

[1]: https://registry.modelcontextprotocol.io/docs?utm_source=chatgpt.com "Official MCP Registry Reference"
[2]: https://github.com/modelcontextprotocol/registry?utm_source=chatgpt.com "modelcontextprotocol/registry"
[3]: https://github.blog/ai-and-ml/github-copilot/meet-the-github-mcp-registry-the-fastest-way-to-discover-mcp-servers/?utm_source=chatgpt.com "Meet the GitHub MCP Registry: The fastest way to discover ..."
[4]: https://github.com/formulahendry/mcp-server-mcp-registry?utm_source=chatgpt.com "formulahendry/mcp-server-mcp-registry"
[5]: https://www.itpro.com/security/a-malicious-mcp-server-is-silently-stealing-user-emails?utm_source=chatgpt.com "A malicious MCP server is silently stealing user emails"



Да, DX-правильно сделать так:

## Рекомендованный UX

* Базово (как npm):
  `kcut add <id>`
  `kcut sync`
  где `<id>` — айди из реестра (по умолчанию — community registry).

* В одну команду:
  `kcut install <id>` → сразу “add+sync”.

* Альтернативный источник:
  `kcut install <id> --registry https://registry.modelcontextprotocol.io`
  (community-API — это тот самый `/v0/servers` каталог с машинными данными: transport, URL/command, env и пр. — «API-first» список серверов. Мы берём оттуда метаданные.) ([MCP Protocol][1])

* Прямой URL (без id):
  `kcut install "https://registry.modelcontextprotocol.io/v0/servers?search=github"`
  CLI сам выберет точное совпадение/попросит выбрать из нескольких и продолжит. (Эндпоинт действительно отдаёт список серверов/метаданные в JSON.) ([MCP Protocol][1])

## Что делает `kcut install` под капотом

1. **Резолвит запись** из реестра (по id/URL): получает `transport` (`stdio` или `http`), `command/args` **или** `url`, а также требуемые `env`. (Это именно то, что даёт community-реестр через API.) ([MCP Protocol][1])
2. **Проверяет клиенты** на машине и раскладывает конфиг во все найденные:

   * VS Code — через `code --add-mcp '{...}'` или пишет `.vscode/mcp.json`. ([Visual Studio Code][2])
   * Visual Studio — пишет `mcp.json` в поддерживаемые локации (`%USERPROFILE%\.mcp.json`, `<SOLUTION>\.mcp.json`, и т.д.). ([Microsoft Learn][3])
   * Cursor — правит `.cursor/mcp.json` (глобально/проектно). ([Cursor][4])
   * Claude Code — запускает их официальный установочный мастер `claude mcp add …` с нужным `--transport` и URL/command (у Claude это именно CLI-визард). ([Claude Docs][5])
3. **Проверяет ENV**: если запись реестра требует, например, `GITHUB_PERSONAL_ACCESS_TOKEN`, CLI покажет, чего не хватает. (Те же переменные фигурируют в доках GitHub MCP Server — там же и флаги `--toolsets`.) ([GitHub][6])
4. **Пишет lockfile** (`katacut.lock.json`) с зафиксированным источником/версией команды — как у npm.

## Поведение при неоднозначностях

* Если `search` вернул несколько совпадений — интерактивный список (id, автор, transport).
* Если сервер поддерживает **оба** транспорта — спросим: `http` (удалённый URL) или `stdio` (локальная команда). MCP спецификация допускает оба варианта; многие клиенты поддерживают оба. ([Visual Studio Code][7])
* Всегда доступен `--dry-run`: показать план (какие файлы/команды будут применены) без изменений.

## Примеры

* “Как у npm”:
  `kcut install github` →
  VS Code: добавит GitHub MCP; Visual Studio: создаст/обновит `mcp.json`; Cursor: пропишет `.cursor/mcp.json`; Claude: выполнит `claude mcp add` с корректным транспортом. (В VS Code MCP добавляется командой `--add-mcp`/файлом, в VS — через перечисленные пути, в Cursor — `.cursor/mcp.json`, в Claude — CLI мастер.) ([Visual Studio Code][2])

* Из другого реестра:
  `kcut install playwright --registry https://registry.modelcontextprotocol.io`
  (community API имеет `/v0/servers` и поиск по `?search=` — мы съедаем JSON и ставим.) ([MCP Protocol][1])

* Из прямой ссылки на API:
  `kcut install "https://registry.modelcontextprotocol.io/v0/servers?search=github"`
  (Если несколько — попросим выбрать точный id.)

## Почему такой DX — лучший

* **Одна команда**, как у `npm i`: пользователь не обязан знать, куда и в каком формате пишется конфиг каждого клиента — мы скрываем различия (VS Code `--add-mcp`, Visual Studio пути `mcp.json`, Cursor `.cursor/mcp.json`, Claude — CLI мастер). ([Visual Studio Code][2])
* **Совместимо с “официальным” и community**: поддерживаем GitHub MCP Registry (витрина с Install) и API-first community-реестр; плюс даём флаг `--registry` и прямой URL. ([GitHub][8])
* **Безопасность/прозрачность**: выводим права/ENV/transport из записи перед установкой (что и есть ценность реестра — нормализованные метаданные, пригодные для авто-установки). ([MCP Protocol][1])

Если ок — зафиксирую финальный интерфейс команд (`add/install/sync/doctor/dry-run`) и схему lockfile.

[1]: https://modelcontextprotocol.info/tools/registry/?utm_source=chatgpt.com "MCP Registry - Model Context Protocol （MCP）"
[2]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Use MCP servers in VS Code"
[3]: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022&utm_source=chatgpt.com "Use MCP Servers - Visual Studio (Windows)"
[4]: https://cursor.com/docs/context/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) | Cursor Docs"
[5]: https://docs.claude.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[6]: https://github.com/github/github-mcp-server?utm_source=chatgpt.com "GitHub's official MCP Server"
[7]: https://code.visualstudio.com/api/extension-guides/ai/mcp?utm_source=chatgpt.com "MCP developer guide | Visual Studio Code Extension API"
[8]: https://github.com/mcp?utm_source=chatgpt.com "MCP Registry"


Коротко: **отдельная команда `sync` не нужна**. Делай как npm.

## Модель DX (как у npm)

* **`kcut install`** без аргументов — читает `katacut.config` + `katacut.lock` и **приводит систему к состоянию** из файла (аналог `npm install`: подтянуть всё, что описано в манифесте/локфайле). ([npm Docs][1])
* **`kcut install <id>`** — добавить новый инструмент **и сразу применить** (как `npm install <pkg>`). ([npm Docs][1])
* **`kcut ci`** — “чистая установка” **только по lockfile**, падать при рассинхроне (аналог `npm ci` для CI/чистых машин). ([npm Docs][2])
* **`kcut prune`** — выкинуть лишнее, чего нет в конфиге (аналог `npm prune`). ([npm Docs][3])

То есть **`install` = наш “sync”**. Пользователь не думает про клиентов/пути — мы сами кладём `.vscode/mcp.json`/`.cursor/mcp.json`, вызываем визард у Claude и т.д.

## Почему так правильно

* В npm **“синхронизация” зашита в `npm install`**: он подтягивает зависимости из `package.json`/`package-lock.json`, добивается целевого состояния. Нам нужен тот же UX. ([npm Docs][1])
* Для детерминированных окружений есть **отдельная команда `ci`** — быстрее и жёстче (строго по lockfile). Это удобно и для Katacut (CI/онбординг на чистую машину). ([npm Docs][2])
* Поддержка **“санитарии”** есть в npm через `prune` — у нас тоже должна быть, чтобы прибрать отвалившиеся/старые инструменты. ([npm Docs][3])

## Итоговая схема команд

```bash
# начальный подъём проекта (репо уже содержит katacut.config/lock)
kcut install            # как npm install

# добавить конкретный инструмент из реестра и сразу применить
kcut install github

# детерминированный бутстрап в CI/на чистой машине
kcut ci                 # как npm ci

# вычистить лишнее, чего нет в конфиге
kcut prune              # как npm prune
```

Если хочется ещё короче — оставляем только **`kcut install`** (с аргументом/без) и **`kcut ci`**. Всё.

[1]: https://docs.npmjs.com/cli/v8/commands/npm-install/?utm_source=chatgpt.com "npm-install"
[2]: https://docs.npmjs.com/cli/v9/commands/npm-ci/?utm_source=chatgpt.com "npm-ci"
[3]: https://docs.npmjs.com/cli/v8/commands/npm-prune/?utm_source=chatgpt.com "npm-prune"



Коротко: **дефолт — авто-детект и установка только туда, где клиент реально есть.** Никаких “везде сразу” без смысла. Всё остальное — флаги.

## Как должно работать в `kcut install <id>`

1. **Авто-детект клиентов** (по PATH/конфигах)

   * **VS Code**: если есть `code` → кладём в проектный `.vscode/mcp.json` (если есть воркспейс), иначе — в глобальный профиль через их команду “MCP: Add Server”. ([Visual Studio Code][1])
   * **Visual Studio** (Windows): ищем и пишем в один из поддерживаемых путей (глобальный `%USERPROFILE%\.mcp.json`, на уровень solution, либо `.vscode/mcp.json` в репо). ([Microsoft Learn][2])
   * **Cursor**: если обнаружен — генерим `.cursor/mcp.json`. По умолчанию **глобально**, т.к. проектный файл на Windows у части юзеров сбоил (известный кейс). ([Cursor][3])
   * **Claude Code**: если есть `claude` CLI — запускаем их официальный визард `claude mcp add …` с нужным транспортом (STDIO/HTTP). ([Claude Docs][4])

2. **Правила по умолчанию** (DX-разумные)

   * **Scope “auto”**: VS Code — проектный, если есть `.vscode/`; Visual Studio — solution-level, если есть `.sln`; Cursor — глобальный (за надёжность), но можно форсировать проектный флагом; Claude — пользовательский (их дефолт). ([Visual Studio Code][1])
   * **Транспорт “auto”**: если запись из реестра даёт HTTP-URL — берём HTTP; если только STDIO — берём `command/args`. (Оба транспорта стандартизованы MCP.) ([Visual Studio Code][5])

3. **Флаги управления (без усложнений)**

   * `--all` — пушнуть во **все найденные** клиенты сразу.
   * `--clients=vscode,cursor,claude,vs` — выбрать явный список.
   * `--scope.vscode=workspace|global`, `--scope.vs=solution|global`, `--scope.cursor=project|global`.
   * `--prefer=http|stdio` — если у сервера доступны оба.
   * `--dry-run` — показать план (куда и что будет записано/вызвано).

4. **Idempotent**
   Повторный `kcut install` ничего не трогает, если целевые файлы/настройки уже совпадают. `kcut prune` — удаляет то, чего нет в конфиге (как npm prune).

5. **Lockfile**
   Пишем `katacut.lock.json`: где установлен (vscode/cursor/claude/vs), каким транспортом и какой точно `command/args/url`. Это упрощает CI (`kcut ci`) и откат.

## Почему так

* **Разные таргеты у клиентов**: VS Code ждёт `.vscode/mcp.json` или команду “Add Server”; Visual Studio сканирует несколько локаций; Cursor читает `.cursor/mcp.json`; Claude — **только** через `claude mcp add`. Это подтверждают офиц. доки, поэтому “детект + выбранный таргет” — единственный адекватный DX. ([Visual Studio Code][1])
* **Практика**: проектный MCP в Cursor на Windows у части юзеров не срабатывал — разумно делать дефолт “global”, а проектный включать флагом. ([Cursor - Community Forum][6])

## TL;DR

* **По умолчанию**: ставим **только** туда, где клиент найден, в наиболее логичный **локальный scope**.
* **Нужно “везде”** — `--all`.
* **Нужно выборочно** — `--clients=…` и/или `--scope.…=…`.
* Всегда есть `--dry-run` и детерминированный `kcut ci`.

Так получаем поведение “как npm install”, но с умной привязкой к реальным клиентам MCP.

[1]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Use MCP servers in VS Code"
[2]: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022&utm_source=chatgpt.com "Use MCP Servers - Visual Studio (Windows)"
[3]: https://cursor.com/docs/context/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) | Cursor Docs"
[4]: https://docs.claude.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[5]: https://code.visualstudio.com/api/extension-guides/ai/mcp?utm_source=chatgpt.com "MCP developer guide | Visual Studio Code Extension API"
[6]: https://forum.cursor.com/t/project-level-mcp-json-configuration-not-working-in-windows11/62182?utm_source=chatgpt.com "Project-level mcp.json Configuration Not Working in ..."


Да, **профили** — это нормальная фича для KataCut, и она реально нужна.

## Что такое профиль

Профиль — это именованный набор MCP-инструментов (и настройка транспорта), который мы **применяем ко всем найденным клиентам** (VS Code / Visual Studio / Cursor / Claude Code) одним действием.

Пример в `katacut.config.jsonc`:

```jsonc
{
  "version": "0.1.0",
  "mcp": ["github","playwright","filesystem"],
  "profiles": {
    "work":   ["github","playwright"],
    "light":  ["filesystem"]
  }
}
```

## Как это работает по клиентам

* **VS Code.** Есть рабочая (workspace) и глобальная конфигурации MCP; можно добавлять через `code --add-mcp` или писать `.vscode/mcp.json`. Мы генерим/подменяем **workspace-файл** под выбранный профиль (или глобально, если так проще в вашей команде). ([Visual Studio Code][1])

* **Visual Studio (Windows).** Студия автодискаверит `mcp.json` в нескольких локациях: глобальный `%USERPROFILE%\.mcp.json`, на уровень solution (`.vs\mcp.json` или `<SOLUTION>\.mcp.json`), и даже читает `.vscode/mcp.json`. Под профиль мы пишем в нужную из этих точек (обычно solution-level). ([Microsoft Learn][2])

* **Cursor.** Есть глобальный `~/.cursor/mcp.json` и проектный `.cursor/mcp.json`. Профиль “work” → запишем проектный; “global” → в домашний. ([Medium][3])

* **Claude Code.** У Claude **нет “профилей” как таковых**, есть CLI для списков/добавления/удаления (`claude mcp list/get/add/remove`) и флаг **`--scope`** (user / путь проекта). KataCut будет:

  1. снимать “лишние” сервера профиля через `claude mcp remove`,
  2. добавлять недостающие `claude mcp add …` (STDIO/HTTP),
  3. опционально ограничивать профили по директориям через `--scope <path>` (или `--scope user`).
     Это официально задокументировано в MCP-разделе и CLI-справке; при этом есть открытые баги у `remove`, их обойдём “жёсткой” перезаписью конфигурации при необходимости. ([Claude Docs][4])

> Дополнительно: есть готовые скрипты “переключателей профилей” для Claude Desktop (меняют конфиг-файл), что подтверждает жизнеспособность подхода с профилями. Мы можем интегрировать подобный режим в KataCut. ([GitHub][5])

## Команды DX (как у npm)

* **Применить весь проект по умолчанию:**
  `kcut install` — приведёт локальные клиенты к состоянию из `katacut.lock` (аналог `npm install`).

* **Включить профиль и сразу применить:**
  `kcut install --profile work` — разложит только инструменты профиля *work* по доступным клиентам (автодетект клиентов и их “scope”).

* **Сменить профиль “на лету”:**
  `kcut use work` — перезапишет мишени (Workspace VS Code, solution-file для VS, `.cursor/mcp.json`, и запустит серию `claude mcp remove/add`).

* **Жёсткая установка по локфайлу (CI):**
  `kcut ci --profile work` — строго по lock-версии и тем же мишеням.

* **Контроль:**
  `kcut doctor` — покажет, какие клиенты найдены, что установлено, какие ENV нужны (например, GitHub PAT), и где лежат фактические файлы (`.vscode/mcp.json`, `%USERPROFILE%\.mcp.json`, `.cursor/mcp.json`). ([Visual Studio Code][1])

## Почему это жизнеспособно (реальность экосистемы)

* **VS Code** поддерживает workspace vs user MCP и даже установку по спец-URL/команде → профили просто переключают целевой файл. ([Visual Studio Code][6])
* **Visual Studio** читает несколько путей и чужие конфиги (в т.ч. `.vscode/mcp.json`) → легко разделить профили по solution. ([Microsoft Learn][2])
* **Cursor** имеет явный глобальный/проектный конфиг → профили ложатся естественно. ([Medium][3])
* **Claude Code** управляется через `claude mcp add/remove/list` и `--scope` (user/dir) → профили реализуем как “планы дельт” к текущему списку. ([Claude Docs][4])

Если хочешь, дам «боевой» пример: профиль *work* (GitHub + Playwright) и *light* (Filesystem), и покажу, какие **конкретно** файлы и команды применит KataCut под каждый клиент при `kcut use work`.

[1]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Use MCP servers in VS Code"
[2]: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022&utm_source=chatgpt.com "Use MCP Servers - Visual Studio (Windows)"
[3]: https://medium.com/%40lovelyndavid/mcp-in-cursor-ai-02e3d96eb593?utm_source=chatgpt.com "MCP in Cursor AI - by Lovelyn David"
[4]: https://docs.claude.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[5]: https://github.com/zongmin-yu/claude-mcp-manager?utm_source=chatgpt.com "zongmin-yu/claude-mcp-manager: A shell script ..."
[6]: https://code.visualstudio.com/api/extension-guides/ai/mcp?utm_source=chatgpt.com "MCP developer guide | Visual Studio Code Extension API"



Коротко: делаем **как npm** — один пакет `@katacut/cli`, три режима запуска. По умолчанию — **локально в проекте**; для «разового» — `npx`; для удобства — глобалка. CLI сам найдёт конфиг и клиентов.

## Как распространяем и как работает

1. **Разовый запуск (без установки):**

   ```bash
   npx @katacut/cli install
   ```

   Это `npm exec/npx`: скачал и запустил нужную версию, ничего не «мусорит» в системе. Хорошо для пробы/одноразовых задач. ([npm Docs][1])

2. **Локально в проекте (рекомендовано для команды/CI):**

   ```bash
   npm i -D @katacut/cli
   npx kcut install              # или npm run kcut
   ```

   Локальная установка + lockfile ⇒ воспроизводимо на всех машинах и в CI (как `npm install`/`npm ci`). Скрипты `npm run` подхватывают локальный бинарь из `node_modules/.bin`. ([npm Docs][2])

3. **Глобально (для личного удобства):**

   ```bash
   npm i -g @katacut/cli
   kcut install
   ```

   Быстрый доступ из любого каталога. Мы сделаем «защиту от дрейфа»: если в проекте в `katacut.lock.json` указана другая версия CLI — предупреждаем. ([npm Docs][2])

## Где берём конфиг и что делаем

* **Режим “проект”**: если в текущей папке есть `katacut.config.*` — работаем по нему (аналогично `npm install` по `package.json`).
* **Режим “пользователь/глобал”**: если в проекте конфига нет — читаем user-конфиг из стандартных мест:

  * Linux/macOS: `~/.config/katacut/config.json` (XDG)
  * Windows: `%APPDATA%\katacut\config.json`
    Флаги `--project` / `--global` принудительно выбирают режим. ([specifications.freedesktop.org][3])

## Как применяем (автодетект клиентов)

`kcut install` сам ищет, что у тебя стоит, и кладёт настройки **только туда, где клиент есть**:

* **VS Code** — команда `code --add-mcp '{...}'` или генерация `.vscode/mcp.json` в воркспейсе. ([Visual Studio Code][4])
* **Visual Studio** — создаём/обновляем один из поддерживаемых путей (`%USERPROFILE%\.mcp.json`, `<SOLUTION>\.mcp.json`, и т.д.). ([Microsoft Learn][5])
* **Cursor** — пишем `.cursor/mcp.json` (по умолчанию глобально; проектный — флагом). ([docs.omni.co][6])
* **Claude Code** — запускаем их официальный мастер `claude mcp add …` (STDIO/HTTP). ([Claude Docs][7])

Флаги:

* `--clients=vscode,cursor,claude,vs` — на какие клиенты ставить.
* `--prefer=http|stdio` — если сервер поддерживает оба транспорта (MCP допускает оба). ([Visual Studio Code][8])
* `--dry-run` — показать план изменений (что и куда пойдёт).

## Рекомендуемая политика

* **Команда/репо/CI:** локально в `devDependencies` + `kcut ci` для детерминированной установки по lockfile (аналог `npm ci`). ([npm Docs][2])
* **Личный ноут (разово):** `npx @katacut/cli install …` — всегда свежая версия без установки. ([npm Docs][1])
* **Пауэр-юзер:** глобально, но CLI сверяет версию с проектом и предупреждает о несовпадении.

Итого: **один пакет — три способа запуска**; по умолчанию — локально и воспроизводимо, DX как у npm.

[1]: https://docs.npmjs.com/cli/v8/commands/npm-exec/?utm_source=chatgpt.com "npm-exec"
[2]: https://docs.npmjs.com/cli/v9/commands/npm-install/?utm_source=chatgpt.com "npm-install"
[3]: https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html?utm_source=chatgpt.com "XDG Base Directory Specification"
[4]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Use MCP servers in VS Code"
[5]: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022&utm_source=chatgpt.com "Use MCP Servers - Visual Studio (Windows)"
[6]: https://docs.omni.co/docs/ai/mcp/vscode?utm_source=chatgpt.com "Using the MCP Server in Visual Studio Code (VS Code)"
[7]: https://docs.claude.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[8]: https://code.visualstudio.com/api/extension-guides/ai/mcp?utm_source=chatgpt.com "MCP developer guide | Visual Studio Code Extension API"


Ок, сводка по всему, что обсудили — от GitHub MCP до нашего CLI **KataCut**.

## MCP и реестры

* **MCP** — открытый протокол (клиент ↔ сервер), транспорты: **stdio** и **HTTP (streamable)**.
* **Реестры хранят не сервера, а метаданные/манифесты**: id, transport, `command/args` или `url`, требуемые ENV, разрешения.
* **GitHub MCP Registry** — официальный каталог в экосистеме GitHub/VS Code/VS (кнопки Install).
* **Community Registry** — API-first каталог (эндпоинт `…/v0/servers`), без «витрины», даёт сырой JSON.
* Единого «мирового npm» для MCP нет. Можно держать **свой реестр** или **федератор** (агрегировать GitHub + community).

## Зачем вообще реестр

* **Поиск и единый формат установки** (машиночитаемо).
* **Безопасность/кураторство**: видны требуемые права/ENV, верификация автора.
* Готовая база для авто-установщиков/витрин (в т.ч. нашего CLI).

## Как ставят MCP сегодня

* **VS Code**: команда «MCP: Add Server» / `.vscode/mcp.json` / спец-URL из витрины GitHub.
* **Visual Studio**: читает `mcp.json` из нескольких локаций (глобально/solution и т.д.).
* **Cursor**: `.cursor/mcp.json` (глобально/проектно).
* **Claude Code**: только через `claude mcp add …` (визард).
* Поэтому «единый config» невозможен без слоя автоматизации — и это как раз **KataCut**.

## Наша концепция: KataCut = «package.json для AI»

* **Цель**: скрыть различия клиентов. Пользователь указывает только список инструментов; всё остальное — автоматом.
* **Мини-конфиг (env-only):**

  ```json
  { "version": "0.1.0", "mcp": ["github","playwright","postman"] }
  ```

  — никаких `clients/servers`, никаких маппингов секретов; ENV берём из окружения, просто проверяем наличие.

## Команды CLI (как у npm)

* `kcut install` — привести систему к состоянию из конфига/локфайла (аналог `npm install`).
* `kcut install <id>` — добавить инструмент по id из реестра и сразу применить.
* `kcut ci` — детерминированная установка строго по lockfile (для CI/чистых машин).
* `kcut prune` — удалить то, чего нет в конфиге.
* Флаги:

  * `--registry <url>` или прямой URL на API (поддержка community/GitHub/собственных).
  * `--clients=vscode,cursor,claude,vs`, `--all`, `--prefer=http|stdio`, `--dry-run`.

## Что делает `kcut install` под капотом

1. **Резолвит** запись из реестра (по id/URL): transport + URL/command/args + список ENV.
2. **Авто-детект клиентов** и установка **только туда, где клиент найден**:

   * VS Code → `.vscode/mcp.json` или их «Add Server».
   * Visual Studio → один из поддерживаемых `mcp.json` путей.
   * Cursor → `.cursor/mcp.json` (дефолт глобально; проектный — флагом).
   * Claude Code → запускает `claude mcp add …` с нужным транспортом.
3. **Проверяет ENV** (если запись требует) и выдаёт понятные подсказки.
4. **Пишет lockfile** `katacut.lock.json` (id, транспорт, точная команда/URL, куда установлено).
5. **Идемпотентность**: повторный запуск не трогает, если всё совпадает.

## Профили

* Именованные наборы инструментов:

  ```json
  { "profiles": { "work": ["github","playwright"], "light": ["filesystem"] } }
  ```
* `kcut install --profile work` / `kcut use work` — применить конкретный профиль (во все найденные клиенты).
* Для Claude профили реализуем серией `remove/add` (у них нативных профилей нет).

## Распространение CLI

* **Локально в проекте (рекомендовано)**: `npm i -D @katacut/cli` → `npx kcut …` — воспроизводимо, хорошо для команд/CI.
* **Разово**: `npx @katacut/cli install`.
* **Глобально**: `npm i -g @katacut/cli` (с проверкой версии против lockfile проекта).

## Реестр KataCut (по желанию)

* Делаем **Katacut Registry**: нормализуем записи, агрегируем **GitHub MCP Registry + community**, показываем права/ENV, публикуем кнопку «Install with kcut».
* Поддерживаем **частные реестры** (enterprise) через `--registry`.

## Архитектура (вкратце)

* Монорепо; **ядро** (план/дифф) отдельно от **адаптеров** (vscode, vs, cursor, claude, registry, telemetry).
* Но конфиг для юзера — максимально простой (только `mcp` + опциональные `profiles`).
* Алиас CLI: **`kcut`**.

Готово. Это конденсированная «истина» нашей модели и текущих реалий MCP/DX. Если нужно — соберу минимальный пример конфига и покажу, какие файлы/команды будут сгенерированы на твоей машине под выбранный профиль.
