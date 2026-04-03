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
  autoApproveLimit: number;
  manualReviewLimit: number;
  allowNewMerchant: boolean;
};

export type BudgetInfo = {
  currentBalance: number;
  validFrom: Date;
  validUntil: Date;
  status: string;
};

// 기존 거래에서 가맹점 목록 추출용
export type KnownMerchants = string[];

export function evaluatePolicy(
  input: PolicyInput,
  policy: PolicyConfig,
  budget: BudgetInfo,
  knownMerchants: KnownMerchants
): PolicyResult {
  const now = new Date();

  // ===== Level D: 즉시 거절 =====
  
  // 1. 예산 만료
  if (budget.status === "EXPIRED" || budget.status === "RECALLED") {
    return { status: "DECLINED", reason: "예산이 만료되었거나 환수 처리되었습니다." };
  }

  if (now < budget.validFrom) {
    return { status: "DECLINED", reason: "예산 시작일 이전입니다." };
  }

  if (now > budget.validUntil) {
    return { status: "DECLINED", reason: "예산 유효기간이 만료되었습니다." };
  }

  // 2. 잔액 부족
  if (input.amount > budget.currentBalance) {
    return { 
      status: "DECLINED", 
      reason: `잔액 부족: 요청 ${input.amount.toLocaleString()}원, 잔액 ${budget.currentBalance.toLocaleString()}원` 
    };
  }

  // 3. 금지 카테고리
  if (policy.blockedCategories.length > 0) {
    const upperCategory = input.requestedCategory.toUpperCase();
    const isBlocked = policy.blockedCategories.some(
      (cat) => cat.toUpperCase() === upperCategory
    );
    if (isBlocked) {
      return { 
        status: "DECLINED", 
        reason: `금지 카테고리: ${input.requestedCategory}` 
      };
    }
  }

  // 4. 금지 키워드 검사
  if (policy.blockedKeywords.length > 0) {
    const desc = input.itemDescription.toLowerCase();
    const merchant = input.merchantName.toLowerCase();
    const foundKeyword = policy.blockedKeywords.find(
      (kw) => desc.includes(kw.toLowerCase()) || merchant.includes(kw.toLowerCase())
    );
    if (foundKeyword) {
      return { 
        status: "DECLINED", 
        reason: `금지 키워드 감지: "${foundKeyword}"` 
      };
    }
  }

  // ===== Level C: 검토 필요 =====
  const pendingReasons: string[] = [];

  // 1. 허용 카테고리 미포함
  if (policy.allowedCategories.length > 0) {
    const upperCategory = input.requestedCategory.toUpperCase();
    const isAllowed = policy.allowedCategories.some(
      (cat) => cat.toUpperCase() === upperCategory
    );
    if (!isAllowed) {
      pendingReasons.push(`허용되지 않은 카테고리: ${input.requestedCategory}`);
    }
  }

  // 2. 신규 가맹점 검사
  const isNewMerchant = !knownMerchants.some(
    (m) => m.toLowerCase() === input.merchantName.toLowerCase()
  );
  if (isNewMerchant && !policy.allowNewMerchant) {
    pendingReasons.push(`신규 가맹점: ${input.merchantName}`);
  }

  // 3. manualReviewLimit 초과
  if (input.amount > policy.manualReviewLimit) {
    pendingReasons.push(
      `수동검토 한도 초과: ${input.amount.toLocaleString()}원 > ${policy.manualReviewLimit.toLocaleString()}원`
    );
  }

  if (pendingReasons.length > 0) {
    return { 
      status: "PENDING", 
      reason: pendingReasons.join(" / ") 
    };
  }

  // ===== Level B: 승인 + 알림 =====
  if (input.amount > policy.autoApproveLimit) {
    return { 
      status: "NOTIFIED", 
      reason: `자동승인 한도 초과 (${policy.autoApproveLimit.toLocaleString()}원), 승인 처리 후 관리자 알림` 
    };
  }

  // ===== Level A: 즉시 승인 =====
  return { 
    status: "APPROVED", 
    reason: "정책 조건 충족 — 자동 승인" 
  };
}
