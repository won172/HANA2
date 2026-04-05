import { NextResponse } from "next/server";
import { createAnchorRecord } from "@/lib/anchorService";
import { prisma } from "@/lib/db";
import { ALL_BUDGET_CATEGORIES } from "@/lib/categoryLabels";
import {
  getCurrentPolicyExceptionWindow,
  getNextPolicyExceptionWindow,
} from "@/lib/policyExceptionWindow";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const budgetId = searchParams.get("budgetId");
    const organizationId = searchParams.get("organizationId");
    const status = searchParams.get("status");

    const requests = await prisma.policyExceptionRequest.findMany({
      where: {
        ...(budgetId ? { budgetId } : {}),
        ...(organizationId ? { organizationId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        budget: {
          select: {
            id: true,
            name: true,
            currentBalance: true,
            organization: { select: { name: true } },
          },
        },
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Failed to load policy exception requests", error);
    return NextResponse.json(
      { error: "정책 예외 결제 신청 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const budgetId = typeof body.budgetId === "string" ? body.budgetId : "";
    const merchantName = typeof body.merchantName === "string" ? body.merchantName.trim() : "";
    const itemDescription =
      typeof body.itemDescription === "string" ? body.itemDescription.trim() : "";
    const requestedCategory =
      typeof body.requestedCategory === "string"
        ? body.requestedCategory.trim().toUpperCase()
        : "";
    const justification =
      typeof body.justification === "string" ? body.justification.trim() : "";
    const amount = Math.round(Number(body.amount));

    if (
      !budgetId ||
      !merchantName ||
      !itemDescription ||
      !justification ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !ALL_BUDGET_CATEGORIES.includes(
        requestedCategory as (typeof ALL_BUDGET_CATEGORIES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "필수 항목을 모두 올바르게 입력해 주세요." },
        { status: 400 }
      );
    }

    const activeWindow = getCurrentPolicyExceptionWindow();
    if (!activeWindow) {
      const nextWindow = getNextPolicyExceptionWindow();
      return NextResponse.json(
        {
          error: nextWindow
            ? `정책 예외 결제 신청은 운영창에만 가능합니다. 다음 운영창: ${nextWindow.label} ${nextWindow.startsAt.toLocaleString(
                "ko-KR",
                {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}`
            : "현재는 정책 예외 결제 신청 가능 시간이 아닙니다.",
        },
        { status: 403 }
      );
    }

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        organization: true,
      },
    });

    if (!budget) {
      return NextResponse.json({ error: "예산을 찾을 수 없습니다." }, { status: 404 });
    }

    const exceptionRequest = await prisma.policyExceptionRequest.create({
      data: {
        budgetId: budget.id,
        organizationId: budget.organizationId,
        merchantName,
        amount,
        requestedCategory,
        itemDescription,
        justification,
        submissionWindowLabel: activeWindow.label,
        submissionWindowStart: activeWindow.startHour,
        submissionWindowEnd: activeWindow.endHour,
      },
      include: {
        budget: {
          select: {
            id: true,
            name: true,
            currentBalance: true,
            organization: { select: { name: true } },
          },
        },
        organization: true,
      },
    });

    await createAnchorRecord(prisma, {
      eventType: "POLICY_EXCEPTION_REQUEST",
      entityType: "EXCEPTION_REQUEST",
      entityId: exceptionRequest.id,
      payload: {
        exceptionRequestId: exceptionRequest.id,
        budgetId: budget.id,
        organizationId: budget.organizationId,
        merchantName,
        amount,
        requestedCategory,
        itemDescription,
        justification,
        submissionWindowLabel: activeWindow.label,
        submissionWindowStart: activeWindow.startHour,
        submissionWindowEnd: activeWindow.endHour,
        status: exceptionRequest.status,
      },
    });

    return NextResponse.json(exceptionRequest, { status: 201 });
  } catch (error) {
    console.error("Failed to create policy exception request", error);
    return NextResponse.json(
      { error: "정책 예외 결제 신청 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
