import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAnchorRecord } from "@/lib/anchorService";
import {
  applyApprovedTransactionEffects,
  assessTransaction,
  ensureMerchantRecord,
} from "@/lib/transactionWorkflow";

export async function GET() {
  const transactions = await prisma.transaction.findMany({
    include: {
      budget: { include: { organization: true } },
      organization: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    budgetId,
    merchantName,
    amount,
    itemDescription,
    requestedCategory,
    additionalExplanation,
  } = body;

  try {
    const assessment = await assessTransaction({
      budgetId,
      merchantName,
      amount,
      itemDescription,
      requestedCategory,
      additionalExplanation,
    });

    const transaction = await prisma.transaction.create({
      data: {
        budgetId,
        organizationId: assessment.budget.organizationId,
        merchantName,
        amount,
        itemDescription,
        requestedCategory,
        resolvedCategory: assessment.resolvedCategory,
        status: assessment.finalStatus,
        reviewReason: assessment.finalReason,
        additionalExplanation: additionalExplanation?.trim() || null,
        lastSubmittedAt: new Date(),
        aiSuggestedCategory: assessment.aiResult.category.suggestedCategory,
        aiRiskScore: assessment.aiResult.risk.riskScore,
        aiRiskLevel: assessment.aiResult.risk.riskLevel,
        aiExplanation: assessment.aiResult.risk.explanation,
      },
    });

    await ensureMerchantRecord({
      name: merchantName,
      category: assessment.resolvedCategory,
    });

    if (
      assessment.finalStatus === "APPROVED" ||
      assessment.finalStatus === "NOTIFIED"
    ) {
      await applyApprovedTransactionEffects({
        budgetId,
        transactionId: transaction.id,
        amount,
        merchantName,
        itemDescription,
        currentBalance: assessment.budget.currentBalance,
      });
    }

    await createAnchorRecord(prisma, {
      eventType: "TRANSACTION_DECISION",
      entityType: "TRANSACTION",
      entityId: transaction.id,
      payload: {
        transactionId: transaction.id,
        budgetId,
        organizationId: assessment.budget.organizationId,
        merchantName,
        amount,
        requestedCategory,
        resolvedCategory: assessment.resolvedCategory,
        status: assessment.finalStatus,
        reviewReason: assessment.finalReason,
        additionalExplanation: additionalExplanation?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        transaction,
        policyResult: {
          status: assessment.finalStatus,
          reason: assessment.finalReason,
        },
        aiAnalysis: assessment.aiResult,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transaction request failed";
    const status =
      message === "Budget not found"
        ? 404
        : message === "No policy configured for this budget"
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
