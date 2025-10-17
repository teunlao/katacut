import { execFile } from "node:child_process";

export interface ExecCaptureOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

export interface ExecCaptureResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export function execCapture(
  file: string,
  args: readonly string[],
  options: ExecCaptureOptions = {},
): Promise<ExecCaptureResult> {
  const { cwd, env, timeoutMs } = options;
  return new Promise((resolve) => {
    const child = execFile(file, args as string[], { cwd, env, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({ code: 127, stdout: "", stderr: String(stderr ?? "") });
        return;
      }
      const code = (error as unknown as { code?: number })?.code ?? 0;
      resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
  });
}
