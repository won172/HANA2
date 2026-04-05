import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  buildOperationsInsightSummary,
  detectTransactionAnomalies,
} from "@/lib/operationsInsights";

export async function GET() {
  try {
    const now = new Date();
    const expiringThreshold = new Date(now);
    expiringThreshold.setDate(expiringThreshold.getDate() + 7);

    const [
      budgets,
      allTransactions,
      totalTransactions,
      pendingCount,
      pendingExceptionRequestCount,
      pendingRequestCount,
      settlementPendingCount,
    ] =
      await Promise.all([
        prisma.budget.findMany({
          include: {
            organization: true,
            _count: { select: { transactions: true } },
          },
          orderBy: { validUntil: "asc" },
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
        prisma.policyExceptionRequest.count({
          where: { status: "PENDING" },
        }),
        prisma.budgetRequest.count({
          where: { status: "PENDING" },
        }),
        prisma.budgetSettlement.count({
          where: { status: "SUBMITTED" },
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

    const expiringBudgets = budgets
      .filter(
        (budget) =>
          budget.status === "ACTIVE" &&
          budget.validUntil >= now &&
          budget.validUntil <= expiringThreshold
      )
      .slice(0, 5)
      .map((budget) => ({
        id: budget.id,
        name: budget.name,
        currentBalance: budget.currentBalance,
        validUntil: budget.validUntil,
        organization: {
          name: budget.organization.name,
        },
      }));

    return NextResponse.json({
      expiringBudgets,
      recentAnchors,
      insights,
      stats: {
        totalBudget,
        totalBalance,
        totalTransactions,
        pendingCount: pendingCount + pendingExceptionRequestCount,
        pendingTransactionCount: pendingCount,
        pendingExceptionRequestCount,
        activeBudgetCount: budgets.filter((b: { status: string }) => b.status === "ACTIVE").length,
        pendingRequestCount,
        settlementPendingCount,
        expiringBudgetCount: expiringBudgets.length,
        highRiskCount: insights.counters.highRiskCount,
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
