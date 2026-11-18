/**
 * Mock for N/log — captures log calls for test assertions.
 */
const logs: Array<{ level: string; title: string; details: string }> = [];

export function debug(options: { title: string; details: string }): void {
  logs.push({ level: 'DEBUG', ...options });
}

export function audit(options: { title: string; details: string }): void {
  logs.push({ level: 'AUDIT', ...options });
}

export function error(options: { title: string; details: string }): void {
  logs.push({ level: 'ERROR', ...options });
}

export function emergency(options: { title: string; details: string }): void {
  logs.push({ level: 'EMERGENCY', ...options });
}

/** Test helper: get all captured logs */
export function _getLogs(): typeof logs {
  return logs;
}

/** Test helper: clear captured logs */
export function _clearLogs(): void {
  logs.length = 0;
}
