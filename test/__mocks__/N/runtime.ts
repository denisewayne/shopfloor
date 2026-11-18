/**
 * Mock for N/runtime — returns canned values for governance testing.
 */

let _remainingUsage = 10000;

export const executionContext = 'userinterface';

export function getCurrentScript(): {
  id: string;
  deploymentId: string;
  getRemainingUsage: () => number;
  getParameter: (options: { name: string }) => string | number | boolean | null;
} {
  return {
    id: 'customscript_test',
    deploymentId: 'customdeploy_test',
    getRemainingUsage: () => _remainingUsage,
    getParameter: (_options: { name: string }) => null,
  };
}

/** Test helper: set remaining usage for governance tests */
export function _setRemainingUsage(value: number): void {
  _remainingUsage = value;
}
