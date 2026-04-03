import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { createBudgetWithPolicy } from "@/lib/budgetFactory";

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
    sourceRequestId,
  } = body;

  const budget = await createBudgetWithPolicy({
    name,
    totalAmount,
    validFrom,
    validUntil,
    organizationId,
    issuerOrganizationId,
    sourceRequestId,
    policy,
  });

  return NextResponse.json(budget, { status: 201 });
}
