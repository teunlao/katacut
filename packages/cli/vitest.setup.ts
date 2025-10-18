import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Create an isolated working directory for each test file execution.
// This prevents accidental writes (e.g., katacut.lock.json) into the repo root
// when a test forgets to stub/mocķ process.cwd().
const base = tmpdir();
const dir = mkdtempSync(join(base, 'kc-cli-vitest-'));

// In Vitest worker threads, process.chdir is not supported.
// Instead, override process.cwd() to point to the temp dir.
const originalCwd = process.cwd.bind(process);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
Object.defineProperty(process, 'cwd', { value: () => dir });

// Best-effort cleanup on process exit. Tests may spawn workers, so ignore errors.
process.on('exit', () => {
	try {
		rmSync(dir, { recursive: true, force: true });
	} catch {
		// ignore
	}
	// restore original cwd for safety in parent process
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	Object.defineProperty(process, 'cwd', { value: originalCwd });
});
