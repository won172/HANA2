import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBudgetWithPolicy } from "@/lib/budgetFactory";
import { generateAiPolicy } from "@/lib/aiPolicyService";
import {
  parseRequestedCategories,
} from "@/lib/budgetRequests";

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
          : "AI 정책 기준으로 승인 후 예산을 발행했습니다.";
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

      const aiPolicy = await generateAiPolicy({
        name: normalizedTitle,
        purpose: budgetRequest.purpose,
        totalAmount: Math.round(numericAmount),
        validFrom: periodStart.toISOString().split("T")[0],
        validUntil: periodEnd.toISOString().split("T")[0],
      });

      const allowedCategories =
        requestedCategories.length > 0
          ? Array.from(
              new Set([
                ...aiPolicy.allowedCategories,
                ...requestedCategories,
              ])
            )
          : aiPolicy.allowedCategories;

      const budget = await createBudgetWithPolicy({
        name: normalizedTitle,
        totalAmount: Math.round(numericAmount),
        validFrom: periodStart,
        validUntil: periodEnd,
        organizationId: budgetRequest.organizationId,
        issuerOrganizationId: issuerOrganization.id,
        sourceRequestId: budgetRequest.id,
        policy: {
          ...aiPolicy,
          allowedCategories,
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
        appliedPolicy: aiPolicy,
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
