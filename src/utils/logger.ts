/**
 * Structured logging utility for SuiteScript.
 *
 * Wraps N/log with consistent formatting, structured payloads,
 * and script-context tagging so logs are filterable in the
 * Execution Log viewer.
 */
import * as log from 'N/log';
import * as runtime from 'N/runtime';

export enum LogLevel {
  DEBUG = 'DEBUG',
  AUDIT = 'AUDIT',
  ERROR = 'ERROR',
  EMERGENCY = 'EMERGENCY',
}

interface LogEntry {
  script?: string;
  fn?: string;
  recordId?: string;
  [key: string]: unknown;
}

function formatDetails(details: LogEntry | string | Error): string {
  if (details instanceof Error) {
    return JSON.stringify({
      name: details.name,
      message: details.message,
      stack: details.stack,
    });
  }
  if (typeof details === 'string') {
    return details;
  }
  return JSON.stringify(details);
}

function getScriptId(): string {
  try {
    return runtime.getCurrentScript().id;
  } catch (_e) {
    return 'unknown';
  }
}

function write(level: LogLevel, title: string, details: LogEntry | string | Error): void {
  const formatted = formatDetails(details);
  const prefixedTitle = `[${getScriptId()}] ${title}`;

  switch (level) {
    case LogLevel.DEBUG:
      log.debug({ title: prefixedTitle, details: formatted });
      break;
    case LogLevel.AUDIT:
      log.audit({ title: prefixedTitle, details: formatted });
      break;
    case LogLevel.ERROR:
      log.error({ title: prefixedTitle, details: formatted });
      break;
    case LogLevel.EMERGENCY:
      log.emergency({ title: prefixedTitle, details: formatted });
      break;
  }
}

export const Logger = {
  debug(title: string, details: LogEntry | string = ''): void {
    write(LogLevel.DEBUG, title, details);
  },
  audit(title: string, details: LogEntry | string = ''): void {
    write(LogLevel.AUDIT, title, details);
  },
  error(title: string, details: LogEntry | string | Error): void {
    write(LogLevel.ERROR, title, details);
  },
  emergency(title: string, details: LogEntry | string | Error): void {
    write(LogLevel.EMERGENCY, title, details);
  },
};
