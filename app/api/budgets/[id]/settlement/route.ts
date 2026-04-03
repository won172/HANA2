import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAnchorRecord } from "@/lib/anchorService";
import { summarizeSettlement } from "@/lib/settlementSummary";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      transactions: budget.transactions,
    });
  } catch (error) {
    console.error("Failed to load budget settlement", error);
    return NextResponse.json(
      { error: "정산 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        transactions: true,
      },
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    const reportNote =
      typeof body.reportNote === "string" ? body.reportNote.trim() : "";
    const reclaimAmount = Number(body.reclaimAmount ?? budget.currentBalance);
    const status =
      body.status === "REVIEWED" ? "REVIEWED" : "SUBMITTED";

    if (!reportNote) {
      return NextResponse.json(
        { error: "종료 보고 메모를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(reclaimAmount) || reclaimAmount < 0) {
      return NextResponse.json(
        { error: "환수 예정 금액을 다시 확인해 주세요." },
        { status: 400 }
      );
    }

    const settlement = await prisma.budgetSettlement.upsert({
      where: { budgetId: id },
      update: {
        reportNote,
        reclaimAmount,
        status,
      },
      create: {
        budgetId: id,
        reportNote,
        reclaimAmount,
        status,
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
        transactionCount: budget.transactions.length,
      },
    });

    return NextResponse.json(settlement);
  } catch (error) {
    console.error("Failed to submit settlement", error);
    return NextResponse.json(
      { error: "정산 보고 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
