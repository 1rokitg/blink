export type BuilderApprovalRow = {
  walletAddress: string;
  maxFeeRate: string;
  approvedAt: Date | string;
};

/** One row per wallet — keeps the most recent approval. */
export function dedupeBuilderApprovalsByWallet<T extends BuilderApprovalRow>(
  rows: T[],
): T[] {
  const byWallet = new Map<string, T>();

  for (const row of rows) {
    const key = row.walletAddress.toLowerCase();
    const existing = byWallet.get(key);
    if (!existing) {
      byWallet.set(key, row);
      continue;
    }
    const nextAt = new Date(row.approvedAt).getTime();
    const prevAt = new Date(existing.approvedAt).getTime();
    if (nextAt >= prevAt) {
      byWallet.set(key, row);
    }
  }

  return Array.from(byWallet.values()).sort(
    (a, b) =>
      new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime(),
  );
}
