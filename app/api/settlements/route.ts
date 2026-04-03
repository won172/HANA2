import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { summarizeSettlement } from "@/lib/settlementSummary";

export async function GET() {
  try {
    const budgets = await prisma.budget.findMany({
      include: {
        organization: true,
        issuerOrganization: true,
        transactions: true,
        settlement: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const settlements = budgets
      .filter((budget) => budget.settlement)
      .map((budget) => ({
        budget: {
          id: budget.id,
          name: budget.name,
          currentBalance: budget.currentBalance,
          organization: budget.organization,
          issuerOrganization: budget.issuerOrganization,
        },
        settlement: budget.settlement,
        summary: summarizeSettlement(budget, budget.transactions),
      }));

    return NextResponse.json(settlements);
  } catch (error) {
    console.error("Failed to load settlements", error);
    return NextResponse.json(
      { error: "정산 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const budgetId =
      typeof body.budgetId === "string" ? body.budgetId.trim() : "";

    if (!budgetId) {
      return NextResponse.json(
        { error: "정산 대상 예산이 지정되지 않았습니다." },
        { status: 400 }
      );
    }

    const settlement = await prisma.budgetSettlement.findUnique({
      where: { budgetId },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "제출된 정산 보고를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const updated = await prisma.budgetSettlement.update({
      where: { budgetId },
      data: {
        status: body.status === "SUBMITTED" ? "SUBMITTED" : "REVIEWED",
        reclaimAmount:
          typeof body.reclaimAmount === "number"
            ? body.reclaimAmount
            : settlement.reclaimAmount,
        reportNote:
          typeof body.reportNote === "string" && body.reportNote.trim()
            ? body.reportNote.trim()
            : settlement.reportNote,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update settlement", error);
    return NextResponse.json(
      { error: "정산 상태를 업데이트하지 못했습니다." },
      { status: 500 }
    );
  }
}
