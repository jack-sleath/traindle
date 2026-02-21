import { describe, it, expect } from 'vitest';
import { evaluateGuess } from './evaluateGuess';
import type { Station } from './types';

const base: Station = {
  name: 'Manchester Piccadilly',
  crs: 'MAN',
  operators: ['Avanti West Coast'],
  region: 'North West',
  platforms: 14,
  footfallBand: '10m+',
  stationType: 'interchange',
};

function station(overrides: Partial<Station>): Station {
  return { ...base, ...overrides };
}

describe('evaluateGuess', () => {
  describe('operator', () => {
    it('returns correct when operators match', () => {
      const result = evaluateGuess(base, base);
      expect(result.operator).toBe('correct');
    });

    it('returns wrong when operators differ', () => {
      const mystery = station({ operators: ['Northern'] });
      const result = evaluateGuess(base, mystery);
      expect(result.operator).toBe('wrong');
    });
  });

  describe('region', () => {
    it('returns correct when regions match', () => {
      const result = evaluateGuess(base, base);
      expect(result.region).toBe('correct');
    });

    it('returns close-NE for adjacent regions (North West → North East)', () => {
      const guess = station({ region: 'North West' });
      const mystery = station({ region: 'North East' });
      const result = evaluateGuess(guess, mystery);
      expect(result.region).toBe('close-NE');
    });

    it('returns close-E for adjacent regions (North West → Yorkshire)', () => {
      const guess = station({ region: 'North West' });
      const mystery = station({ region: 'Yorkshire' });
      const result = evaluateGuess(guess, mystery);
      expect(result.region).toBe('close-E');
    });

    it('returns far-S for non-adjacent regions (Scotland → South West)', () => {
      const guess = station({ region: 'Scotland' });
      const mystery = station({ region: 'South West' });
      const result = evaluateGuess(guess, mystery);
      expect(result.region).toBe('far-S');
    });

    it('returns close-NE for Wales → North West (adjacent)', () => {
      const guess = station({ region: 'Wales' });
      const mystery = station({ region: 'North West' });
      const result = evaluateGuess(guess, mystery);
      expect(result.region).toBe('close-NE');
    });
  });

  describe('platforms', () => {
    it('returns correct when platform counts match', () => {
      const result = evaluateGuess(base, base);
      expect(result.platforms).toBe('correct');
    });

    it('returns higher when mystery has more platforms', () => {
      const guess = station({ platforms: 4 });
      const mystery = station({ platforms: 14 });
      const result = evaluateGuess(guess, mystery);
      expect(result.platforms).toBe('higher');
    });

    it('returns lower when mystery has fewer platforms', () => {
      const guess = station({ platforms: 14 });
      const mystery = station({ platforms: 4 });
      const result = evaluateGuess(guess, mystery);
      expect(result.platforms).toBe('lower');
    });
  });

  describe('footfallBand', () => {
    it('returns correct when bands match', () => {
      const result = evaluateGuess(base, base);
      expect(result.footfallBand).toBe('correct');
    });

    it('returns higher when mystery is in a higher band', () => {
      const guess = station({ footfallBand: '<10k' });
      const mystery = station({ footfallBand: '10m+' });
      const result = evaluateGuess(guess, mystery);
      expect(result.footfallBand).toBe('higher');
    });

    it('returns lower when mystery is in a lower band', () => {
      const guess = station({ footfallBand: '10m+' });
      const mystery = station({ footfallBand: '<10k' });
      const result = evaluateGuess(guess, mystery);
      expect(result.footfallBand).toBe('lower');
    });

    it('returns correct for adjacent band check', () => {
      const guess = station({ footfallBand: '100k-500k' });
      const mystery = station({ footfallBand: '100k-500k' });
      const result = evaluateGuess(guess, mystery);
      expect(result.footfallBand).toBe('correct');
    });
  });

  describe('stationType', () => {
    it('returns correct when types match', () => {
      const result = evaluateGuess(base, base);
      expect(result.stationType).toBe('correct');
    });

    it('returns wrong when types differ (interchange vs through)', () => {
      const mystery = station({ stationType: 'through' });
      const result = evaluateGuess(base, mystery);
      expect(result.stationType).toBe('wrong');
    });

    it('returns wrong when types differ (interchange vs terminus)', () => {
      const mystery = station({ stationType: 'terminus' });
      const result = evaluateGuess(base, mystery);
      expect(result.stationType).toBe('wrong');
    });
  });

  describe('combined result', () => {
    it('returns all-correct when guess equals mystery', () => {
      const result = evaluateGuess(base, base);
      expect(result).toEqual({
        operator: 'correct',
        region: 'correct',
        platforms: 'correct',
        footfallBand: 'correct',
        stationType: 'correct',
      });
    });

    it('returns mixed result for a partial match', () => {
      const guess = station({ region: 'North East', platforms: 2, footfallBand: '<10k' });
      const result = evaluateGuess(guess, base);
      expect(result.operator).toBe('correct'); // same operator (from base)
      expect(result.region).toBe('close-SW');   // North East is adjacent to North West; NW is to the south-west
      expect(result.platforms).toBe('higher'); // mystery has 14, guess has 2
      expect(result.footfallBand).toBe('higher'); // mystery is 10m+, guess is <100k
      expect(result.stationType).toBe('correct'); // both interchange
    });
  });
});
