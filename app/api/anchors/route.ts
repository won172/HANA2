import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const records = await prisma.anchorRecord.findMany({
      orderBy: [{ anchoredAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    const budgetIds = records
      .filter((record) => record.entityType === "BUDGET")
      .map((record) => record.entityId);
    const policyIds = records
      .filter((record) => record.entityType === "POLICY")
      .map((record) => record.entityId);
    const transactionIds = records
      .filter((record) => record.entityType === "TRANSACTION")
      .map((record) => record.entityId);
    const settlementIds = records
      .filter((record) => record.entityType === "SETTLEMENT")
      .map((record) => record.entityId);

    const [budgets, policies, transactions, settlements] = await Promise.all([
      budgetIds.length
        ? prisma.budget.findMany({
            where: { id: { in: budgetIds } },
            include: { organization: true },
          })
        : [],
      policyIds.length
        ? prisma.policy.findMany({
            where: { id: { in: policyIds } },
            include: { budget: { include: { organization: true } } },
          })
        : [],
      transactionIds.length
        ? prisma.transaction.findMany({
            where: { id: { in: transactionIds } },
            include: { budget: { include: { organization: true } } },
          })
        : [],
      settlementIds.length
        ? prisma.budgetSettlement.findMany({
            where: { id: { in: settlementIds } },
            include: { budget: { include: { organization: true } } },
          })
        : [],
    ]);

    const budgetMap = new Map(budgets.map((budget) => [budget.id, budget]));
    const policyMap = new Map(policies.map((policy) => [policy.id, policy]));
    const transactionMap = new Map(
      transactions.map((transaction) => [transaction.id, transaction])
    );
    const settlementMap = new Map(
      settlements.map((settlement) => [settlement.id, settlement])
    );

    const eventLabels: Record<string, string> = {
      BUDGET_ISSUED: "예산 발행",
      POLICY_SNAPSHOT: "정책 스냅샷",
      TRANSACTION_DECISION: "거래 판정",
      SETTLEMENT_REPORT: "정산 보고",
    };

    const resolvedRecords = records.map((record) => {
      let entityLabel = record.entityType;
      let entityContext = record.entityId;

      if (record.entityType === "BUDGET") {
        const budget = budgetMap.get(record.entityId);
        if (budget) {
          entityLabel = budget.name;
          entityContext = budget.organization.name;
        }
      } else if (record.entityType === "POLICY") {
        const policy = policyMap.get(record.entityId);
        if (policy) {
          entityLabel = `${policy.budget.name} 정책`;
          entityContext = policy.budget.organization.name;
        }
      } else if (record.entityType === "TRANSACTION") {
        const transaction = transactionMap.get(record.entityId);
        if (transaction) {
          entityLabel = transaction.merchantName;
          entityContext = `${transaction.budget.name} · ${transaction.amount.toLocaleString(
            "ko-KR"
          )}원`;
        }
      } else if (record.entityType === "SETTLEMENT") {
        const settlement = settlementMap.get(record.entityId);
        if (settlement) {
          entityLabel = `${settlement.budget.name} 정산`;
          entityContext = settlement.budget.organization.name;
        }
      }

      return {
        ...record,
        eventLabel: eventLabels[record.eventType] || record.eventType,
        entityLabel,
        entityContext,
      };
    });

    const stats = {
      total: records.length,
      anchored: records.filter((record) => record.chainStatus === "ANCHORED").length,
      pending: records.filter((record) => record.chainStatus === "PENDING").length,
      failed: records.filter((record) => record.chainStatus === "FAILED").length,
      lastAnchoredAt: records.find((record) => record.anchoredAt)?.anchoredAt || null,
      eventCounts: {
        BUDGET_ISSUED: records.filter((record) => record.eventType === "BUDGET_ISSUED")
          .length,
        POLICY_SNAPSHOT: records.filter(
          (record) => record.eventType === "POLICY_SNAPSHOT"
        ).length,
        TRANSACTION_DECISION: records.filter(
          (record) => record.eventType === "TRANSACTION_DECISION"
        ).length,
        SETTLEMENT_REPORT: records.filter(
          (record) => record.eventType === "SETTLEMENT_REPORT"
        ).length,
      },
    };

    return NextResponse.json({ stats, records: resolvedRecords });
  } catch (error) {
    console.error("Failed to load anchors", error);
    return NextResponse.json(
      { error: "앵커링 기록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
