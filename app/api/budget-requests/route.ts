import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const requests = await prisma.budgetRequest.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true,
        issuedBudget: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Failed to load budget requests", error);
    return NextResponse.json(
      { error: "예산 신청 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    organizationId,
    title,
    purpose,
    requestedAmount,
    requestedCategories,
    requestedPeriodStart,
    requestedPeriodEnd,
  } = body;

  if (
    !organizationId ||
    !title ||
    !purpose ||
    !requestedAmount ||
    !requestedPeriodStart ||
    !requestedPeriodEnd
  ) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 });
  }

  const budgetRequest = await prisma.budgetRequest.create({
    data: {
      organizationId,
      title,
      purpose,
      requestedAmount,
      requestedCategories: JSON.stringify(requestedCategories || []),
      requestedPeriodStart: new Date(requestedPeriodStart),
      requestedPeriodEnd: new Date(requestedPeriodEnd),
    },
    include: {
      organization: true,
    },
  });

  return NextResponse.json(budgetRequest, { status: 201 });
}
