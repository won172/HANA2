import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const merchant = await prisma.merchant.update({
    where: { id },
    data: {
      isApproved:
        typeof body.isApproved === "boolean" ? body.isApproved : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
    },
  });

  return NextResponse.json(merchant);
}
