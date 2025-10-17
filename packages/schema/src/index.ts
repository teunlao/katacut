import { parse } from 'jsonc-parser';

export type KatacutConfig = Record<string, unknown>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ConfigValidationResult {
  config: KatacutConfig | null;
  issues: ValidationIssue[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConfig(source: string): ConfigValidationResult {
  try {
    const parsed = parse(source);
    if (!isPlainObject(parsed)) {
      return {
        config: null,
        issues: [
          {
            path: '',
          message: 'Configuration must be an object'
          }
        ]
      };
    }

    return { config: parsed, issues: [] };
  } catch (error) {
    return {
      config: null,
      issues: [
        {
          path: '',
          message: error instanceof Error ? error.message : 'Unknown parsing error'
        }
      ]
    };
  }
}
