type TransactionLike = {
  amount: number;
  requestedCategory: string;
  status: string;
  merchantName?: string;
  itemDescription?: string;
  createdAt?: Date | string;
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
  const approvedTransactions = transactions.filter((transaction) =>
    approvedStatuses.has(transaction.status)
  );
  const declinedTransactions = transactions.filter(
    (transaction) => transaction.status === "DECLINED"
  );
  const pendingTransactions = transactions.filter(
    (transaction) => transaction.status === "PENDING"
  );

  const totalUsed = approvedTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const totalRejected = declinedTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const pendingCount = pendingTransactions.length;
  const approvedCount = approvedTransactions.length;
  const rejectedCount = declinedTransactions.length;
  const remainingBalance = budget.currentBalance;

  const categoryTotals = approvedTransactions.reduce<Record<string, number>>(
    (accumulator, transaction) => {
      accumulator[transaction.requestedCategory] =
        (accumulator[transaction.requestedCategory] ?? 0) + transaction.amount;
      return accumulator;
    },
    {}
  );

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      ratio: totalUsed > 0 ? amount / totalUsed : 0,
    }))
    .sort((left, right) => right.amount - left.amount);

  const recentApprovedTransactions = approvedTransactions
    .slice()
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 5)
    .map((transaction) => ({
      merchantName: transaction.merchantName ?? "-",
      itemDescription: transaction.itemDescription ?? "-",
      amount: transaction.amount,
      requestedCategory: transaction.requestedCategory,
      createdAt: transaction.createdAt ? new Date(transaction.createdAt).toISOString() : null,
    }));

  return {
    totalIssued: budget.totalAmount,
    totalUsed,
    remainingBalance,
    totalRejected,
    pendingCount,
    approvedCount,
    rejectedCount,
    reclaimAmountSuggested: budget.currentBalance,
    categoryBreakdown,
    recentApprovedTransactions,
  };
}
