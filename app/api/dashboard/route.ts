import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  // 대시보드 통계
  const budgets = await prisma.budget.findMany({
    include: {
      organization: true,
      policy: true,
      _count: { select: { transactions: true } },
    },
  });

  const transactions = await prisma.transaction.findMany({
    include: {
      budget: { include: { organization: true } },
      organization: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  type BudgetRow = {
    totalAmount: number | null;
    currentBalance: number | null;
  };

  const totalBudget = budgets.reduce(
    (sum: number, b: BudgetRow) => sum + (b.totalAmount ?? 0),
    0
  );

  const totalBalance = budgets.reduce(
    (sum: number, b: BudgetRow) => sum + (b.currentBalance ?? 0),
    0
  );
  const totalTransactions = await prisma.transaction.count();
  const pendingCount = await prisma.transaction.count({
    where: { status: "PENDING" },
  });

  const statusCounts = {
    APPROVED: await prisma.transaction.count({
      where: { status: "APPROVED" },
    }),
    NOTIFIED: await prisma.transaction.count({
      where: { status: "NOTIFIED" },
    }),
    PENDING: pendingCount,
    DECLINED: await prisma.transaction.count({
      where: { status: "DECLINED" },
    }),
  };

  return NextResponse.json({
    budgets,
    recentTransactions: transactions,
    stats: {
      totalBudget,
      totalBalance,
      totalTransactions,
      pendingCount,
      statusCounts,
      activeBudgetCount: budgets.filter((b: { status: string }) => b.status === "ACTIVE").length,
    },
  });
}
