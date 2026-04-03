import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeRequestedCategories } from "@/lib/budgetRequests";

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
  try {
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

    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedPurpose = typeof purpose === "string" ? purpose.trim() : "";
    const normalizedCategories = normalizeRequestedCategories(requestedCategories);
    const numericAmount = Number(requestedAmount);
    const periodStart = new Date(requestedPeriodStart);
    const periodEnd = new Date(requestedPeriodEnd);

    if (
      !organizationId ||
      !normalizedTitle ||
      !normalizedPurpose ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !requestedPeriodStart ||
      !requestedPeriodEnd
    ) {
      return NextResponse.json(
        { error: "필수 항목을 모두 올바르게 입력해 주세요." },
        { status: 400 }
      );
    }

    if (normalizedCategories.length === 0) {
      return NextResponse.json(
        { error: "최소 1개 이상의 요청 카테고리를 선택해 주세요." },
        { status: 400 }
      );
    }

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return NextResponse.json(
        { error: "사용 예정 기간을 다시 확인해 주세요." },
        { status: 400 }
      );
    }

    if (periodStart > periodEnd) {
      return NextResponse.json(
        { error: "종료일은 시작일보다 빠를 수 없습니다." },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization || organization.type !== "CLUB") {
      return NextResponse.json(
        { error: "예산을 신청할 수 있는 조직이 아닙니다." },
        { status: 400 }
      );
    }

    const budgetRequest = await prisma.budgetRequest.create({
      data: {
        organizationId,
        title: normalizedTitle,
        purpose: normalizedPurpose,
        requestedAmount: Math.round(numericAmount),
        requestedCategories: JSON.stringify(normalizedCategories),
        requestedPeriodStart: periodStart,
        requestedPeriodEnd: periodEnd,
      },
      include: {
        organization: true,
      },
    });

    return NextResponse.json(budgetRequest, { status: 201 });
  } catch (error) {
    console.error("Failed to create budget request", error);
    return NextResponse.json(
      { error: "예산 신청 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
