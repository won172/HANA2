import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const budgets = await prisma.budget.findMany({
    include: {
      organization: true,
      issuerOrganization: true,
      policy: true,
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(budgets);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    name,
    totalAmount,
    validFrom,
    validUntil,
    organizationId,
    issuerOrganizationId,
    policy,
  } = body;

  const budget = await prisma.budget.create({
    data: {
      name,
      totalAmount,
      currentBalance: totalAmount,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      organizationId,
      issuerOrganizationId,
      policy: policy
        ? {
            create: {
              allowedCategories: JSON.stringify(policy.allowedCategories || []),
              blockedCategories: JSON.stringify(policy.blockedCategories || []),
              blockedKeywords: JSON.stringify(policy.blockedKeywords || []),
              autoApproveLimit: policy.autoApproveLimit || 50000,
              manualReviewLimit: policy.manualReviewLimit || 150000,
              allowNewMerchant: policy.allowNewMerchant || false,
            },
          }
        : undefined,
    },
    include: { policy: true, organization: true },
  });

  // LedgerEntry: ISSUE
  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget.id,
      type: "ISSUE",
      amount: totalAmount,
      balanceAfter: totalAmount,
      description: `${name} 예산 발행`,
    },
  });

  return NextResponse.json(budget, { status: 201 });
}
