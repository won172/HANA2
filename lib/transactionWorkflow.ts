import { prisma } from "@/lib/db";
import { analyzeTransaction, type AiAnalysisResult } from "@/lib/aiService";
import {
  draftReviewReason,
  normalizeSpendingMemo,
} from "@/lib/operationsInsights";
import {
  evaluatePolicy,
  type BudgetInfo,
  type MerchantInfo,
  type PolicyConfig,
  type PolicyInput,
  type PolicyResult,
} from "@/lib/policyEngine";

export type TransactionAssessmentInput = {
  budgetId: string;
  merchantName: string;
  amount: number;
  requestedCategory: string;
  itemDescription: string;
  additionalExplanation?: string | null;
  ignoreTransactionId?: string;
};

export type TransactionAssessment = {
  budget: {
    id: string;
    organizationId: string;
    currentBalance: number;
  };
  policyConfig: PolicyConfig;
  policyResult: PolicyResult;
  aiResult: AiAnalysisResult;
  finalStatus: PolicyResult["status"];
  finalReason: string;
  resolvedCategory: string;
};

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, number>;
    }

    return Object.entries(parsed).reduce<Record<string, number>>(
      (accumulator, [key, rawValue]) => {
        if (typeof rawValue === "number") {
          accumulator[key.toUpperCase()] = rawValue;
        }
        return accumulator;
      },
      {}
    );
  } catch {
    return {};
  }
}

function buildAnalysisDescription(
  itemDescription: string,
  additionalExplanation?: string | null
) {
  if (!additionalExplanation?.trim()) {
    return itemDescription;
  }

  return `${itemDescription} | 추가 설명: ${additionalExplanation.trim()}`;
}

export async function assessTransaction(
  input: TransactionAssessmentInput
): Promise<TransactionAssessment> {
  const budget = await prisma.budget.findUnique({
    where: { id: input.budgetId },
    include: { policy: true, organization: true },
  });

  if (!budget) {
    throw new Error("Budget not found");
  }

  if (!budget.policy) {
    throw new Error("No policy configured for this budget");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { name: input.merchantName.trim() },
  });

  const existingTransactions: Array<{ merchantName: string }> =
    await prisma.transaction.findMany({
      where: {
        budgetId: input.budgetId,
        ...(input.ignoreTransactionId
          ? { id: { not: input.ignoreTransactionId } }
          : {}),
      },
      select: { merchantName: true },
    });

  const knownMerchants = [
    ...new Set(existingTransactions.map((transaction) => transaction.merchantName)),
  ];

  const descriptionForAnalysis = buildAnalysisDescription(
    input.itemDescription,
    input.additionalExplanation
  );
  const normalizedMemo = normalizeSpendingMemo(descriptionForAnalysis);
  const normalizedRequestedCategory =
    normalizedMemo.normalizedCategory ?? input.requestedCategory;

  const policyInput: PolicyInput = {
    amount: input.amount,
    merchantName: input.merchantName,
    requestedCategory: normalizedRequestedCategory,
    itemDescription: descriptionForAnalysis,
  };

  const policyConfig: PolicyConfig = {
    allowedCategories: parseJsonArray(budget.policy.allowedCategories),
    blockedCategories: parseJsonArray(budget.policy.blockedCategories),
    blockedKeywords: parseJsonArray(budget.policy.blockedKeywords),
    allowedKeywords: parseJsonArray(budget.policy.allowedKeywords),
    categoryAutoApproveRules: parseJsonRecord(
      budget.policy.categoryAutoApproveRules
    ),
    eventCategories: parseJsonArray(budget.policy.eventCategories),
    autoApproveLimit: budget.policy.autoApproveLimit,
    manualReviewLimit: budget.policy.manualReviewLimit,
    allowNewMerchant: budget.policy.allowNewMerchant,
    quietHoursStart: budget.policy.quietHoursStart,
    quietHoursEnd: budget.policy.quietHoursEnd,
    eventWindowStart: budget.policy.eventWindowStart,
    eventWindowEnd: budget.policy.eventWindowEnd,
  };

  const budgetInfo: BudgetInfo = {
    currentBalance: budget.currentBalance,
    validFrom: budget.validFrom,
    validUntil: budget.validUntil,
    status: budget.status,
  };

  const merchantInfo: MerchantInfo = merchant
    ? {
        name: merchant.name,
        isApproved: merchant.isApproved,
        category: merchant.category,
      }
    : null;

  const policyResult = evaluatePolicy(
    policyInput,
    policyConfig,
    budgetInfo,
    knownMerchants,
    merchantInfo
  );

  const aiResult = await analyzeTransaction(
    input.merchantName,
    input.amount,
    normalizedRequestedCategory,
    descriptionForAnalysis,
    {
      displayName: budget.policy.displayName,
      summary: budget.policy.summary,
      policySource: budget.policy.policySource,
      allowedCategories: policyConfig.allowedCategories,
      blockedCategories: policyConfig.blockedCategories,
      blockedKeywords: policyConfig.blockedKeywords,
      allowedKeywords: policyConfig.allowedKeywords,
      autoApproveLimit: policyConfig.autoApproveLimit,
      manualReviewLimit: policyConfig.manualReviewLimit,
    }
  );

  let finalStatus = policyResult.status;
  let finalReason = draftReviewReason({
    status: policyResult.status,
    policyReason: policyResult.reason,
    aiRiskLevel: aiResult.risk.riskLevel,
    aiRiskScore: aiResult.risk.riskScore,
    normalizedMemo,
  });

  if (
    aiResult.available &&
    aiResult.risk.riskLevel === "HIGH" &&
    policyResult.status === "APPROVED"
  ) {
    finalStatus = "NOTIFIED";
    finalReason = draftReviewReason({
      status: "NOTIFIED",
      policyReason: `${policyResult.reason} | AI 고위험 감지 (${aiResult.risk.riskScore}점): ${aiResult.risk.explanation}`,
      aiRiskLevel: aiResult.risk.riskLevel,
      aiRiskScore: aiResult.risk.riskScore,
      normalizedMemo,
    });
  }

  const resolvedCategory =
    aiResult.available && aiResult.category.confidence >= 0.7
      ? aiResult.category.suggestedCategory
      : normalizedRequestedCategory;

  return {
    budget: {
      id: budget.id,
      organizationId: budget.organizationId,
      currentBalance: budget.currentBalance,
    },
    policyConfig,
    policyResult,
    aiResult,
    finalStatus,
    finalReason,
    resolvedCategory,
  };
}

export async function applyApprovedTransactionEffects(params: {
  budgetId: string;
  transactionId: string;
  amount: number;
  merchantName: string;
  itemDescription: string;
  currentBalance: number;
  descriptionSuffix?: string;
}) {
  const newBalance = params.currentBalance - params.amount;

  await prisma.budget.update({
    where: { id: params.budgetId },
    data: { currentBalance: newBalance },
  });

  const suffix = params.descriptionSuffix ? ` ${params.descriptionSuffix}` : "";

  await prisma.ledgerEntry.create({
    data: {
      budgetId: params.budgetId,
      transactionId: params.transactionId,
      type: "SPEND",
      amount: -params.amount,
      balanceAfter: newBalance,
      description: `${params.merchantName} - ${params.itemDescription}${suffix}`,
    },
  });

  return newBalance;
}

export async function ensureMerchantRecord(params: {
  name: string;
  category: string;
  isApproved?: boolean;
}) {
  const existingMerchant = await prisma.merchant.findUnique({
    where: { name: params.name.trim() },
  });

  if (!existingMerchant) {
    await prisma.merchant.create({
      data: {
        name: params.name.trim(),
        category: params.category,
        isApproved: Boolean(params.isApproved),
      },
    });
    return;
  }

  await prisma.merchant.update({
    where: { id: existingMerchant.id },
    data: {
      category: params.category,
      ...(params.isApproved ? { isApproved: true } : {}),
    },
  });
}
