import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  buildOperationsInsightSummary,
  detectTransactionAnomalies,
} from "@/lib/operationsInsights";

export async function GET() {
  try {
    const [budgets, allTransactions, totalTransactions, pendingCount] =
      await Promise.all([
        prisma.budget.findMany({
          include: {
            organization: true,
            policy: true,
            _count: { select: { transactions: true } },
          },
        }),
        prisma.transaction.findMany({
          include: {
            budget: {
              select: {
                id: true,
                name: true,
                totalAmount: true,
                validUntil: true,
              },
            },
            organization: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.transaction.count(),
        prisma.transaction.count({
          where: { status: "PENDING" },
        }),
      ]);

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

    const anomalies = detectTransactionAnomalies(
      budgets.map((budget) => ({
        id: budget.id,
        name: budget.name,
        totalAmount: budget.totalAmount,
        currentBalance: budget.currentBalance,
        validUntil: budget.validUntil,
        organization: {
          id: budget.organizationId,
          name: budget.organization.name,
        },
      })),
      allTransactions.map((transaction) => ({
        id: transaction.id,
        budgetId: transaction.budgetId,
        organizationId: transaction.organizationId,
        merchantName: transaction.merchantName,
        amount: transaction.amount,
        status: transaction.status,
        requestedCategory: transaction.requestedCategory,
        resolvedCategory: transaction.resolvedCategory,
        itemDescription: transaction.itemDescription,
        reviewReason: transaction.reviewReason,
        aiRiskScore: transaction.aiRiskScore,
        aiRiskLevel: transaction.aiRiskLevel,
        createdAt: transaction.createdAt,
        budget: transaction.budget,
        organization: {
          id: transaction.organization.id,
          name: transaction.organization.name,
        },
      }))
    );

    const insights = buildOperationsInsightSummary(
      budgets.map((budget) => ({
        id: budget.id,
        name: budget.name,
        totalAmount: budget.totalAmount,
        currentBalance: budget.currentBalance,
        validUntil: budget.validUntil,
        organization: {
          id: budget.organizationId,
          name: budget.organization.name,
        },
      })),
      allTransactions.map((transaction) => ({
        id: transaction.id,
        budgetId: transaction.budgetId,
        organizationId: transaction.organizationId,
        merchantName: transaction.merchantName,
        amount: transaction.amount,
        status: transaction.status,
        requestedCategory: transaction.requestedCategory,
        resolvedCategory: transaction.resolvedCategory,
        itemDescription: transaction.itemDescription,
        reviewReason: transaction.reviewReason,
        aiRiskScore: transaction.aiRiskScore,
        aiRiskLevel: transaction.aiRiskLevel,
        createdAt: transaction.createdAt,
        budget: transaction.budget,
        organization: {
          id: transaction.organization.id,
          name: transaction.organization.name,
        },
      })),
      anomalies
    );

    const [anchorTotal, anchorAnchored, anchorFailed, recentAnchors] =
      await Promise.all([
        prisma.anchorRecord.count(),
        prisma.anchorRecord.count({
          where: { chainStatus: "ANCHORED" },
        }),
        prisma.anchorRecord.count({
          where: { chainStatus: "FAILED" },
        }),
        prisma.anchorRecord.findMany({
          orderBy: [{ anchoredAt: "desc" }, { createdAt: "desc" }],
          take: 5,
        }),
      ]);

    return NextResponse.json({
      budgets,
      recentTransactions: allTransactions.slice(0, 20),
      recentAnchors,
      anomalies: anomalies.slice(0, 6),
      insights,
      stats: {
        totalBudget,
        totalBalance,
        totalTransactions,
        pendingCount,
        statusCounts,
        activeBudgetCount: budgets.filter((b: { status: string }) => b.status === "ACTIVE").length,
        anchorSummary: {
          total: anchorTotal,
          anchored: anchorAnchored,
          failed: anchorFailed,
          lastAnchoredAt: recentAnchors[0]?.anchoredAt || null,
        },
      },
    });
  } catch (error) {
    console.error("Failed to load dashboard", error);
    return NextResponse.json(
      { error: "대시보드 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
