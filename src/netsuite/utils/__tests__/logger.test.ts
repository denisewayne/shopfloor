/**
 * Tests for the structured Logger.
 */
import { Logger } from '../../utils/logger';
import { _getLogs, _clearLogs } from '../../../../test/__mocks__/N/log';

describe('Logger', () => {
  beforeEach(() => {
    _clearLogs();
  });

  it('logs debug messages', () => {
    Logger.debug('test title', 'test details');
    const logs = _getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('DEBUG');
    expect(logs[0].title).toContain('test title');
  });

  it('logs audit messages', () => {
    Logger.audit('audit title');
    const logs = _getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('AUDIT');
    expect(logs[0].title).toContain('audit title');
  });

  it('logs error messages with Error objects', () => {
    const error = new Error('something broke');
    Logger.error('error title', error);
    const logs = _getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('ERROR');
    expect(logs[0].details).toContain('something broke');
  });

  it('logs emergency messages', () => {
    Logger.emergency('critical failure', 'system down');
    const logs = _getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('EMERGENCY');
  });

  it('prefixes title with script ID', () => {
    Logger.debug('my title');
    const logs = _getLogs();
    expect(logs[0].title).toContain('[customscript_test]');
    expect(logs[0].title).toContain('my title');
  });

  it('serializes object details to JSON', () => {
    Logger.debug('test', { fn: 'create', recordId: '123' } as unknown as string);
    const logs = _getLogs();
    const details = logs[0].details;
    expect(details).toContain('create');
    expect(details).toContain('123');
  });
});
