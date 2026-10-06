import { describe, it, expect } from '@jest/globals';
import { clampBudgetPhp, formatPhp, parseDimensionParam } from '@/utils/designFlowFormat';

describe('designFlowFormat', () => {
  it('formats Philippine peso amounts', () => {
    expect(formatPhp(30000)).toBe('₱30,000');
    expect(formatPhp(0)).toBe('₱0');
  });

  it('clamps budget to the allowed range', () => {
    expect(clampBudgetPhp(1000, 5000, 500000)).toBe(5000);
    expect(clampBudgetPhp(900000, 5000, 500000)).toBe(500000);
    expect(clampBudgetPhp(30000, 5000, 500000)).toBe(30000);
  });

  it('parses positive dimension route params', () => {
    expect(parseDimensionParam('4.2')).toBe(4.2);
    expect(parseDimensionParam(['3.1'])).toBe(3.1);
    expect(parseDimensionParam('0')).toBeUndefined();
    expect(parseDimensionParam('nope')).toBeUndefined();
  });
});
