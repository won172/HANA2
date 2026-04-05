import { NextResponse } from "next/server";
import { createAnchorRecord } from "@/lib/anchorService";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;
    const adminComment =
      typeof body.adminComment === "string" && body.adminComment.trim()
        ? body.adminComment.trim()
        : null;

    const exceptionRequest = await prisma.policyExceptionRequest.findUnique({
      where: { id },
      include: {
        budget: true,
        organization: true,
      },
    });

    if (!exceptionRequest) {
      return NextResponse.json(
        { error: "정책 예외 결제 신청을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (exceptionRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "검토 대기 상태인 신청만 처리할 수 있습니다." },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "잘못된 처리 요청입니다." }, { status: 400 });
    }

    const nextStatus = action === "approve" ? "APPROVED" : "REJECTED";
    const updatedRequest = await prisma.policyExceptionRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        adminComment,
        reviewedAt: new Date(),
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
      entityId: updatedRequest.id,
      payload: {
        exceptionRequestId: updatedRequest.id,
        budgetId: updatedRequest.budgetId,
        organizationId: updatedRequest.organizationId,
        action,
        status: updatedRequest.status,
        adminComment,
        reviewedAt: updatedRequest.reviewedAt,
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Failed to review policy exception request", error);
    return NextResponse.json(
      { error: "정책 예외 결제 신청 검토에 실패했습니다." },
      { status: 500 }
    );
  }
}
