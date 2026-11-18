/**
 * Tests for governance utilities.
 */
import { getRemainingUsage, shouldYield, isContext } from '../../utils/governance';
import { _setRemainingUsage } from '../../../../test/__mocks__/N/runtime';

describe('governance', () => {
  afterEach(() => {
    _setRemainingUsage(10000);
  });

  describe('getRemainingUsage', () => {
    it('returns the mocked remaining usage', () => {
      _setRemainingUsage(5000);
      expect(getRemainingUsage()).toBe(5000);
    });
  });

  describe('shouldYield', () => {
    it('returns false when usage is above threshold', () => {
      _setRemainingUsage(5000);
      expect(shouldYield()).toBe(false);
    });

    it('returns true when usage is at the threshold', () => {
      _setRemainingUsage(100);
      expect(shouldYield()).toBe(true);
    });

    it('returns true when usage is below the threshold', () => {
      _setRemainingUsage(50);
      expect(shouldYield()).toBe(true);
    });

    it('respects a custom threshold', () => {
      _setRemainingUsage(500);
      expect(shouldYield(1000)).toBe(true);
      expect(shouldYield(200)).toBe(false);
    });
  });

  describe('isContext', () => {
    it('returns true when current context matches', () => {
      // The mock returns 'userinterface'
      expect(isContext('userinterface')).toBe(true);
    });

    it('returns true when any of the contexts match', () => {
      expect(isContext('scheduled', 'userinterface', 'csvimport')).toBe(true);
    });

    it('returns false when no contexts match', () => {
      expect(isContext('scheduled', 'mapreduce')).toBe(false);
    });
  });
});
