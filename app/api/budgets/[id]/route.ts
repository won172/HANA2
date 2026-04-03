import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      organization: true,
      issuerOrganization: true,
      policy: true,
      transactions: {
        orderBy: { createdAt: "desc" },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!budget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  return NextResponse.json(budget);
}
