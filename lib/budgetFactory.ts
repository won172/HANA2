import { prisma } from "@/lib/db";
import { createAnchorRecord } from "@/lib/anchorService";

type BudgetPolicyInput = {
  allowedCategories?: string[];
  blockedCategories?: string[];
  blockedKeywords?: string[];
  allowedKeywords?: string[];
  categoryAutoApproveRules?: Record<string, number>;
  eventCategories?: string[];
  autoApproveLimit?: number;
  manualReviewLimit?: number;
  allowNewMerchant?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  eventWindowStart?: string | Date | null;
  eventWindowEnd?: string | Date | null;
  templateKey?: string | null;
};

type CreateBudgetInput = {
  name: string;
  totalAmount: number;
  validFrom: string | Date;
  validUntil: string | Date;
  organizationId: string;
  issuerOrganizationId: string;
  sourceRequestId?: string;
  policy?: BudgetPolicyInput;
};

export async function createBudgetWithPolicy(input: CreateBudgetInput) {
  const budget = await prisma.budget.create({
    data: {
      name: input.name,
      totalAmount: input.totalAmount,
      currentBalance: input.totalAmount,
      validFrom:
        input.validFrom instanceof Date ? input.validFrom : new Date(input.validFrom),
      validUntil:
        input.validUntil instanceof Date
          ? input.validUntil
          : new Date(input.validUntil),
      organizationId: input.organizationId,
      issuerOrganizationId: input.issuerOrganizationId,
      sourceRequestId: input.sourceRequestId,
      policy: input.policy
        ? {
            create: {
              allowedCategories: JSON.stringify(input.policy.allowedCategories || []),
              blockedCategories: JSON.stringify(input.policy.blockedCategories || []),
              blockedKeywords: JSON.stringify(input.policy.blockedKeywords || []),
              allowedKeywords: JSON.stringify(input.policy.allowedKeywords || []),
              categoryAutoApproveRules: JSON.stringify(
                input.policy.categoryAutoApproveRules || {}
              ),
              eventCategories: JSON.stringify(input.policy.eventCategories || []),
              autoApproveLimit: input.policy.autoApproveLimit || 50000,
              manualReviewLimit: input.policy.manualReviewLimit || 150000,
              allowNewMerchant: input.policy.allowNewMerchant || false,
              quietHoursStart: input.policy.quietHoursStart ?? null,
              quietHoursEnd: input.policy.quietHoursEnd ?? null,
              eventWindowStart: input.policy.eventWindowStart
                ? input.policy.eventWindowStart instanceof Date
                  ? input.policy.eventWindowStart
                  : new Date(input.policy.eventWindowStart)
                : null,
              eventWindowEnd: input.policy.eventWindowEnd
                ? input.policy.eventWindowEnd instanceof Date
                  ? input.policy.eventWindowEnd
                  : new Date(input.policy.eventWindowEnd)
                : null,
              templateKey: input.policy.templateKey || null,
            },
          }
        : undefined,
    },
    include: {
      policy: true,
      organization: true,
      issuerOrganization: true,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget.id,
      type: "ISSUE",
      amount: input.totalAmount,
      balanceAfter: input.totalAmount,
      description: `${input.name} 예산 발행`,
    },
  });

  await createAnchorRecord(prisma, {
    eventType: "BUDGET_ISSUED",
    entityType: "BUDGET",
    entityId: budget.id,
    payload: {
      budgetId: budget.id,
      budgetName: budget.name,
      organizationId: budget.organizationId,
      issuerOrganizationId: budget.issuerOrganizationId,
      totalAmount: budget.totalAmount,
      validFrom: budget.validFrom.toISOString(),
      validUntil: budget.validUntil.toISOString(),
      sourceRequestId: budget.sourceRequestId,
    },
  });

  if (budget.policy) {
    await createAnchorRecord(prisma, {
      eventType: "POLICY_SNAPSHOT",
      entityType: "POLICY",
      entityId: budget.policy.id,
      payload: {
        policyId: budget.policy.id,
        budgetId: budget.id,
        templateKey: budget.policy.templateKey,
        allowedCategories: budget.policy.allowedCategories,
        blockedCategories: budget.policy.blockedCategories,
        blockedKeywords: budget.policy.blockedKeywords,
        allowedKeywords: budget.policy.allowedKeywords,
        categoryAutoApproveRules: budget.policy.categoryAutoApproveRules,
        eventCategories: budget.policy.eventCategories,
        autoApproveLimit: budget.policy.autoApproveLimit,
        manualReviewLimit: budget.policy.manualReviewLimit,
        allowNewMerchant: budget.policy.allowNewMerchant,
        quietHoursStart: budget.policy.quietHoursStart,
        quietHoursEnd: budget.policy.quietHoursEnd,
        eventWindowStart: budget.policy.eventWindowStart?.toISOString() || null,
        eventWindowEnd: budget.policy.eventWindowEnd?.toISOString() || null,
      },
    });
  }

  return budget;
}
