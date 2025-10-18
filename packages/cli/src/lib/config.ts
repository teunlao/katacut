import { resolve } from "node:path";
import { DEFAULT_CONFIG_FILENAMES, resolveConfigPath } from "@katacut/core";
import { parseConfig, type KatacutConfig } from "@katacut/schema";
import { readConfigFile } from "@katacut/utils";

export async function loadAndValidateConfig(explicitPath?: string): Promise<KatacutConfig> {
	const cwd = process.cwd();
	const path = explicitPath ? resolve(cwd, explicitPath) : await resolveConfigPath({ cwd });
	if (!path) throw new Error(`Configuration file not found. Checked: ${DEFAULT_CONFIG_FILENAMES.join(", ")}`);
	const source = await readConfigFile(path);
	const result = parseConfig(source);
	if (result.issues.length > 0 || !result.config) {
		const message = result.issues.map((i) => `Config error at ${i.path}: ${i.message}`).join("\n");
		throw new Error(message || "Invalid configuration");
	}
	return result.config;
}
