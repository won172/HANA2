import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const merchants = await prisma.merchant.findMany({
      orderBy: [{ isApproved: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(merchants);
  } catch (error) {
    console.error("Failed to load merchants", error);
    return NextResponse.json(
      { error: "가맹점 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
