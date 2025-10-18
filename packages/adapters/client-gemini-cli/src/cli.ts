import { execCapture } from '@katacut/utils';
import type { GeminiScope } from './types.js';

export async function ensureGeminiAvailable(): Promise<boolean> {
	const res = await execCapture('gemini', ['--version'], {});
	return res.code === 0;
}

export async function addOrUpdateGeminiServer(
	name: string,
	json: import('@katacut/core').ServerJson,
	scope: GeminiScope,
	cwd = process.cwd(),
): Promise<{ code: number; stderr: string }> {
	if (json.type === 'stdio') {
		const args = ['mcp', 'add', name, json.command, ...(json.args ?? []), '--scope', scope];
		const res = await execCapture('gemini', args, { cwd });
		return { code: res.code, stderr: res.stderr };
	}
	const flatHeaders: string[] = [];
	if (json.type === 'http' || json.type === 'sse') {
		const headers = json.headers;
		if (headers) {
			for (const [k, v] of Object.entries(headers)) {
				flatHeaders.push('--header', `${k}: ${v}`);
			}
		}
	}
	if (json.type === 'http') {
		const args = ['mcp', 'add', '--transport', 'http', name, json.url, ...flatHeaders, '--scope', scope];
		const res = await execCapture('gemini', args, { cwd });
		return { code: res.code, stderr: res.stderr };
	}
	// sse
	const args = ['mcp', 'add', '--transport', 'sse', name, json.url, ...flatHeaders, '--scope', scope];
	const res = await execCapture('gemini', args, { cwd });
	return { code: res.code, stderr: res.stderr };
}

export async function removeGeminiServer(name: string, scope: GeminiScope, cwd = process.cwd()) {
	const res = await execCapture('gemini', ['mcp', 'remove', name, '--scope', scope], { cwd });
	return { code: res.code, stderr: res.stderr };
}
