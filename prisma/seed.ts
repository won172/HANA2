import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { createAnchorRecord } from "../lib/anchorService";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.anchorRecord.deleteMany();
  await prisma.budgetSettlement.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.budgetRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

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

  await prisma.user.createMany({
    data: [
      {
        id: "user-admin",
        name: "김관리자",
        role: "ADMIN",
        organizationId: issuerOrg.id,
      },
      {
        id: "user-club1",
        name: "이동아리",
        role: "CLUB_USER",
        organizationId: statsClub.id,
      },
      {
        id: "user-club2",
        name: "박동아리",
        role: "CLUB_USER",
        organizationId: dataClub.id,
      },
      {
        id: "user-approver",
        name: "최승인자",
        role: "APPROVER",
        organizationId: issuerOrg.id,
      },
      {
        id: "user-pos",
        name: "POS단말기",
        role: "POS",
      },
    ],
  });

  await prisma.merchant.createMany({
    data: [
      {
        name: "문구사랑",
        category: "SUPPLIES",
        isApproved: true,
      },
      {
        name: "오피스디포",
        category: "PRINT",
        isApproved: true,
      },
      {
        name: "스터디룸24",
        category: "VENUE",
        isApproved: true,
      },
      {
        name: "카페베네",
        category: "FOOD",
        isApproved: false,
      },
      {
        name: "신규인쇄소",
        category: "PRINT",
        isApproved: false,
      },
      {
        name: "편의점GS",
        category: "FOOD",
        isApproved: false,
      },
    ],
  });

  const approvedRequest = await prisma.budgetRequest.create({
    data: {
      id: "request-seminar-approved",
      organizationId: statsClub.id,
      title: "세미나 대관 예산",
      purpose: "학과 공개 세미나 진행을 위한 장소 대관 및 간단한 다과 비용 신청",
      requestedAmount: 800000,
      requestedCategories: JSON.stringify(["VENUE", "FOOD", "SUPPLIES"]),
      requestedPeriodStart: new Date("2026-04-01"),
      requestedPeriodEnd: new Date("2026-04-14"),
      status: "APPROVED",
      reviewerComment: "행사 운영 목적이 명확하여 승인 후 발행",
      createdAt: new Date("2026-03-28"),
    },
  });

  await prisma.budgetRequest.create({
    data: {
      id: "request-data-pending",
      organizationId: dataClub.id,
      title: "5월 데이터 워크숍 운영 예산",
      purpose: "외부 연사 초청 워크숍 진행을 위한 식비, 인쇄비, 장소 예약비 신청",
      requestedAmount: 650000,
      requestedCategories: JSON.stringify(["FOOD", "PRINT", "VENUE"]),
      requestedPeriodStart: new Date("2026-05-10"),
      requestedPeriodEnd: new Date("2026-05-31"),
      status: "PENDING",
      createdAt: new Date("2026-04-03"),
    },
  });

  await prisma.budgetRequest.create({
    data: {
      id: "request-stats-rejected",
      organizationId: statsClub.id,
      title: "단합 행사 기념품 예산",
      purpose: "학생회 단합 행사 경품 구매",
      requestedAmount: 400000,
      requestedCategories: JSON.stringify(["OTHER", "SUPPLIES"]),
      requestedPeriodStart: new Date("2026-04-20"),
      requestedPeriodEnd: new Date("2026-04-25"),
      status: "REJECTED",
      reviewerComment: "예산 목적과 직접 관련성이 부족하여 반려",
      createdAt: new Date("2026-04-01"),
    },
  });

  const eventBudget = await prisma.budget.create({
    data: {
      id: "budget-event",
      name: "종강총회 행사 예산",
      totalAmount: 500000,
      currentBalance: 320000,
      validFrom: new Date("2026-03-20"),
      validUntil: new Date("2026-04-30"),
      status: "ACTIVE",
      organizationId: statsClub.id,
      issuerOrganizationId: issuerOrg.id,
    },
  });

  const promoBudget = await prisma.budget.create({
    data: {
      id: "budget-promo",
      name: "홍보물 제작 예산",
      totalAmount: 300000,
      currentBalance: 65000,
      validFrom: new Date("2026-03-15"),
      validUntil: new Date("2026-04-12"),
      status: "ACTIVE",
      organizationId: statsClub.id,
      issuerOrganizationId: issuerOrg.id,
    },
  });

  const operationsBudget = await prisma.budget.create({
    data: {
      id: "budget-data",
      name: "동아리 운영비",
      totalAmount: 1200000,
      currentBalance: 1020000,
      validFrom: new Date("2026-03-01"),
      validUntil: new Date("2026-12-31"),
      status: "ACTIVE",
      organizationId: dataClub.id,
      issuerOrganizationId: issuerOrg.id,
    },
  });

  const seminarBudget = await prisma.budget.create({
    data: {
      id: "budget-seminar",
      name: "세미나 대관 예산",
      totalAmount: 800000,
      currentBalance: 800000,
      validFrom: new Date("2026-04-01"),
      validUntil: new Date("2026-04-14"),
      status: "ACTIVE",
      organizationId: statsClub.id,
      issuerOrganizationId: issuerOrg.id,
      sourceRequestId: approvedRequest.id,
    },
  });

  await prisma.policy.createMany({
    data: [
      {
        budgetId: eventBudget.id,
        templateKey: "event",
        allowedCategories: JSON.stringify(["FOOD", "SUPPLIES", "VENUE", "TRANSPORT"]),
        blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
        blockedKeywords: JSON.stringify(["술", "담배", "주류", "게임"]),
        allowedKeywords: JSON.stringify(["다과", "행사", "세미나", "총회"]),
        categoryAutoApproveRules: JSON.stringify({
          FOOD: 30000,
          SUPPLIES: 50000,
          TRANSPORT: 40000,
        }),
        eventCategories: JSON.stringify(["FOOD", "VENUE", "SUPPLIES"]),
        autoApproveLimit: 50000,
        manualReviewLimit: 150000,
        allowNewMerchant: false,
        quietHoursStart: 23,
        quietHoursEnd: 7,
        eventWindowStart: new Date("2026-03-19"),
        eventWindowEnd: new Date("2026-04-30"),
      },
      {
        budgetId: promoBudget.id,
        templateKey: "promo",
        allowedCategories: JSON.stringify(["PRINT", "SUPPLIES", "DESIGN"]),
        blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
        blockedKeywords: JSON.stringify(["술", "담배", "주류", "게임"]),
        allowedKeywords: JSON.stringify(["현수막", "포스터", "배너", "홍보"]),
        categoryAutoApproveRules: JSON.stringify({
          PRINT: 100000,
          DESIGN: 80000,
          SUPPLIES: 40000,
        }),
        eventCategories: JSON.stringify([]),
        autoApproveLimit: 50000,
        manualReviewLimit: 150000,
        allowNewMerchant: true,
      },
      {
        budgetId: operationsBudget.id,
        templateKey: "equipment",
        allowedCategories: JSON.stringify([
          "FOOD",
          "SUPPLIES",
          "PRINT",
          "VENUE",
          "TRANSPORT",
          "OTHER",
        ]),
        blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
        blockedKeywords: JSON.stringify(["술", "담배", "주류", "게임"]),
        allowedKeywords: JSON.stringify(["운영", "장비", "세미나", "구매"]),
        categoryAutoApproveRules: JSON.stringify({
          SUPPLIES: 80000,
          PRINT: 50000,
          FOOD: 30000,
        }),
        eventCategories: JSON.stringify([]),
        autoApproveLimit: 80000,
        manualReviewLimit: 200000,
        allowNewMerchant: true,
      },
      {
        budgetId: seminarBudget.id,
        templateKey: "event",
        allowedCategories: JSON.stringify(["VENUE", "SUPPLIES", "FOOD"]),
        blockedCategories: JSON.stringify(["ALCOHOL", "TOBACCO", "GAME"]),
        blockedKeywords: JSON.stringify(["주류", "담배", "유흥"]),
        allowedKeywords: JSON.stringify(["세미나", "다과", "대관", "행사"]),
        categoryAutoApproveRules: JSON.stringify({
          FOOD: 30000,
          SUPPLIES: 50000,
          VENUE: 150000,
        }),
        eventCategories: JSON.stringify(["FOOD", "VENUE"]),
        autoApproveLimit: 70000,
        manualReviewLimit: 250000,
        allowNewMerchant: false,
        quietHoursStart: 23,
        quietHoursEnd: 7,
        eventWindowStart: new Date("2026-03-31"),
        eventWindowEnd: new Date("2026-04-14"),
      },
    ],
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        budgetId: eventBudget.id,
        type: "ISSUE",
        amount: 500000,
        balanceAfter: 500000,
        description: "종강총회 행사 예산 발행",
      },
      {
        budgetId: promoBudget.id,
        type: "ISSUE",
        amount: 300000,
        balanceAfter: 300000,
        description: "홍보물 제작 예산 발행",
      },
      {
        budgetId: operationsBudget.id,
        type: "ISSUE",
        amount: 1200000,
        balanceAfter: 1200000,
        description: "동아리 운영비 발행",
      },
      {
        budgetId: seminarBudget.id,
        type: "ISSUE",
        amount: 800000,
        balanceAfter: 800000,
        description: "세미나 대관 예산 발행",
      },
    ],
  });

  const tx1 = await prisma.transaction.create({
    data: {
      budgetId: eventBudget.id,
      organizationId: statsClub.id,
      merchantName: "문구사랑",
      amount: 80000,
      itemDescription: "행사 준비물 구매",
      requestedCategory: "SUPPLIES",
      resolvedCategory: "SUPPLIES",
      status: "NOTIFIED",
      reviewReason: "자동승인 한도 초과 (50,000원), 승인 처리 후 관리자 알림",
      aiSuggestedCategory: "SUPPLIES",
      aiRiskScore: 41,
      aiRiskLevel: "MEDIUM",
      aiExplanation: "행사 준비물 구매로 분류되지만 자동승인 한도를 넘어 관리자 알림이 필요합니다.",
      createdAt: new Date("2026-03-30"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: eventBudget.id,
      transactionId: tx1.id,
      type: "SPEND",
      amount: -80000,
      balanceAfter: 420000,
      description: "문구사랑 - 행사 준비물 구매",
      createdAt: new Date("2026-03-30"),
    },
  });

  const tx2 = await prisma.transaction.create({
    data: {
      budgetId: promoBudget.id,
      organizationId: statsClub.id,
      merchantName: "신규인쇄소",
      amount: 55000,
      itemDescription: "현수막 제작",
      requestedCategory: "PRINT",
      resolvedCategory: "PRINT",
      status: "NOTIFIED",
      reviewReason: "자동승인 한도 초과 (50,000원), 승인 처리 후 관리자 알림",
      aiSuggestedCategory: "PRINT",
      aiRiskScore: 36,
      aiRiskLevel: "MEDIUM",
      aiExplanation: "인쇄 목적은 명확하지만 신규 가맹점 사용과 한도 초과가 함께 관찰됩니다.",
      createdAt: new Date("2026-03-31"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: promoBudget.id,
      transactionId: tx2.id,
      type: "SPEND",
      amount: -55000,
      balanceAfter: 245000,
      description: "신규인쇄소 - 현수막 제작",
      createdAt: new Date("2026-03-31"),
    },
  });

  const tx3 = await prisma.transaction.create({
    data: {
      budgetId: eventBudget.id,
      organizationId: statsClub.id,
      merchantName: "편의점GS",
      amount: 15000,
      itemDescription: "주류 구매",
      requestedCategory: "FOOD",
      resolvedCategory: "FOOD",
      status: "DECLINED",
      reviewReason: '금지 키워드 감지: "주류"',
      adminComment: "주류 구매는 학생회 예산 사용 불가",
      lastSubmittedAt: new Date("2026-04-01"),
      aiSuggestedCategory: "ALCOHOL",
      aiRiskScore: 96,
      aiRiskLevel: "HIGH",
      aiExplanation: "금지 키워드와 품목 내용이 예산 목적과 직접 충돌해 고위험 거래로 판단했습니다.",
      createdAt: new Date("2026-04-01"),
    },
  });

  const tx4 = await prisma.transaction.create({
    data: {
      budgetId: promoBudget.id,
      organizationId: statsClub.id,
      merchantName: "오피스디포",
      amount: 120000,
      itemDescription: "홍보 배너 제작",
      requestedCategory: "PRINT",
      resolvedCategory: "PRINT",
      status: "APPROVED",
      reviewReason: "정책 조건 충족 — 자동 승인",
      aiSuggestedCategory: "PRINT",
      aiRiskScore: 18,
      aiRiskLevel: "LOW",
      aiExplanation: "홍보 배너 제작으로 목적과 카테고리가 일치해 정상 집행으로 보입니다.",
      createdAt: new Date("2026-04-02"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: promoBudget.id,
      transactionId: tx4.id,
      type: "SPEND",
      amount: -120000,
      balanceAfter: 125000,
      description: "오피스디포 - 홍보 배너 제작",
      createdAt: new Date("2026-04-02"),
    },
  });

  const tx5 = await prisma.transaction.create({
    data: {
      budgetId: eventBudget.id,
      organizationId: statsClub.id,
      merchantName: "카페베네",
      amount: 35000,
      itemDescription: "회의 다과 구매",
      requestedCategory: "FOOD",
      resolvedCategory: "FOOD",
      status: "PENDING",
      reviewReason: "신규 가맹점: 카페베네",
      additionalExplanation: "학교 앞 신규 카페이며 종강총회 준비 회의 다과 구매 목적입니다.",
      resubmissionCount: 1,
      lastSubmittedAt: new Date("2026-04-03"),
      aiSuggestedCategory: "FOOD",
      aiRiskScore: 52,
      aiRiskLevel: "MEDIUM",
      aiExplanation: "다과 구매 성격은 맞지만 신규 가맹점이라 운영상 확인이 필요합니다.",
      createdAt: new Date("2026-04-03"),
    },
  });

  const tx6 = await prisma.transaction.create({
    data: {
      budgetId: eventBudget.id,
      organizationId: statsClub.id,
      merchantName: "문구사랑",
      amount: 20000,
      itemDescription: "A4 용지 10박스",
      requestedCategory: "SUPPLIES",
      resolvedCategory: "SUPPLIES",
      status: "APPROVED",
      reviewReason: "정책 조건 충족 — 자동 승인",
      aiSuggestedCategory: "SUPPLIES",
      aiRiskScore: 10,
      aiRiskLevel: "LOW",
      aiExplanation: "운영 물품 구매로 금액과 카테고리가 모두 안정적입니다.",
      createdAt: new Date("2026-04-02"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: eventBudget.id,
      transactionId: tx6.id,
      type: "SPEND",
      amount: -20000,
      balanceAfter: 400000,
      description: "문구사랑 - A4 용지 10박스",
      createdAt: new Date("2026-04-02"),
    },
  });

  const tx7 = await prisma.transaction.create({
    data: {
      budgetId: eventBudget.id,
      organizationId: statsClub.id,
      merchantName: "문구사랑",
      amount: 80000,
      itemDescription: "대형 현수막 거치대 구매",
      requestedCategory: "SUPPLIES",
      resolvedCategory: "SUPPLIES",
      status: "NOTIFIED",
      reviewReason: "자동승인 한도 초과 (50,000원), 승인 처리 후 관리자 알림",
      aiSuggestedCategory: "SUPPLIES",
      aiRiskScore: 44,
      aiRiskLevel: "MEDIUM",
      aiExplanation: "행사 장비 구매이나 동일 가맹점 연속 집행이 있어 확인이 필요합니다.",
      createdAt: new Date("2026-04-01"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: eventBudget.id,
      transactionId: tx7.id,
      type: "SPEND",
      amount: -80000,
      balanceAfter: 320000,
      description: "문구사랑 - 대형 현수막 거치대 구매",
      createdAt: new Date("2026-04-01"),
    },
  });

  const tx8 = await prisma.transaction.create({
    data: {
      budgetId: operationsBudget.id,
      organizationId: dataClub.id,
      merchantName: "스터디룸24",
      amount: 180000,
      itemDescription: "4월 세미나실 대관",
      requestedCategory: "VENUE",
      resolvedCategory: "VENUE",
      status: "APPROVED",
      reviewReason: "운영비 예산 목적과 일치하여 승인",
      aiSuggestedCategory: "VENUE",
      aiRiskScore: 22,
      aiRiskLevel: "LOW",
      aiExplanation: "세미나실 대관으로 운영비 목적과 일치해 정상 거래로 분류했습니다.",
      createdAt: new Date("2026-04-02"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: operationsBudget.id,
      transactionId: tx8.id,
      type: "SPEND",
      amount: -180000,
      balanceAfter: 1020000,
      description: "스터디룸24 - 4월 세미나실 대관",
      createdAt: new Date("2026-04-02"),
    },
  });

  const tx9 = await prisma.transaction.create({
    data: {
      budgetId: promoBudget.id,
      organizationId: statsClub.id,
      merchantName: "오피스디포",
      amount: 30000,
      itemDescription: "행사용 배너 추가 인쇄",
      requestedCategory: "PRINT",
      resolvedCategory: "PRINT",
      status: "APPROVED",
      reviewReason: "정책 조건 충족 — 자동 승인",
      aiSuggestedCategory: "PRINT",
      aiRiskScore: 28,
      aiRiskLevel: "LOW",
      aiExplanation: "행사 홍보용 인쇄물로 분류되며 예산 목적과 일치합니다.",
      createdAt: new Date("2026-04-11T23:40:00"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: promoBudget.id,
      transactionId: tx9.id,
      type: "SPEND",
      amount: -30000,
      balanceAfter: 95000,
      description: "오피스디포 - 행사용 배너 추가 인쇄",
      createdAt: new Date("2026-04-11T23:40:00"),
    },
  });

  const tx10 = await prisma.transaction.create({
    data: {
      budgetId: promoBudget.id,
      organizationId: statsClub.id,
      merchantName: "오피스디포",
      amount: 30000,
      itemDescription: "행사용 인쇄물 재주문",
      requestedCategory: "PRINT",
      resolvedCategory: "PRINT",
      status: "APPROVED",
      reviewReason: "정책 조건 충족 — 자동 승인",
      aiSuggestedCategory: "PRINT",
      aiRiskScore: 34,
      aiRiskLevel: "MEDIUM",
      aiExplanation: "짧은 시간 내 동일 가맹점·동일 금액 재주문이 반복되어 확인이 필요합니다.",
      createdAt: new Date("2026-04-12T00:15:00"),
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      budgetId: promoBudget.id,
      transactionId: tx10.id,
      type: "SPEND",
      amount: -30000,
      balanceAfter: 65000,
      description: "오피스디포 - 행사용 인쇄물 재주문",
      createdAt: new Date("2026-04-12T00:15:00"),
    },
  });

  await prisma.budgetSettlement.create({
    data: {
      budgetId: eventBudget.id,
      status: "SUBMITTED",
      reportNote:
        "종강총회 행사 준비가 완료되었고, 미집행 잔액은 행사 종료 후 환수 예정입니다.",
      reclaimAmount: 320000,
      createdAt: new Date("2026-04-03"),
    },
  });

  const policies = await prisma.policy.findMany({
    orderBy: { budgetId: "asc" },
  });

  for (const budget of [eventBudget, promoBudget, operationsBudget, seminarBudget]) {
    await createAnchorRecord(prisma, {
      eventType: "BUDGET_ISSUED",
      entityType: "BUDGET",
      entityId: budget.id,
      payload: {
        budgetId: budget.id,
        budgetName: budget.name,
        organizationId: budget.organizationId,
        issuerOrganizationId: budget.issuerOrganizationId,
        totalAmount: budget.totalAmount,
        validFrom: budget.validFrom.toISOString(),
        validUntil: budget.validUntil.toISOString(),
        sourceRequestId: budget.sourceRequestId,
      },
    });
  }

  for (const policy of policies) {
    await createAnchorRecord(prisma, {
      eventType: "POLICY_SNAPSHOT",
      entityType: "POLICY",
      entityId: policy.id,
      payload: {
        policyId: policy.id,
        budgetId: policy.budgetId,
        templateKey: policy.templateKey,
        allowedCategories: policy.allowedCategories,
        blockedCategories: policy.blockedCategories,
        blockedKeywords: policy.blockedKeywords,
        allowedKeywords: policy.allowedKeywords,
        categoryAutoApproveRules: policy.categoryAutoApproveRules,
        eventCategories: policy.eventCategories,
        autoApproveLimit: policy.autoApproveLimit,
        manualReviewLimit: policy.manualReviewLimit,
        allowNewMerchant: policy.allowNewMerchant,
        quietHoursStart: policy.quietHoursStart,
        quietHoursEnd: policy.quietHoursEnd,
        eventWindowStart: policy.eventWindowStart?.toISOString() || null,
        eventWindowEnd: policy.eventWindowEnd?.toISOString() || null,
      },
    });
  }

  for (const transaction of [tx1, tx2, tx3, tx4, tx5, tx6, tx7, tx8, tx9, tx10]) {
    await createAnchorRecord(prisma, {
      eventType: "TRANSACTION_DECISION",
      entityType: "TRANSACTION",
      entityId: transaction.id,
      payload: {
        transactionId: transaction.id,
        budgetId: transaction.budgetId,
        merchantName: transaction.merchantName,
        amount: transaction.amount,
        requestedCategory: transaction.requestedCategory,
        resolvedCategory: transaction.resolvedCategory,
        status: transaction.status,
        reviewReason: transaction.reviewReason,
      },
    });
  }

  const settlement = await prisma.budgetSettlement.findUniqueOrThrow({
    where: { budgetId: eventBudget.id },
  });

  await createAnchorRecord(prisma, {
    eventType: "SETTLEMENT_REPORT",
    entityType: "SETTLEMENT",
    entityId: settlement.id,
    payload: {
      settlementId: settlement.id,
      budgetId: settlement.budgetId,
      status: settlement.status,
      reclaimAmount: settlement.reclaimAmount,
      reportNote: settlement.reportNote,
    },
  });

  console.log("✅ Seed 데이터 생성 완료!");
  console.log("  Organizations: 3");
  console.log("  Users: 5");
  console.log("  Budgets: 4");
  console.log("  Policies: 4");
  console.log("  Merchants: 6");
  console.log("  Anchor Records: 19");
  console.log("  Budget Requests: 3");
  console.log("  Settlements: 1");
  console.log("  Transactions: 10");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
