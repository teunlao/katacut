
# CI Examples (GitHub Actions)

These snippets run KataCut checks in CI. They assume `pnpm` is available.

## Verify lockfile against current state (recommended)

```yaml
name: kataCut CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Verify KataCut lockfile
        run: pnpm kc ci --client claude-code
```

## Generate lockfile from config (no apply)

```yaml
jobs:
  lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Generate lockfile
        run: pnpm kc lock generate --client claude-code --scope project -c katacut.config.jsonc --out katacut.lock.json
      - name: Upload lockfile artifact
        uses: actions/upload-artifact@v4
        with:
          name: katacut-lock
          path: katacut.lock.json
```

## Strict frozen install (no changes allowed)

```yaml
jobs:
  frozen:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Frozen install (no changes)
        run: pnpm kc install --client claude-code --frozen-lock -c katacut.config.jsonc
```

Notes:
- `kc ci` exits with non-zero status on mismatches, which fails the job.
- If your project uses a different client, change `--client` accordingly.
