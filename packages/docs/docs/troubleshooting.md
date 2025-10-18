---
title: Troubleshooting
---

# Troubleshooting

Common issues

Missing client CLI
- Symptom: doctor shows `available: false`.
- Fix: install the client CLI or expose it in PATH; then re‑run `ktc install`.

Permissions on config files
- Symptom: doctor shows user/project path not writable.
- Fix: adjust file permissions or run commands with appropriate rights.

Lock mismatch
- Symptom: `--frozen-lockfile` fails.
- Fix: regenerate lock (`ktc lock generate`) or update config to match lock.

Enterprise‑managed overrides
- Symptom: changes appear ineffective.
- Fix: check enterprise paths (read‑only) and coordinate with the admin.

