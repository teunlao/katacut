export class KatacutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KatacutError';
  }
}

export class ConfigValidationError extends KatacutError {
  constructor(public readonly issues: Array<{ path: string; message: string }>) {
    super('Configuration validation failed');
  }
}
