import { NextResponse } from "next/server";
import { generateAiPolicy } from "@/lib/aiPolicyService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
    const totalAmount = Number(body.totalAmount);
    const validFrom = typeof body.validFrom === "string" ? body.validFrom : "";
    const validUntil = typeof body.validUntil === "string" ? body.validUntil : "";
    const requestedCategories = Array.isArray(body.requestedCategories)
      ? body.requestedCategories
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (!name || !Number.isFinite(totalAmount) || totalAmount <= 0 || !validFrom || !validUntil) {
      return NextResponse.json(
        { error: "예산명, 금액, 유효기간을 먼저 입력해 주세요." },
        { status: 400 }
      );
    }

    const policy = await generateAiPolicy({
      name,
      purpose,
      totalAmount: Math.round(totalAmount),
      validFrom,
      validUntil,
    });

    return NextResponse.json({
      ...policy,
      allowedCategories:
        requestedCategories.length > 0
          ? Array.from(new Set([...policy.allowedCategories, ...requestedCategories]))
          : policy.allowedCategories,
    });
  } catch (error) {
    console.error("Failed to generate AI policy", error);
    return NextResponse.json(
      { error: "AI 정책 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
