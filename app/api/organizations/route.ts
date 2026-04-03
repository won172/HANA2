import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const organizations = await prisma.organization.findMany({
    include: {
      _count: { select: { users: true, budgets: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(organizations);
}
