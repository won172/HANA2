import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  evaluatePolicy,
  type PolicyInput,
  type PolicyConfig,
  type BudgetInfo,
} from "@/lib/policyEngine";
import { analyzeTransaction } from "@/lib/aiService";

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
  const { budgetId, merchantName, amount, itemDescription, requestedCategory } =
    body;

  // 예산 + 정책 가져오기
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: { policy: true, organization: true },
  });

  if (!budget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  if (!budget.policy) {
    return NextResponse.json(
      { error: "No policy configured for this budget" },
      { status: 400 }
    );
  }

  // 기존 거래에서 알려진 가맹점 목록 추출
  const existingTransactions: Array<{ merchantName: string }> =
    await prisma.transaction.findMany({
      where: { budgetId },
      select: { merchantName: true },
    });
  const knownMerchants = [
    ...new Set(existingTransactions.map((t) => t.merchantName)),
  ];

  // ── 정책 엔진 실행 ──
  const policyInput: PolicyInput = {
    amount,
    merchantName,
    requestedCategory,
    itemDescription,
  };

  const policyConfig: PolicyConfig = {
    allowedCategories: JSON.parse(budget.policy.allowedCategories),
    blockedCategories: JSON.parse(budget.policy.blockedCategories),
    blockedKeywords: JSON.parse(budget.policy.blockedKeywords),
    autoApproveLimit: budget.policy.autoApproveLimit,
    manualReviewLimit: budget.policy.manualReviewLimit,
    allowNewMerchant: budget.policy.allowNewMerchant,
  };

  const budgetInfo: BudgetInfo = {
    currentBalance: budget.currentBalance,
    validFrom: budget.validFrom,
    validUntil: budget.validUntil,
    status: budget.status,
  };

  const result = evaluatePolicy(
    policyInput,
    policyConfig,
    budgetInfo,
    knownMerchants
  );

  // ── AI 분석 (비동기) ──
  const aiResult = await analyzeTransaction(
    merchantName,
    amount,
    requestedCategory,
    itemDescription,
    {
      allowedCategories: policyConfig.allowedCategories,
      blockedCategories: policyConfig.blockedCategories,
      blockedKeywords: policyConfig.blockedKeywords,
      autoApproveLimit: policyConfig.autoApproveLimit,
    }
  );

  // AI가 HIGH 리스크 판정 → APPROVED를 NOTIFIED로 상향
  let finalStatus = result.status;
  let finalReason = result.reason;

  if (
    aiResult.available &&
    aiResult.risk.riskLevel === "HIGH" &&
    result.status === "APPROVED"
  ) {
    finalStatus = "NOTIFIED";
    finalReason = `${result.reason} | AI 고위험 감지 (${aiResult.risk.riskScore}점): ${aiResult.risk.explanation}`;
  }

  // AI 카테고리 추천 → resolvedCategory에 반영
  const resolvedCategory =
    aiResult.available && aiResult.category.confidence >= 0.7
      ? aiResult.category.suggestedCategory
      : requestedCategory;

  // ── 거래 생성 ──
  const transaction = await prisma.transaction.create({
    data: {
      budgetId,
      organizationId: budget.organizationId,
      merchantName,
      amount,
      itemDescription,
      requestedCategory,
      resolvedCategory,
      status: finalStatus,
      reviewReason: finalReason,
      // AI 결과 저장
      aiSuggestedCategory: aiResult.category.suggestedCategory,
      aiRiskScore: aiResult.risk.riskScore,
      aiRiskLevel: aiResult.risk.riskLevel,
      aiExplanation: aiResult.risk.explanation,
    },
  });

  // APPROVED 또는 NOTIFIED인 경우 잔액 차감 + 원장 기록
  if (finalStatus === "APPROVED" || finalStatus === "NOTIFIED") {
    const newBalance = budget.currentBalance - amount;

    await prisma.budget.update({
      where: { id: budgetId },
      data: { currentBalance: newBalance },
    });

    await prisma.ledgerEntry.create({
      data: {
        budgetId,
        transactionId: transaction.id,
        type: "SPEND",
        amount: -amount,
        balanceAfter: newBalance,
        description: `${merchantName} - ${itemDescription}`,
      },
    });
  }

  return NextResponse.json(
    {
      transaction,
      policyResult: { status: finalStatus, reason: finalReason },
      aiAnalysis: aiResult,
    },
    { status: 201 }
  );
}
