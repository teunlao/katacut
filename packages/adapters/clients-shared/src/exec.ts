import { execCapture } from '@katacut/utils';

export interface ExecCliOptions {
	readonly cwd?: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly timeoutMs?: number;
}

export async function execCli(
	file: string,
	args: readonly string[],
	options: ExecCliOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
	const timeoutMs = options.timeoutMs ?? 60_000;
	const res = await execCapture(file, args, { cwd: options.cwd, env: options.env, timeoutMs });
	return { code: res.code, stdout: res.stdout, stderr: res.stderr };
}
