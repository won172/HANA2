import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBudgetWithPolicy } from "@/lib/budgetFactory";
import {
  getPolicyTemplate,
  recommendPolicyTemplate,
} from "@/lib/policyTemplates";

const DEFAULT_BLOCKED_CATEGORIES = ["ALCOHOL", "TOBACCO", "GAME"];
const DEFAULT_BLOCKED_KEYWORDS = ["술", "담배", "주류", "게임"];

function parseCategories(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

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
    return NextResponse.json({ error: "Budget request not found" }, { status: 404 });
  }

  if (action === "approve") {
    if (budgetRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending requests can be approved" },
        { status: 400 }
      );
    }

    const requestedCategories = parseCategories(budgetRequest.requestedCategories);
    const selectedTemplate =
      getPolicyTemplate(body.templateKey) ||
      recommendPolicyTemplate(requestedCategories);

    const validFrom = body.validFrom || budgetRequest.requestedPeriodStart;
    const validUntil = body.validUntil || budgetRequest.requestedPeriodEnd;
    const defaultEventWindow = getDefaultEventWindow(
      selectedTemplate.key,
      new Date(validFrom),
      new Date(validUntil)
    );

    const budget = await createBudgetWithPolicy({
      name: body.title?.trim() || budgetRequest.title,
      totalAmount: body.totalAmount ?? budgetRequest.requestedAmount,
      validFrom,
      validUntil,
      organizationId: budgetRequest.organizationId,
      issuerOrganizationId: "org-issuer",
      sourceRequestId: budgetRequest.id,
      policy: {
        templateKey: selectedTemplate.key,
        allowedCategories:
          body.allowedCategories ||
          (requestedCategories.length > 0
            ? requestedCategories
            : selectedTemplate.allowedCategories),
        blockedCategories:
          body.blockedCategories || selectedTemplate.blockedCategories || DEFAULT_BLOCKED_CATEGORIES,
        blockedKeywords:
          body.blockedKeywords || selectedTemplate.blockedKeywords || DEFAULT_BLOCKED_KEYWORDS,
        allowedKeywords: body.allowedKeywords || selectedTemplate.allowedKeywords,
        categoryAutoApproveRules:
          body.categoryAutoApproveRules ||
          selectedTemplate.categoryAutoApproveRules,
        eventCategories: body.eventCategories || selectedTemplate.eventCategories,
        autoApproveLimit:
          body.autoApproveLimit || selectedTemplate.autoApproveLimit,
        manualReviewLimit:
          body.manualReviewLimit || selectedTemplate.manualReviewLimit,
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
        eventWindowStart: body.eventWindowStart || defaultEventWindow.eventWindowStart,
        eventWindowEnd: body.eventWindowEnd || defaultEventWindow.eventWindowEnd,
      },
    });

    const updatedRequest = await prisma.budgetRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewerComment: body.reviewerComment?.trim() || "예산 발행 승인",
      },
      include: {
        organization: true,
        issuedBudget: true,
      },
    });

    return NextResponse.json({ request: updatedRequest, budget });
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
}
