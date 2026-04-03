import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAnchorRecord } from "@/lib/anchorService";
import { summarizeSettlement } from "@/lib/settlementSummary";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      organization: true,
      issuerOrganization: true,
      transactions: {
        orderBy: { createdAt: "desc" },
      },
      settlement: true,
    },
  });

  if (!budget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  const summary = summarizeSettlement(budget, budget.transactions);

  return NextResponse.json({
    budget,
    settlement: budget.settlement,
    summary,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const budget = await prisma.budget.findUnique({ where: { id } });

  if (!budget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  const settlement = await prisma.budgetSettlement.upsert({
    where: { budgetId: id },
    update: {
      reportNote: body.reportNote,
      reclaimAmount: body.reclaimAmount ?? budget.currentBalance,
      status: body.status || "SUBMITTED",
    },
    create: {
      budgetId: id,
      reportNote: body.reportNote,
      reclaimAmount: body.reclaimAmount ?? budget.currentBalance,
      status: body.status || "SUBMITTED",
    },
  });

  await createAnchorRecord(prisma, {
    eventType: "SETTLEMENT_REPORT",
    entityType: "SETTLEMENT",
    entityId: settlement.id,
    payload: {
      settlementId: settlement.id,
      budgetId: id,
      status: settlement.status,
      reclaimAmount: settlement.reclaimAmount,
      reportNote: settlement.reportNote,
      currentBalance: budget.currentBalance,
    },
  });

  return NextResponse.json(settlement);
}
