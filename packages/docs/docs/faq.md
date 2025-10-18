---
title: FAQ
---

# FAQ

Why prune by default?
- It matches user expectations from package managers: the system converges to
  the desired state described in the config and lock.

Does missing client fail the command?
- By default, no. It is reported as skipped; a strict flag may be added for CI.

Where are my user configs?
- See Reference → Clients & Paths for OS‑specific locations.

How do I preview changes?
- Use `--dry-run` to print the plan without applying.

How do I sync strictly from lock?
- Use `--frozen-lockfile` (or `--from-lock` to ignore config entirely).

