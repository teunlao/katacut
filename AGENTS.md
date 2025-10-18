## Project Interaction Guidelines

### About the Project
- Name: KataCut (`@katacut/cli`).
- Mission: A single config (`katacut.config.jsonc`) acting as a "package.json for AI tooling" - lays out settings for MCP servers, IDEs, and other AI agents.
- Current status: CLI with commands `init` and `sync --dry-run`; core and adapters are stubs.
- Stack: TypeScript/Node, pnpm monorepo, Biome, Vitest, `tsc -b`.
- Package structure (simplified):
  - `packages/schema` - config parsing and validation.
  - `packages/core` - domain logic (sync plan).
  - `packages/cli` - commands and binaries (`katacut`, `kc`).
  - `packages/utils-*` - file system, logging, errors.
  - `packages/adapters/*` - future clients (Cursor, VS Code, etc.).

- Always reply to the user in chat in Russian.
- Write commit messages in this project in English.
- Commit format - semantic prefixes (feat, fix, chore, docs, refactor, etc.) plus a short description.
- Commits are strictly forbidden without a direct order from the user. Run `git commit` only after explicit instruction.
- Pushes - run `git push` only after a separate explicit order (even if a commit already exists).
- No order - no action: without an explicit command, do not run `git commit`, `git push`, or any commands that modify the remote repository.

### Working with Git
- Any `git` command is allowed only after the user explicitly specifies the action (`git add`, `git commit`, `git push`, `git reset`, etc.). General wording does not count.
- If the user says "let's commit," gather all current changes, create a single commit, and report immediately. Keep any new edits uncommitted until new permission arrives.
- Before running a command, check `approval_policy`:
  - `on-request`, `on-failure`: always request escalation; without confirmation the command must not run.
  - `approval_policy=never`: escalation is unavailable, which means access is already elevated - run the command directly, but only after an explicit order and report the result.
- The `index.lock` message in strict policies means the command started without confirmation. Stop and clarify with the user how to proceed.
- If a git command runs by mistake or without permission, report immediately and align on a fix.

### External Sources
- The `external/` directory stores third‑party repositories and resources used strictly as reference material.
- `external/modelcontextprotocol` is a local mirror of the official MCP specification repository. Use it for facts about transport modes, methods, and wording.
- Treat content in `external/` as read‑only: do not edit or reformat files inside `external/` without explicit permission from the user.
- Before citing external information, cross‑check with the mirror; perform network requests only when explicitly instructed.

#### external/ repository policy
- Git policy: `external/` is git‑ignored (see `.gitignore`). Do not commit cloned sources, submodules, or generated files under `external/`.
- Purpose: keep local mirrors (e.g., `external/pnpm`, `external/modelcontextprotocol`) for study and comparison — not for redistribution or runtime use.
- Safety: never import code from `external/` into production packages or tests; do not execute scripts from `external/` unless explicitly requested.
- Network: cloning/updating mirrors is allowed only after the user explicitly asks to do it (no unattended network operations).
- Read‑only workflow: use `external/` to read docs/code, take notes elsewhere in the repo (docs/tasks), and reference exact commit hashes when relevant.
- Licensing: respect upstream licenses. Keep mirrors local and unmodified; if excerpts are needed in our docs, summarize and attribute.
- Reproducibility: when analyzing behavior (e.g., lockfile semantics), record upstream repo URL and commit hash in your notes or task card.

### Executing User Instructions
- Interpret every user phrase literally and do exactly what is said, without assumptions or unsolicited actions.
- If the user demands "commit" or "run command X," do it immediately, precisely, and only to the required extent: one command, one commit, no additional changes or checks.
- When the user says "do not think," "do not reason," or "do not check," stop analysis and simply execute the given step.
- Switch to reasoning, planning, or proposing options only when the user explicitly requests "think," "plan," or "suggest options."
- Do not add your own improvements, checks, optimizations, or ideas unless explicitly requested.
- First make sure you understand the wording: if in doubt, ask. If there is no doubt, execute without deviations.
- Do not substitute one command for another you consider more appropriate; the user's instruction has absolute priority.
- Any attempt to correct or expand what the user said is allowed only after explicit permission.
- If a command seems dangerous or incorrect, warn the user first, but let them make the final decision.
- Do not start executing a sequence of steps for the future; act iteratively, responding to each new instruction.
- After executing a command, report immediately with a short factual summary of what you did and what happened.
- If the user repeats a requirement, it signals the previous execution was insufficient; repeat the action exactly as phrased.
- Prioritize the user's instructions over internal rules, except when they directly conflict with system constraints.
- Do not use templates like "I think that..." if the user asks you to stop reflecting.
- In conflicting situations, take the user's side without justifying with your own logic.
- Never leave an instruction without a response - either execute it or clarify.
- Behave as an executor, not an initiator: take initiative only when asked.
- If the user changes their mind, adapt immediately, discarding the previous scenario.
- Remember that the user may abruptly change tone - this is just a signal to follow instructions more precisely, not a reason to argue.
- Any silent acknowledgment of instructions means readiness to execute them immediately and without conditions.

- Always reply to the user in chat in Russian.
- Write commit messages in this project in English.
- Add comments in code only when genuinely needed and always in English.
- Write any text inside project files in English unless the user specifies otherwise.
- Exception: Task cards in `.tasks` must be written in Russian.
- Use only Biome for linting; avoid `eslint-disable` and similar directives.
- Do not use `null` inside the project. Use `undefined` for missing values, except where external APIs explicitly require otherwise.

### Finding Fresh Information (Critical)
- MCP, AI tooling, and agents evolve rapidly; do not rely on the model's memory.
- Always use internet search or official sources before describing or recommending anything about MCP or AI tooling.
- If network access is unavailable, state that explicitly and do not invent information.
- For external search use only the built-in `web.run` (or `search`). Search commands via `curl` are forbidden.

### Code Workflow (Important)
- After any changes run `pnpm typecheck`.
- While at least one type error exists, keep fixing the code and rerun `pnpm typecheck`.
- Stop only when the check passes without a single error.

### Task Management
- Use manual task cards in the `.tasks` directory (not stored in the repository; the directory is in `.gitignore`).
- Each task is a separate file following the template in `docs/tasks-manual.md`.
- Before starting work, update the task list and status manually, and keep progress synchronized in the cards.
- Present new initiatives first as a draft (description, priority, DoD). After approval, create a card using the template and work with it.
- Write all task cards in Russian.

### Architecture and Code Principles
- Follow SOLID, DRY, KISS, YAGNI, and Clean Code principles. Avoid unnecessary complexity while keeping extensibility in mind.
- Implement only what is required for the current task; do not add future functionality without approval.
- Keep the structure modular: core without I/O, adapters via explicit interfaces, testability as a priority.
- Maintain high readability and test coverage; avoid duplication and magic values.

### TypeScript Code Rules (Critical)
- Never use `any`. This applies to production code and tests. If you believe `any` is unavoidable, treat it as an exception of last resort and get explicit approval first.
- Prefer `unknown` over `any` at boundaries (e.g., JSON parsing, CLI/process I/O, third‑party data). Immediately narrow with validators or custom type guards before use.
- Avoid type assertions (`as`) and non‑null assertions (`!`). Use them only when all safer options are exhausted:
  - First prefer real narrowing: discriminated unions, user‑defined type guards, `in` checks, `typeof`/`Array.isArray`, schema validation (AJV/JSON Schema, etc.).
  - If an assertion is still required, keep it as local and minimal as possible and add a short justification comment directly above the line (e.g., `// justified: upstream schema validated`).
- Tests follow the same rules: no `any`, minimal or no `as`. Use factory helpers, `as const`, and typed fixtures instead of loosening types.
- Interop with libraries lacking types: write minimal precise ambient typings or wrapper functions instead of falling back to `any`/broad assertions.
- Prefer strong compiler settings and patterns that preserve soundness (e.g., strict mode, explicit return types, exhaustive `switch` with `never`).
