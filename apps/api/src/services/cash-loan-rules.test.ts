import { describe, expect, it } from 'vitest';
import { maximumCashLoanKes, overdueFineKes } from './cash-loan-rules.js';

describe('cash loan money rules', () => {
  it('limits a KES 100,000 saver to KES 50,000', () => {
    expect(maximumCashLoanKes(100_000n)).toBe(50_000n);
  });
  it('limits a KES 50,000 saver to KES 25,000', () => {
    expect(maximumCashLoanKes(50_000n)).toBe(25_000n);
  });
  it('assesses a separate one-percent KES 200 fine on a KES 20,000 balance', () => {
    expect(overdueFineKes(20_000n)).toBe(200n);
  });
});
