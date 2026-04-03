import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // 기존 데이터 정리
  await prisma.ledgerEntry.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ===== Organizations =====
  const issuerOrg = await prisma.organization.create({
    data: {
      id: "org-issuer",
      name: "한국대학교 학생처",
      type: "ISSUER",
    },
  });

  const statsClub = await prisma.organization.create({
    data: {
      id: "org-stats",
      name: "통계학과 학생회",
      type: "CLUB",
    },
  });

  const dataClub = await prisma.organization.create({
    data: {
      id: "org-data",
      name: "데이터분석 동아리",
      type: "CLUB",
    },
  });

  // ===== Users =====
  await prisma.user.create({
    data: {
      id: "user-admin",
      name: "김관리자",
      role: "ADMIN",
      organizationId: issuerOrg.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "user-club1",
      name: "이동아리",
      role: "CLUB_USER",
      organizationId: statsClub.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "user-club2",
      name: "박동아리",
      role: "CLUB_USER",
      organizationId: dataClub.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "user-approver",
      name: "최승인자",
      role: "APPROVER",
      organizationId: issuerOrg.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "user-pos",
      name: "POS단말기",
      role: "POS",
    },
  });

  // ===== Budgets =====
  const budget1 = await prisma.budget.create({
    data: {
      id: "budget-event",
      name: "2024 봄 행사 예산",
      totalAmount: 500000,
      currentBalance: 320000,
      validFrom: new Date("2024-03-01"),
      validUntil: new Date("2026-12-31"),
      status: "ACTIVE",
      organizationId: statsClub.id,
      issuerOrganizationId: issuerOrg.id,
    },
  });

  const budget2 = await prisma.budget.create({
    data: {
      id: "budget-promo",
      name: "홍보물 제작 예산",
      totalAmount: 300000,
      currentBalance: 180000,
      validFrom: new Date("2024-03-01"),
      validUntil: new Date("2026-12-31"),
      status: "ACTIVE",
      organizationId: statsClub.id,
      issuerOrganizationId: issuerOrg.id,
    },
  });

  const budget3 = await prisma.budget.create({
    data: {
      id: "budget-data",
      name: "데이터분석 동아리 운영비",
      totalAmount: 400000,
      currentBalance: 400000,
      validFrom: new Date("2024-03-01"),
      validUntil: new Date("2026-12-31"),
      status: "ACTIVE",
      organizationId: dataClub.id,
      issuerOrganizationId: issuerOrg.id,
    },
  });

  // ===== Policies =====
  await prisma.policy.create({
    data: {
      budgetId: budget1.id,
      allowedCategories: JSON.stringify(["FOOD", "SUPPLIES", "VENUE", "TRANSPORT"]),
      blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
      blockedKeywords: JSON.stringify(["술", "담배", "주류", "게임"]),
      autoApproveLimit: 50000,
      manualReviewLimit: 150000,
      allowNewMerchant: false,
    },
  });

  await prisma.policy.create({
    data: {
      budgetId: budget2.id,
      allowedCategories: JSON.stringify(["PRINT", "SUPPLIES", "DESIGN"]),
      blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
      blockedKeywords: JSON.stringify(["술", "담배", "주류", "게임"]),
      autoApproveLimit: 50000,
      manualReviewLimit: 150000,
      allowNewMerchant: true,
    },
  });

  await prisma.policy.create({
    data: {
      budgetId: budget3.id,
      allowedCategories: JSON.stringify(["FOOD", "SUPPLIES", "PRINT", "VENUE", "TRANSPORT", "OTHER"]),
      blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
      blockedKeywords: JSON.stringify(["술", "담배", "주류", "게임"]),
      autoApproveLimit: 80000,
      manualReviewLimit: 200000,
      allowNewMerchant: true,
    },
  });

  // ===== LedgerEntries (발행 기록) =====
  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget1.id,
      type: "ISSUE",
      amount: 500000,
      balanceAfter: 500000,
      description: "2024 봄 행사 예산 발행",
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget2.id,
      type: "ISSUE",
      amount: 300000,
      balanceAfter: 300000,
      description: "홍보물 제작 예산 발행",
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget3.id,
      type: "ISSUE",
      amount: 400000,
      balanceAfter: 400000,
      description: "데이터분석 동아리 운영비 발행",
    },
  });

  // ===== Sample Transactions ===== 
  // 승인된 거래 1
  const tx1 = await prisma.transaction.create({
    data: {
      budgetId: budget1.id,
      organizationId: statsClub.id,
      merchantName: "문구사랑",
      amount: 80000,
      itemDescription: "행사 준비물 구매",
      requestedCategory: "SUPPLIES",
      resolvedCategory: "SUPPLIES",
      status: "NOTIFIED",
      reviewReason: "자동승인 한도 초과 (50,000원), 승인 처리 후 관리자 알림",
      createdAt: new Date("2026-03-30"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget1.id,
      transactionId: tx1.id,
      type: "SPEND",
      amount: -80000,
      balanceAfter: 420000,
      description: "문구사랑 - 행사 준비물 구매",
      createdAt: new Date("2026-03-30"),
    },
  });

  // 승인된 거래 2 (신규 가맹점이지만 홍보물 예산은 allowNewMerchant: true)
  const tx2 = await prisma.transaction.create({
    data: {
      budgetId: budget2.id,
      organizationId: statsClub.id,
      merchantName: "신규인쇄소",
      amount: 55000,
      itemDescription: "현수막 제작",
      requestedCategory: "PRINT",
      resolvedCategory: "PRINT",
      status: "NOTIFIED",
      reviewReason: "자동승인 한도 초과 (50,000원), 승인 처리 후 관리자 알림",
      createdAt: new Date("2026-03-31"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget2.id,
      transactionId: tx2.id,
      type: "SPEND",
      amount: -55000,
      balanceAfter: 245000,
      description: "신규인쇄소 - 현수막 제작",
      createdAt: new Date("2026-03-31"),
    },
  });

  // 거절된 거래 (금지 카테고리)
  const tx3 = await prisma.transaction.create({
    data: {
      budgetId: budget1.id,
      organizationId: statsClub.id,
      merchantName: "편의점GS",
      amount: 15000,
      itemDescription: "주류 구매",
      requestedCategory: "FOOD",
      resolvedCategory: "FOOD",
      status: "DECLINED",
      reviewReason: "금지 키워드 감지: \"주류\"",
      createdAt: new Date("2026-04-01"),
    },
  });

  // 승인된 거래 3
  const tx4 = await prisma.transaction.create({
    data: {
      budgetId: budget2.id,
      organizationId: statsClub.id,
      merchantName: "오피스디포",
      amount: 120000,
      itemDescription: "홍보 배너 제작",
      requestedCategory: "PRINT",
      resolvedCategory: "PRINT",
      status: "APPROVED",
      reviewReason: "정책 조건 충족 — 자동 승인",
      createdAt: new Date("2026-04-02"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget2.id,
      transactionId: tx4.id,
      type: "SPEND",
      amount: -120000,
      balanceAfter: 180000,  // 300000 - 55000 - 120000 + 55000 (notified 건은 차감) -> 실제로 300000 - 120000 = 180000 (간단하게)
      description: "오피스디포 - 홍보 배너 제작",
      createdAt: new Date("2026-04-02"),
    },
  });

  // 보류 거래
  const tx5 = await prisma.transaction.create({
    data: {
      budgetId: budget1.id,
      organizationId: statsClub.id,
      merchantName: "카페베네",
      amount: 35000,
      itemDescription: "회의 다과 구매",
      requestedCategory: "FOOD",
      resolvedCategory: "FOOD",
      status: "PENDING",
      reviewReason: "신규 가맹점: 카페베네",
      createdAt: new Date("2026-04-03"),
    },
  });

  // 또 다른 Level A 승인 거래
  const tx6 = await prisma.transaction.create({
    data: {
      budgetId: budget1.id,
      organizationId: statsClub.id,
      merchantName: "문구사랑",
      amount: 20000,
      itemDescription: "A4 용지 10박스",
      requestedCategory: "SUPPLIES",
      resolvedCategory: "SUPPLIES",
      status: "APPROVED",
      reviewReason: "정책 조건 충족 — 자동 승인",
      createdAt: new Date("2026-04-02"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: budget1.id,
      transactionId: tx6.id,
      type: "SPEND",
      amount: -20000,
      balanceAfter: 320000,
      description: "문구사랑 - A4 용지 10박스",
      createdAt: new Date("2026-04-02"),
    },
  });

  // NOTIFIED 상태 거래 (budget1)
  const tx7 = await prisma.transaction.create({
    data: {
      budgetId: budget1.id,
      organizationId: statsClub.id,
      merchantName: "문구사랑",
      amount: 80000,
      itemDescription: "대형 현수막 거치대 구매",
      requestedCategory: "SUPPLIES",
      resolvedCategory: "SUPPLIES",
      status: "NOTIFIED",
      reviewReason: "자동승인 한도 초과 (50,000원), 승인 처리 후 관리자 알림",
      createdAt: new Date("2026-04-01"),
    },
  });

  console.log("✅ Seed 데이터 생성 완료!");
  console.log(`  Organizations: 3`);
  console.log(`  Users: 5`);
  console.log(`  Budgets: 3`);
  console.log(`  Policies: 3`);
  console.log(`  Transactions: 7`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
