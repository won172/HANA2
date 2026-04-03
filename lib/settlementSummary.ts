type TransactionLike = {
  amount: number;
  requestedCategory: string;
  status: string;
};

type BudgetLike = {
  totalAmount: number;
  currentBalance: number;
};

export function summarizeSettlement(
  budget: BudgetLike,
  transactions: TransactionLike[]
) {
  const approvedStatuses = new Set(["APPROVED", "NOTIFIED"]);

  const totalUsed = transactions
    .filter((transaction) => approvedStatuses.has(transaction.status))
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalRejected = transactions
    .filter((transaction) => transaction.status === "DECLINED")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const pendingCount = transactions.filter(
    (transaction) => transaction.status === "PENDING"
  ).length;

  const categoryTotals = transactions
    .filter((transaction) => approvedStatuses.has(transaction.status))
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[transaction.requestedCategory] =
        (accumulator[transaction.requestedCategory] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      ratio: totalUsed > 0 ? amount / totalUsed : 0,
    }))
    .sort((left, right) => right.amount - left.amount);

  return {
    totalIssued: budget.totalAmount,
    totalUsed,
    totalRejected,
    pendingCount,
    reclaimAmountSuggested: budget.currentBalance,
    categoryBreakdown,
  };
}
