/** Financial business rules use integer Kenyan shillings only. */
export function maximumCashLoanKes(eligibleSavingsKes: bigint, percent: bigint = 50n): bigint {
  if (eligibleSavingsKes < 0n || percent < 0n || percent > 100n) throw new Error('INVALID_MONEY_RULE');
  return (eligibleSavingsKes * percent) / 100n;
}

export function overdueFineKes(outstandingCashLoanKes: bigint, finePercent: bigint = 1n): bigint {
  if (outstandingCashLoanKes < 0n || finePercent < 0n || finePercent > 100n) throw new Error('INVALID_MONEY_RULE');
  // Floor to a whole Kenyan shilling, per configured group policy.
  return (outstandingCashLoanKes * finePercent) / 100n;
}
