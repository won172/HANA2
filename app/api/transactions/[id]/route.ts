import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// PATCH: 보류 거래 승인/거절
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body; // "approve" or "decline"

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { budget: true },
  });

  if (!transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  if (transaction.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only PENDING transactions can be reviewed" },
      { status: 400 }
    );
  }

  if (action === "approve") {
    // 잔액 확인
    if (transaction.amount > transaction.budget.currentBalance) {
      return NextResponse.json(
        { error: "잔액이 부족합니다" },
        { status: 400 }
      );
    }

    const newBalance =
      transaction.budget.currentBalance - transaction.amount;

    // 거래 상태 업데이트
    await prisma.transaction.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewReason: "관리자 수동 승인",
      },
    });

    // 잔액 차감
    await prisma.budget.update({
      where: { id: transaction.budgetId },
      data: { currentBalance: newBalance },
    });

    // 원장 기록
    await prisma.ledgerEntry.create({
      data: {
        budgetId: transaction.budgetId,
        transactionId: id,
        type: "SPEND",
        amount: -transaction.amount,
        balanceAfter: newBalance,
        description: `${transaction.merchantName} - ${transaction.itemDescription} (수동 승인)`,
      },
    });

    return NextResponse.json({ status: "APPROVED" });
  } else if (action === "decline") {
    await prisma.transaction.update({
      where: { id },
      data: {
        status: "DECLINED",
        reviewReason: body.reason || "관리자 거절",
      },
    });

    return NextResponse.json({ status: "DECLINED" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
