import { getProfile, PROFILES } from '../index';

describe('business profiles', () => {
  it('falls back to general for unknown or empty ids', () => {
    expect(getProfile(undefined).id).toBe('general');
    expect(getProfile('').id).toBe('general');
    expect(getProfile('bakery').id).toBe('general');
  });

  it('resolves known profiles', () => {
    expect(getProfile('manufacturing').modules.production).toBe(true);
    expect(getProfile('retail').modules.dailySales).toBe(true);
  });

  it('keeps scrap rates in a sane range', () => {
    for (const p of Object.values(PROFILES)) {
      expect(p.production.scrapRate).toBeGreaterThanOrEqual(0);
      expect(p.production.scrapRate).toBeLessThan(1);
    }
  });
});
