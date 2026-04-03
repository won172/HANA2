import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAnchorRecord } from "@/lib/anchorService";
import {
  applyApprovedTransactionEffects,
  assessTransaction,
  ensureMerchantRecord,
} from "@/lib/transactionWorkflow";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { budget: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (action === "approve") {
    if (transaction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING transactions can be reviewed" },
        { status: 400 }
      );
    }

    if (transaction.amount > transaction.budget.currentBalance) {
      return NextResponse.json({ error: "잔액이 부족합니다" }, { status: 400 });
    }

    const reason = body.reason?.trim() || "관리자 수동 승인";

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewReason: reason,
        adminComment: body.adminComment?.trim() || body.reason?.trim() || null,
      },
    });

    await applyApprovedTransactionEffects({
      budgetId: transaction.budgetId,
      transactionId: id,
      amount: transaction.amount,
      merchantName: transaction.merchantName,
      itemDescription: transaction.itemDescription,
      currentBalance: transaction.budget.currentBalance,
      descriptionSuffix: "(수동 승인)",
    });

    await createAnchorRecord(prisma, {
      eventType: "TRANSACTION_DECISION",
      entityType: "TRANSACTION",
      entityId: id,
      payload: {
        transactionId: id,
        budgetId: transaction.budgetId,
        merchantName: updatedTransaction.merchantName,
        amount: updatedTransaction.amount,
        requestedCategory: updatedTransaction.requestedCategory,
        resolvedCategory: updatedTransaction.resolvedCategory,
        status: updatedTransaction.status,
        reviewReason: updatedTransaction.reviewReason,
        adminComment: updatedTransaction.adminComment,
      },
    });

    return NextResponse.json({ status: "APPROVED" });
  }

  if (action === "decline") {
    const reason = body.reason?.trim() || "관리자 거절";

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        status: "DECLINED",
        reviewReason: reason,
        adminComment: body.adminComment?.trim() || body.reason?.trim() || null,
      },
    });

    await createAnchorRecord(prisma, {
      eventType: "TRANSACTION_DECISION",
      entityType: "TRANSACTION",
      entityId: id,
      payload: {
        transactionId: id,
        budgetId: transaction.budgetId,
        merchantName: updatedTransaction.merchantName,
        amount: updatedTransaction.amount,
        requestedCategory: updatedTransaction.requestedCategory,
        resolvedCategory: updatedTransaction.resolvedCategory,
        status: updatedTransaction.status,
        reviewReason: updatedTransaction.reviewReason,
        adminComment: updatedTransaction.adminComment,
      },
    });

    return NextResponse.json({ status: "DECLINED" });
  }

  if (action === "add_explanation") {
    if (!["PENDING", "DECLINED"].includes(transaction.status)) {
      return NextResponse.json(
        { error: "보류 또는 반려 거래만 설명을 보완할 수 있습니다" },
        { status: 400 }
      );
    }

    await prisma.transaction.update({
      where: { id },
      data: {
        additionalExplanation: body.additionalExplanation?.trim() || null,
        lastSubmittedAt: new Date(),
      },
    });

    return NextResponse.json({ status: transaction.status });
  }

  if (action === "resubmit") {
    if (!["PENDING", "DECLINED"].includes(transaction.status)) {
      return NextResponse.json(
        { error: "보류 또는 반려 거래만 재요청할 수 있습니다" },
        { status: 400 }
      );
    }

    try {
      const merchantName = body.merchantName?.trim() || transaction.merchantName;
      const itemDescription =
        body.itemDescription?.trim() || transaction.itemDescription;
      const requestedCategory =
        body.requestedCategory?.trim() || transaction.requestedCategory;
      const amount =
        typeof body.amount === "number" ? body.amount : transaction.amount;
      const additionalExplanation =
        body.additionalExplanation?.trim() || transaction.additionalExplanation;

      const assessment = await assessTransaction({
        budgetId: transaction.budgetId,
        merchantName,
        amount,
        itemDescription,
        requestedCategory,
        additionalExplanation,
        ignoreTransactionId: id,
      });

      const updatedTransaction = await prisma.transaction.update({
        where: { id },
        data: {
          merchantName,
          amount,
          itemDescription,
          requestedCategory,
          resolvedCategory: assessment.resolvedCategory,
          status: assessment.finalStatus,
          reviewReason: assessment.finalReason,
          additionalExplanation: additionalExplanation || null,
          adminComment: null,
          resubmissionCount: { increment: 1 },
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
          budgetId: transaction.budgetId,
          transactionId: id,
          amount,
          merchantName,
          itemDescription,
          currentBalance: assessment.budget.currentBalance,
          descriptionSuffix: "(재요청 승인)",
        });
      }

      await createAnchorRecord(prisma, {
        eventType: "TRANSACTION_DECISION",
        entityType: "TRANSACTION",
        entityId: id,
        payload: {
          transactionId: id,
          budgetId: transaction.budgetId,
          merchantName,
          amount,
          requestedCategory,
          resolvedCategory: assessment.resolvedCategory,
          status: assessment.finalStatus,
          reviewReason: assessment.finalReason,
          additionalExplanation: additionalExplanation || null,
          resubmissionCount: updatedTransaction.resubmissionCount,
        },
      });

      return NextResponse.json({
        transaction: updatedTransaction,
        policyResult: {
          status: assessment.finalStatus,
          reason: assessment.finalReason,
        },
        aiAnalysis: assessment.aiResult,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Resubmission failed";
      const status =
        message === "Budget not found"
          ? 404
          : message === "No policy configured for this budget"
            ? 400
            : 500;

      return NextResponse.json({ error: message }, { status });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
