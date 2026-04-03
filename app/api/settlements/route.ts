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
