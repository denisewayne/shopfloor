/**
 * Governance-aware helpers for SuiteScript.
 *
 * Every long-running script (Scheduled, Map/Reduce, mass-update)
 * must check remaining governance units and yield before hitting
 * the ceiling. These helpers standardise that pattern.
 */
import * as runtime from 'N/runtime';
import { Governance } from '../constants';
import { Logger } from './logger';

/**
 * Returns the remaining governance units for the current script.
 */
export function getRemainingUsage(): number {
  return runtime.getCurrentScript().getRemainingUsage();
}

/**
 * Returns true when remaining units are at or below the yield threshold.
 * Use in loop guards:
 *
 *   while (hasWork && !shouldYield()) { ... }
 */
export function shouldYield(threshold: number = Governance.YIELD_THRESHOLD): boolean {
  return getRemainingUsage() <= threshold;
}

/**
 * Logs remaining usage at DEBUG level — useful at loop boundaries.
 */
export function logUsage(label: string): void {
  Logger.debug(`Governance [${label}]`, {
    remaining: getRemainingUsage(),
  } as unknown as string);
}

/**
 * Returns the current script's deployment parameter value.
 */
export function getScriptParameter(name: string): string | number | boolean | null {
  const script = runtime.getCurrentScript();
  const value = script.getParameter({ name });
  return value as string | number | boolean | null;
}

/**
 * Returns the current execution context (e.g. 'userinterface', 'scheduled').
 */
export function getExecutionContext(): string {
  return runtime.executionContext;
}

/**
 * Checks whether the current execution context matches any of the given contexts.
 */
export function isContext(...contexts: string[]): boolean {
  return contexts.includes(getExecutionContext());
}
