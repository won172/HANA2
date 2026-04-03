/**
 * 정책 엔진 (Policy Engine)
 *
 * Level A: 즉시 승인 (APPROVED)
 * Level B: 승인 + 관리자 알림 (NOTIFIED)
 * Level C: 검토 필요 (PENDING)
 * Level D: 즉시 거절 (DECLINED)
 */

export type PolicyResult = {
  status: "APPROVED" | "NOTIFIED" | "PENDING" | "DECLINED";
  reason: string;
};

export type PolicyInput = {
  amount: number;
  merchantName: string;
  requestedCategory: string;
  itemDescription: string;
};

export type PolicyConfig = {
  allowedCategories: string[];
  blockedCategories: string[];
  blockedKeywords: string[];
  allowedKeywords: string[];
  categoryAutoApproveRules: Record<string, number>;
  eventCategories: string[];
  autoApproveLimit: number;
  manualReviewLimit: number;
  allowNewMerchant: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  eventWindowStart: Date | null;
  eventWindowEnd: Date | null;
};

export type BudgetInfo = {
  currentBalance: number;
  validFrom: Date;
  validUntil: Date;
  status: string;
};

export type KnownMerchants = string[];

export type MerchantInfo = {
  name: string;
  isApproved: boolean;
  category: string | null;
} | null;

function isWithinQuietHours(
  currentHour: number,
  startHour: number | null,
  endHour: number | null
) {
  if (startHour === null || endHour === null) {
    return false;
  }

  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }

  return currentHour >= startHour || currentHour < endHour;
}

function getCategoryAutoApproveLimit(
  category: string,
  policy: PolicyConfig
) {
  const normalizedCategory = category.toUpperCase();
  const specificLimit = policy.categoryAutoApproveRules[normalizedCategory];
  return typeof specificLimit === "number" ? specificLimit : policy.autoApproveLimit;
}

export function evaluatePolicy(
  input: PolicyInput,
  policy: PolicyConfig,
  budget: BudgetInfo,
  knownMerchants: KnownMerchants,
  merchant: MerchantInfo = null
): PolicyResult {
  const now = new Date();
  const currentHour = now.getHours();

  if (budget.status === "EXPIRED" || budget.status === "RECALLED") {
    return { status: "DECLINED", reason: "예산이 만료되었거나 환수 처리되었습니다." };
  }

  if (now < budget.validFrom) {
    return { status: "DECLINED", reason: "예산 시작일 이전입니다." };
  }

  if (now > budget.validUntil) {
    return { status: "DECLINED", reason: "예산 유효기간이 만료되었습니다." };
  }

  if (input.amount > budget.currentBalance) {
    return {
      status: "DECLINED",
      reason: `잔액 부족: 요청 ${input.amount.toLocaleString()}원, 잔액 ${budget.currentBalance.toLocaleString()}원`,
    };
  }

  const upperCategory = input.requestedCategory.toUpperCase();
  const lowerDescription = input.itemDescription.toLowerCase();
  const lowerMerchantName = input.merchantName.toLowerCase();

  if (policy.blockedCategories.some((category) => category.toUpperCase() === upperCategory)) {
    return {
      status: "DECLINED",
      reason: `금지 카테고리: ${input.requestedCategory}`,
    };
  }

  const blockedKeyword = policy.blockedKeywords.find((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    return (
      lowerDescription.includes(lowerKeyword) || lowerMerchantName.includes(lowerKeyword)
    );
  });

  const allowedKeyword = policy.allowedKeywords.find((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    return (
      lowerDescription.includes(lowerKeyword) || lowerMerchantName.includes(lowerKeyword)
    );
  });

  if (blockedKeyword && !allowedKeyword) {
    return {
      status: "DECLINED",
      reason: `금지 키워드 감지: "${blockedKeyword}"`,
    };
  }

  const pendingReasons: string[] = [];

  if (blockedKeyword && allowedKeyword) {
    pendingReasons.push(
      `금지 키워드 "${blockedKeyword}" 감지, 허용 키워드 "${allowedKeyword}"와 충돌하여 검토 필요`
    );
  }

  if (
    policy.allowedCategories.length > 0 &&
    !policy.allowedCategories.some((category) => category.toUpperCase() === upperCategory)
  ) {
    pendingReasons.push(`허용되지 않은 카테고리: ${input.requestedCategory}`);
  }

  const knownByHistory = knownMerchants.some(
    (knownMerchant) => knownMerchant.toLowerCase() === lowerMerchantName
  );

  if (merchant && !merchant.isApproved) {
    pendingReasons.push(`미승인 가맹점: ${input.merchantName}`);
  } else if (!merchant && !knownByHistory && !policy.allowNewMerchant) {
    pendingReasons.push(`신규 가맹점: ${input.merchantName}`);
  }

  if (isWithinQuietHours(currentHour, policy.quietHoursStart, policy.quietHoursEnd)) {
    pendingReasons.push(
      `제한 시간대 결제: ${policy.quietHoursStart}:00 ~ ${policy.quietHoursEnd}:00`
    );
  }

  if (
    policy.eventCategories.some((category) => category.toUpperCase() === upperCategory) &&
    policy.eventWindowStart &&
    policy.eventWindowEnd &&
    (now < policy.eventWindowStart || now > policy.eventWindowEnd)
  ) {
    pendingReasons.push(
      `행사 기간 외 집행: ${policy.eventWindowStart.toLocaleDateString("ko-KR")} ~ ${policy.eventWindowEnd.toLocaleDateString("ko-KR")}`
    );
  }

  if (input.amount > policy.manualReviewLimit) {
    pendingReasons.push(
      `수동검토 한도 초과: ${input.amount.toLocaleString()}원 > ${policy.manualReviewLimit.toLocaleString()}원`
    );
  }

  if (pendingReasons.length > 0) {
    return {
      status: "PENDING",
      reason: pendingReasons.join(" / "),
    };
  }

  const autoApproveLimit = getCategoryAutoApproveLimit(input.requestedCategory, policy);

  if (input.amount > autoApproveLimit) {
    return {
      status: "NOTIFIED",
      reason:
        autoApproveLimit === policy.autoApproveLimit
          ? `자동승인 한도 초과 (${policy.autoApproveLimit.toLocaleString()}원), 승인 처리 후 관리자 알림`
          : `${input.requestedCategory} 카테고리 자동승인 한도 초과 (${autoApproveLimit.toLocaleString()}원), 승인 처리 후 관리자 알림`,
    };
  }

  return {
    status: "APPROVED",
    reason: merchant?.isApproved
      ? "승인된 가맹점이며 정책 조건 충족 — 자동 승인"
      : "정책 조건 충족 — 자동 승인",
  };
}
