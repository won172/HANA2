import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const users = await prisma.user.findMany({
    include: { organization: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}
