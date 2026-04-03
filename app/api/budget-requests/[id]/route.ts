import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBudgetWithPolicy } from "@/lib/budgetFactory";
import {
  getPolicyTemplate,
  recommendPolicyTemplate,
} from "@/lib/policyTemplates";
import {
  normalizeRequestedCategories,
  normalizeStringList,
  parseRequestedCategories,
} from "@/lib/budgetRequests";

const DEFAULT_BLOCKED_CATEGORIES = ["ALCOHOL", "TOBACCO", "GAME"];
const DEFAULT_BLOCKED_KEYWORDS = ["술", "담배", "주류", "게임"];

function getDefaultEventWindow(
  templateKey: string,
  validFrom: Date,
  validUntil: Date
) {
  if (templateKey !== "event") {
    return {
      eventWindowStart: null as Date | null,
      eventWindowEnd: null as Date | null,
    };
  }

  const eventWindowStart = new Date(validFrom);
  eventWindowStart.setDate(eventWindowStart.getDate() - 1);

  return {
    eventWindowStart,
    eventWindowEnd: new Date(validUntil),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const budgetRequest = await prisma.budgetRequest.findUnique({
      where: { id },
      include: {
        organization: true,
        issuedBudget: true,
      },
    });

    if (!budgetRequest) {
      return NextResponse.json(
        { error: "Budget request not found" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      if (budgetRequest.status !== "PENDING") {
        return NextResponse.json(
          { error: "Only pending requests can be approved" },
          { status: 400 }
        );
      }

      if (budgetRequest.issuedBudget) {
        return NextResponse.json(
          { error: "이미 발행된 예산 신청입니다." },
          { status: 400 }
        );
      }

      const issuerOrganization = await prisma.organization.findFirst({
        where: { type: "ISSUER" },
      });

      if (!issuerOrganization) {
        return NextResponse.json(
          { error: "예산 발행 기관을 찾을 수 없습니다." },
          { status: 500 }
        );
      }

      const requestedCategories = parseRequestedCategories(
        budgetRequest.requestedCategories
      );
      const selectedTemplate =
        getPolicyTemplate(body.templateKey) ||
        recommendPolicyTemplate(requestedCategories);

      const validFrom = body.validFrom || budgetRequest.requestedPeriodStart;
      const validUntil = body.validUntil || budgetRequest.requestedPeriodEnd;
      const numericAmount = Number(body.totalAmount ?? budgetRequest.requestedAmount);
      const normalizedTitle =
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : budgetRequest.title;
      const normalizedReviewerComment =
        typeof body.reviewerComment === "string" && body.reviewerComment.trim()
          ? body.reviewerComment.trim()
          : `${selectedTemplate.label} 기준으로 승인 후 예산을 발행했습니다.`;
      const approvedCategories = normalizeRequestedCategories(
        body.allowedCategories || requestedCategories
      );
      const periodStart = new Date(validFrom);
      const periodEnd = new Date(validUntil);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return NextResponse.json(
          { error: "발행 금액을 다시 확인해 주세요." },
          { status: 400 }
        );
      }

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return NextResponse.json(
          { error: "발행 기간을 다시 확인해 주세요." },
          { status: 400 }
        );
      }

      if (periodStart > periodEnd) {
        return NextResponse.json(
          { error: "종료일은 시작일보다 빠를 수 없습니다." },
          { status: 400 }
        );
      }

      const defaultEventWindow = getDefaultEventWindow(
        selectedTemplate.key,
        periodStart,
        periodEnd
      );

      const budget = await createBudgetWithPolicy({
        name: normalizedTitle,
        totalAmount: Math.round(numericAmount),
        validFrom: periodStart,
        validUntil: periodEnd,
        organizationId: budgetRequest.organizationId,
        issuerOrganizationId: issuerOrganization.id,
        sourceRequestId: budgetRequest.id,
        policy: {
          templateKey: selectedTemplate.key,
          allowedCategories:
            approvedCategories.length > 0
              ? approvedCategories
              : selectedTemplate.allowedCategories,
          blockedCategories:
            normalizeRequestedCategories(body.blockedCategories).length > 0
              ? normalizeRequestedCategories(body.blockedCategories)
              : selectedTemplate.blockedCategories || DEFAULT_BLOCKED_CATEGORIES,
          blockedKeywords:
            normalizeStringList(body.blockedKeywords).length > 0
              ? normalizeStringList(body.blockedKeywords)
              : selectedTemplate.blockedKeywords || DEFAULT_BLOCKED_KEYWORDS,
          allowedKeywords:
            normalizeStringList(body.allowedKeywords).length > 0
              ? normalizeStringList(body.allowedKeywords)
              : selectedTemplate.allowedKeywords,
          categoryAutoApproveRules:
            body.categoryAutoApproveRules ||
            selectedTemplate.categoryAutoApproveRules,
          eventCategories:
            normalizeRequestedCategories(body.eventCategories).length > 0
              ? normalizeRequestedCategories(body.eventCategories)
              : selectedTemplate.eventCategories,
          autoApproveLimit:
            Number(body.autoApproveLimit) || selectedTemplate.autoApproveLimit,
          manualReviewLimit:
            Number(body.manualReviewLimit) || selectedTemplate.manualReviewLimit,
          allowNewMerchant:
            typeof body.allowNewMerchant === "boolean"
              ? body.allowNewMerchant
              : selectedTemplate.allowNewMerchant,
          quietHoursStart:
            body.quietHoursStart !== undefined
              ? body.quietHoursStart
              : selectedTemplate.quietHoursStart,
          quietHoursEnd:
            body.quietHoursEnd !== undefined
              ? body.quietHoursEnd
              : selectedTemplate.quietHoursEnd,
          eventWindowStart:
            body.eventWindowStart || defaultEventWindow.eventWindowStart,
          eventWindowEnd: body.eventWindowEnd || defaultEventWindow.eventWindowEnd,
        },
      });

      const updatedRequest = await prisma.budgetRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewerComment: normalizedReviewerComment,
        },
        include: {
          organization: true,
          issuedBudget: true,
        },
      });

      return NextResponse.json({
        request: updatedRequest,
        budget,
        appliedTemplate: selectedTemplate,
      });
    }

    if (action === "reject") {
      const updatedRequest = await prisma.budgetRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewerComment: body.reviewerComment?.trim() || "보완 후 재신청 필요",
        },
        include: {
          organization: true,
          issuedBudget: true,
        },
      });

      return NextResponse.json({ request: updatedRequest });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to review budget request", error);
    return NextResponse.json(
      { error: "예산 신청 검토 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
