import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { computeFingerprint, type Scope, type ServerJson } from "@katacut/core";

export interface StateEntry {
  readonly scope: Scope;
  readonly fingerprint?: string;
  readonly outcome: "add" | "update" | "remove" | "skip" | "failed";
}

export interface StateRunSummary { readonly added: number; readonly updated: number; readonly removed: number; readonly failed: number }

export interface StateRun {
  readonly at: string;
  readonly client: string;
  readonly requestedScope: Scope;
  readonly realizedScope: Scope;
  readonly mode: "native" | "emulated";
  readonly intent: "project" | "local";
  readonly result: StateRunSummary;
  readonly entries: Record<string, StateEntry>;
}

export interface ProjectState {
  readonly version: "1";
  readonly project?: { readonly root?: string };
  readonly runs: StateRun[];
}

function hasRunsArray(x: unknown): x is { runs: unknown } {
  return Boolean(x) && typeof x === "object" && "runs" in (x as Record<string, unknown>);
}

export async function readProjectState(cwd = process.cwd()): Promise<ProjectState | undefined> {
  try {
    const text = await readFile(join(cwd, ".katacut", "state.json"), "utf8");
    const parsed: unknown = JSON.parse(text);
    if (!hasRunsArray(parsed) || !Array.isArray(parsed.runs)) return undefined;
    // justified: persisted file is produced by this module; structure is controlled here
    return parsed as ProjectState;
  } catch {
    return undefined;
  }
}

async function writeJsonAtomic(path: string, json: unknown) {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(json, null, 2), "utf8");
  await rename(tmp, path);
}

export async function appendProjectStateRun(cwd: string, run: StateRun, keep = 20) {
  const path = join(cwd, ".katacut", "state.json");
  const existing = (await readProjectState(cwd)) ?? { version: "1" as const, runs: [] };
  const runs = [run, ...existing.runs].slice(0, Math.max(1, keep));
  const next: ProjectState = { version: "1", project: { root: cwd }, runs };
  await writeJsonAtomic(path, next);
}

export function buildStateEntries(
  plan: readonly { action: "add" | "update" | "remove" | "skip"; name: string; json?: ServerJson }[],
  desired: Record<string, ServerJson>,
  current: Record<string, ServerJson>,
  scope: Scope,
): Record<string, StateEntry> {
  const out: Record<string, StateEntry> = {};
  for (const step of plan) {
    const name = step.name;
    if (step.action === "remove") {
      out[name] = { scope, outcome: "remove" };
      continue;
    }
    const src: ServerJson | undefined = step.action === "skip" ? current[name] : desired[name];
    const fp = src ? computeFingerprint(src) : undefined;
    out[name] = { scope, fingerprint: fp, outcome: step.action };
  }
  return out;
}
