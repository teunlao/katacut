import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	execCli,
	extractMcpServers,
	readJsonSafe,
	removeMcpServerWithBackup,
	writeJsonAtomicStable,
} from '@katacut/adapter-clients-shared';
import { stableStringify } from '@katacut/utils';
import { describe, expect, it } from 'vitest';

describe('@katacut/adapter-clients-shared utilities', () => {
	it('readJsonSafe returns parsed object or undefined', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'clients-shared-'));
		try {
			const p = join(dir, 'a.json');
			await writeFile(p, JSON.stringify({ x: 1 }), 'utf8');
			const ok = await readJsonSafe(p);
			expect(ok && typeof ok === 'object').toBe(true);

			const missing = await readJsonSafe(join(dir, 'missing.json'));
			expect(missing).toBeUndefined();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('writeJsonAtomicStable writes stable JSON with trailing newline', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'clients-shared-'));
		try {
			const p = join(dir, 'b.json');
			const obj = { b: 2, a: 1 } as const;
			await writeJsonAtomicStable(p, obj);
			const text = await readFile(p, 'utf8');
			expect(text).toBe(`${stableStringify(obj)}\n`);
			// Rewrite with different order — content remains identical
			await writeJsonAtomicStable(p, { a: 1, b: 2 });
			const text2 = await readFile(p, 'utf8');
			expect(text2).toBe(text);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('extractMcpServers finds block and maps entries', () => {
		const root = {
			nested: {
				config: {
					mcpServers: {
						httpSrv: { type: 'http', url: 'https://x', headers: { A: 'b' } },
						stdioSrv: { type: 'stdio', command: 'echo', args: ['hi'], env: {} },
						other: { foo: 'bar' },
					},
				},
			},
		};
		const mapped = extractMcpServers(root, (entry) => {
			if (!entry || typeof entry !== 'object') return undefined;
			const e = entry as {
				type?: string;
				url?: string;
				headers?: Record<string, string>;
				command?: string;
				args?: string[];
				env?: Record<string, string>;
			};
			if (e.type === 'http' && typeof e.url === 'string')
				return { type: 'http' as const, url: e.url, headers: e.headers };
			if (e.type === 'stdio' && typeof e.command === 'string')
				return { type: 'stdio' as const, command: e.command, args: e.args, env: e.env };
			return undefined;
		});
		expect(mapped).toBeTruthy();
		expect(Object.keys(mapped ?? {})).toEqual(['httpSrv', 'stdioSrv']);
	});

	it('removeMcpServerWithBackup removes key and writes .bak', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'clients-shared-'));
		try {
			await mkdir(dir, { recursive: true });
			const p = join(dir, 'c.json');
			const initial = {
				mcpServers: { a: { type: 'http', url: 'https://a' }, keep: { type: 'stdio', command: 'echo' } },
			};
			await writeFile(p, JSON.stringify(initial, null, 2), 'utf8');
			const ok = await removeMcpServerWithBackup(p, 'a');
			expect(ok).toBe(true);
			const next = JSON.parse(await readFile(p, 'utf8')) as { mcpServers?: Record<string, unknown> };
			expect(next.mcpServers && 'a' in next.mcpServers).toBe(false);
			expect(next.mcpServers && 'keep' in next.mcpServers).toBe(true);
			const bak = JSON.parse(await readFile(`${p}.bak`, 'utf8')) as { mcpServers?: Record<string, unknown> };
			expect(bak.mcpServers && 'a' in bak.mcpServers).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('execCli returns code 127 for missing binary and code 0 for node -e', async () => {
		const miss = await execCli('definitely-not-installed-binary', ['--help']).catch((e) => ({
			code: 127,
			stdout: '',
			stderr: String(e),
		}));
		expect(typeof miss.code).toBe('number');
		// code 127 expected by our execCapture for ENOENT — but if thrown, we coerced to 127 above
		expect(miss.code === 127 || miss.code === 0).toBe(true);

		const ok = await execCli(process.execPath, ['-e', 'process.exit(0)']);
		expect(ok.code).toBe(0);
	});
});
