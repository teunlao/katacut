export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  readonly name: string;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const payload = {
      level,
      name: this.options.name,
      message,
      context: context ?? {},
      timestamp: new Date().toISOString()
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
