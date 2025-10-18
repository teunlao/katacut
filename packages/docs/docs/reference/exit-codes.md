---
title: Exit Codes
---

# Exit Codes

- 0: success
  - Includes cases with missing clients (default policy).
- 1: failure
  - Apply failures (any client reports `failed > 0`).
  - `--from-lock`/`--frozen-lockfile` mismatch or missing snapshots.
  - Verification mismatch in `kc lock verify` or `kc ci`.

Future strictness
- A "fail on missing clients" flag may be introduced to enforce availability in CI.
