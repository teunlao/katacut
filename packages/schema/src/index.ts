import type { ErrorObject } from "ajv";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { type ParseError, parse, printParseErrorCode } from "jsonc-parser";

import schemaJson from "./schema.json" with { type: "json" };
import type { KatacutConfig } from "./types.js";

export interface ValidationIssue {
	path: string;
	message: string;
}

export interface ConfigValidationResult {
	config?: KatacutConfig;
	issues: ValidationIssue[];
}

const ajv = new Ajv({
	allErrors: true,
	allowUnionTypes: true,
	strict: false,
});

(addFormats as unknown as (ajv: Ajv) => void)(ajv);

const validate = ajv.compile<KatacutConfig>(schemaJson as unknown as Record<string, unknown>);

function normalizePath(path?: string) {
	if (!path) return "";
	return path.replace(/^\//, "").replace(/\//g, ".");
}

function formatIssueMessage(issue: ErrorObject) {
	if (issue.message) return issue.message;
	return ajv.errorsText([issue], { dataVar: "config" });
}

function mapParseError(error: ParseError): ValidationIssue {
	return {
		path: "",
		message: `Parse error: ${printParseErrorCode(error.error)} at offset ${error.offset}`,
	};
}

export function parseConfig(source: string): ConfigValidationResult {
	const parseErrors: ParseError[] = [];
	const parsed = parse(source, parseErrors, {
		allowTrailingComma: true,
		disallowComments: false,
	});

	if (parseErrors.length > 0) {
		return { issues: parseErrors.map(mapParseError) };
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {
			issues: [
				{
					path: "",
					message: "Configuration must be a JSON object",
				},
			],
		};
	}

	if (!validate(parsed)) {
		const issues = (validate.errors ?? []).map((issue) => ({
			path: normalizePath(issue.instancePath),
			message: formatIssueMessage(issue),
		}));
		return { issues };
	}

	return {
		config: parsed as KatacutConfig,
		issues: [],
	};
}

export type { KatacutConfig } from "./types.js";
