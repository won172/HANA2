type BudgetSnapshot = {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  validUntil: Date;
  organization: {
    id?: string;
    name: string;
  };
};

type TransactionSnapshot = {
  id: string;
  budgetId: string;
  organizationId?: string;
  merchantName: string;
  amount: number;
  status: string;
  requestedCategory: string;
  resolvedCategory: string | null;
  itemDescription: string;
  reviewReason: string | null;
  aiRiskScore: number | null;
  aiRiskLevel: string | null;
  createdAt: Date;
  budget: {
    id: string;
    name: string;
    totalAmount: number;
    validUntil: Date;
  };
  organization: {
    id?: string;
    name: string;
  };
};

export type MemoNormalization = {
  normalizedCategory: string | null;
  normalizedLabel: string | null;
  matchedKeyword: string | null;
};

export type AnomalySeverity = "HIGH" | "MEDIUM" | "LOW";

export type AnomalyRecord = {
  id: string;
  type:
    | "LATE_NIGHT_REPEAT"
    | "REPEATED_AMOUNT"
    | "RUSH_SPEND"
    | "MERCHANT_CONCENTRATION";
  severity: AnomalySeverity;
  title: string;
  description: string;
  organizationName: string;
  budgetName?: string;
  merchantName?: string;
  transactionIds: string[];
  relatedAmount: number;
  detectedAt: string;
};

export type OperationsInsightSummary = {
  headline: string;
  highlights: string[];
  recommendedActions: string[];
  memoNormalizationExamples: Array<{
    transactionId: string;
    raw: string;
    normalizedCategory: string;
    normalizedLabel: string;
  }>;
  counters: {
    anomalyCount: number;
    highRiskCount: number;
    pendingCount: number;
    merchantConcentrationCount: number;
    repeatedAmountCount: number;
    rushSpendCount: number;
    lateNightCount: number;
  };
};

const APPROVED_STATUSES = new Set(["APPROVED", "NOTIFIED"]);

const MEMO_PATTERNS: Array<{
  category: string;
  label: string;
  keywords: string[];
}> = [
  {
    category: "PRINT",
    label: "홍보·인쇄물 제작",
    keywords: ["현수막", "배너", "인쇄", "출력", "포스터", "리플렛", "홍보물"],
  },
  {
    category: "FOOD",
    label: "식음료·다과",
    keywords: ["다과", "도시락", "식비", "음료", "커피", "간식"],
  },
  {
    category: "VENUE",
    label: "공간 대관",
    keywords: ["대관", "세미나실", "강의실", "공간", "예약"],
  },
  {
    category: "SUPPLIES",
    label: "운영 물품",
    keywords: ["문구", "사무용품", "용지", "펜", "거치대", "준비물"],
  },
  {
    category: "TRANSPORT",
    label: "교통 지원",
    keywords: ["교통", "버스", "택시", "주유", "이동"],
  },
  {
    category: "DESIGN",
    label: "디자인 작업",
    keywords: ["디자인", "시안", "편집", "썸네일"],
  },
];

function toTimeKey(date: Date) {
  return date.toISOString().slice(0, 16);
}

function formatMoney(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function hoursUntilBudgetEnd(transactionDate: Date, validUntil: Date) {
  return (validUntil.getTime() - transactionDate.getTime()) / (1000 * 60 * 60);
}

function daysBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export function normalizeSpendingMemo(input: string): MemoNormalization {
  const text = input.trim();

  if (!text) {
    return {
      normalizedCategory: null,
      normalizedLabel: null,
      matchedKeyword: null,
    };
  }

  const lowered = text.toLowerCase();

  for (const pattern of MEMO_PATTERNS) {
    const keyword = pattern.keywords.find((candidate) =>
      lowered.includes(candidate.toLowerCase())
    );

    if (keyword) {
      return {
        normalizedCategory: pattern.category,
        normalizedLabel: pattern.label,
        matchedKeyword: keyword,
      };
    }
  }

  return {
    normalizedCategory: null,
    normalizedLabel: null,
    matchedKeyword: null,
  };
}

export function draftReviewReason(input: {
  status: "APPROVED" | "NOTIFIED" | "PENDING" | "DECLINED";
  policyReason: string;
  aiRiskLevel?: string | null;
  aiRiskScore?: number | null;
  normalizedMemo?: MemoNormalization;
}) {
  const normalizedHint =
    input.normalizedMemo?.normalizedCategory &&
    input.normalizedMemo.normalizedCategory !== "OTHER"
      ? ` 메모 정규화 결과 ${input.normalizedMemo.normalizedCategory} 성격의 집행으로 분류했습니다.`
      : "";

  if (input.status === "DECLINED") {
    if (input.policyReason.includes("금지 키워드")) {
      return `정책상 금지된 항목이 감지되어 집행할 수 없습니다.${normalizedHint}`;
    }

    if (input.policyReason.includes("허용 카테고리")) {
      return `현재 예산 목적과 맞지 않는 카테고리로 판단되어 거절되었습니다.${normalizedHint}`;
    }

    return `${input.policyReason}.${normalizedHint}`.trim();
  }

  if (input.status === "PENDING") {
    if (input.policyReason.includes("신규 가맹점")) {
      return `신규 가맹점 사용 요청으로 추가 확인이 필요합니다.${normalizedHint}`;
    }

    if (
      input.aiRiskLevel === "HIGH" &&
      typeof input.aiRiskScore === "number"
    ) {
      return `정책상 즉시 거절 대상은 아니지만 AI 위험 점수 ${input.aiRiskScore}점으로 검토가 필요합니다.${normalizedHint}`;
    }

    return `정책 예외 가능성이 있어 관리자 검토가 필요합니다. ${input.policyReason}${normalizedHint}`;
  }

  if (input.status === "NOTIFIED") {
    return `정책 범위 안에서 승인되었지만 관리자 확인이 필요한 집행입니다. ${input.policyReason}${normalizedHint}`;
  }

  return `정책 조건을 충족하여 승인되었습니다.${normalizedHint}`;
}

export function detectTransactionAnomalies(
  budgets: BudgetSnapshot[],
  transactions: TransactionSnapshot[]
) {
  const anomalies: AnomalyRecord[] = [];
  const approvedTransactions = transactions.filter((transaction) =>
    APPROVED_STATUSES.has(transaction.status)
  );

  const lateNightGroups = new Map<string, TransactionSnapshot[]>();
  for (const transaction of transactions) {
    const hour = transaction.createdAt.getHours();
    const isLateNight = hour >= 23 || hour < 6;
    if (!isLateNight) {
      continue;
    }

    const key = `${transaction.organization.name}:${transaction.budgetId}`;
    const group = lateNightGroups.get(key) ?? [];
    group.push(transaction);
    lateNightGroups.set(key, group);
  }

  lateNightGroups.forEach((group, key) => {
    if (group.length < 2) {
      return;
    }

    const totalAmount = group.reduce((sum, transaction) => sum + transaction.amount, 0);
    anomalies.push({
      id: `late-night:${key}`,
      type: "LATE_NIGHT_REPEAT",
      severity: group.length >= 3 ? "HIGH" : "MEDIUM",
      title: "야간 반복 결제 감지",
      description: `${group[0].organization.name}에서 심야 시간대 거래가 ${group.length}건 반복되었습니다.`,
      organizationName: group[0].organization.name,
      budgetName: group[0].budget.name,
      transactionIds: group.map((transaction) => transaction.id),
      relatedAmount: totalAmount,
      detectedAt: group[0].createdAt.toISOString(),
    });
  });

  const repeatedAmountGroups = new Map<string, TransactionSnapshot[]>();
  for (const transaction of transactions) {
    if (transaction.amount < 30000) {
      continue;
    }

    const key = `${transaction.organization.name}:${transaction.amount}`;
    const group = repeatedAmountGroups.get(key) ?? [];
    group.push(transaction);
    repeatedAmountGroups.set(key, group);
  }

  repeatedAmountGroups.forEach((group, key) => {
    if (group.length < 2) {
      return;
    }

    const sorted = [...group].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
    );

    if (daysBetween(sorted[0].createdAt, sorted[sorted.length - 1].createdAt) > 14) {
      return;
    }

    anomalies.push({
      id: `repeated-amount:${key}`,
      type: "REPEATED_AMOUNT",
      severity: group.length >= 3 ? "HIGH" : "MEDIUM",
      title: "동일 금액 반복 요청",
      description: `${formatMoney(group[0].amount)}원 요청이 ${group.length}건 반복되었습니다.`,
      organizationName: group[0].organization.name,
      budgetName: group[0].budget.name,
      merchantName: group[0].merchantName,
      transactionIds: group.map((transaction) => transaction.id),
      relatedAmount: group[0].amount * group.length,
      detectedAt: sorted[sorted.length - 1].createdAt.toISOString(),
    });
  });

  budgets.forEach((budget) => {
    const budgetTransactions = approvedTransactions.filter(
      (transaction) => transaction.budgetId === budget.id
    );

    const rushTransactions = budgetTransactions.filter((transaction) => {
      const remainingHours = hoursUntilBudgetEnd(
        transaction.createdAt,
        budget.validUntil
      );
      return remainingHours >= 0 && remainingHours <= 72;
    });

    const rushAmount = rushTransactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    );

    if (
      rushTransactions.length >= 2 ||
      rushAmount >= Math.max(100000, budget.totalAmount * 0.25)
    ) {
      anomalies.push({
        id: `rush-spend:${budget.id}`,
        type: "RUSH_SPEND",
        severity:
          rushAmount >= budget.totalAmount * 0.35 ? "HIGH" : "MEDIUM",
        title: "행사 종료 직전 몰아쓰기",
        description: `예산 종료 3일 이내에 ${formatMoney(rushAmount)}원이 집행되었습니다.`,
        organizationName: budget.organization.name,
        budgetName: budget.name,
        transactionIds: rushTransactions.map((transaction) => transaction.id),
        relatedAmount: rushAmount,
        detectedAt:
          rushTransactions[0]?.createdAt.toISOString() ??
          budget.validUntil.toISOString(),
      });
    }

    const merchantSpend = new Map<
      string,
      { amount: number; transactionIds: string[] }
    >();
    for (const transaction of budgetTransactions) {
      const current = merchantSpend.get(transaction.merchantName) ?? {
        amount: 0,
        transactionIds: [],
      };
      current.amount += transaction.amount;
      current.transactionIds.push(transaction.id);
      merchantSpend.set(transaction.merchantName, current);
    }

    let topMerchant: string | null = null;
    let topAmount = 0;
    let topTransactions: string[] = [];
    merchantSpend.forEach((value, merchantName) => {
      if (value.amount > topAmount) {
        topMerchant = merchantName;
        topAmount = value.amount;
        topTransactions = value.transactionIds;
      }
    });

    const totalSpent = budgetTransactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    );

    if (
      topMerchant &&
      totalSpent >= 100000 &&
      topAmount / totalSpent >= 0.6
    ) {
      anomalies.push({
        id: `merchant-concentration:${budget.id}:${topMerchant}`,
        type: "MERCHANT_CONCENTRATION",
        severity: topAmount / totalSpent >= 0.75 ? "HIGH" : "MEDIUM",
        title: "특정 가맹점 편중",
        description: `${topMerchant} 사용 비중이 전체 집행의 ${Math.round(
          (topAmount / totalSpent) * 100
        )}%입니다.`,
        organizationName: budget.organization.name,
        budgetName: budget.name,
        merchantName: topMerchant,
        transactionIds: topTransactions,
        relatedAmount: topAmount,
        detectedAt:
          budgetTransactions[0]?.createdAt.toISOString() ??
          budget.validUntil.toISOString(),
      });
    }
  });

  return anomalies.sort((left, right) => {
    const severityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const severityGap = severityRank[right.severity] - severityRank[left.severity];
    if (severityGap !== 0) {
      return severityGap;
    }

    return right.relatedAmount - left.relatedAmount;
  });
}

export function buildOperationsInsightSummary(
  budgets: BudgetSnapshot[],
  transactions: TransactionSnapshot[],
  anomalies: AnomalyRecord[]
): OperationsInsightSummary {
  const highRiskCount = transactions.filter(
    (transaction) => transaction.aiRiskLevel === "HIGH"
  ).length;
  const pendingCount = transactions.filter(
    (transaction) => transaction.status === "PENDING"
  ).length;

  const memoNormalizationExamples = transactions
    .map((transaction) => {
      const normalized = normalizeSpendingMemo(transaction.itemDescription);
      if (!normalized.normalizedCategory || !normalized.normalizedLabel) {
        return null;
      }

      return {
        transactionId: transaction.id,
        raw: transaction.itemDescription,
        normalizedCategory: normalized.normalizedCategory,
        normalizedLabel: normalized.normalizedLabel,
      };
    })
    .filter(
      (
        example
      ): example is {
        transactionId: string;
        raw: string;
        normalizedCategory: string;
        normalizedLabel: string;
      } => Boolean(example)
    )
    .slice(0, 3);

  const anomalyTitles = {
    LATE_NIGHT_REPEAT: "야간 반복 결제",
    REPEATED_AMOUNT: "동일 금액 반복",
    RUSH_SPEND: "종료 직전 몰아쓰기",
    MERCHANT_CONCENTRATION: "가맹점 편중",
  } as const;

  const topAnomalies = anomalies.slice(0, 3);
  const highlights = topAnomalies.map(
    (anomaly) =>
      `${anomalyTitles[anomaly.type]}: ${anomaly.description}`
  );

  if (highRiskCount > 0) {
    highlights.unshift(`AI 고위험으로 분류된 거래가 ${highRiskCount}건 있습니다.`);
  }

  const expiringBudgets = budgets.filter((budget) => {
    const remainingDays = hoursUntilBudgetEnd(new Date(), budget.validUntil) / 24;
    return remainingDays >= 0 && remainingDays <= 14;
  });

  const recommendedActions = [
    topAnomalies[0]
      ? `${topAnomalies[0].organizationName}의 ${topAnomalies[0].title}부터 우선 검토하세요.`
      : "현재는 즉시 개입이 필요한 이상 징후가 두드러지지 않습니다.",
    pendingCount > 0
      ? `보류 거래 ${pendingCount}건의 추가 설명과 증빙을 우선 확인하세요.`
      : "보류 거래가 없어 승인 대기열은 안정적입니다.",
    expiringBudgets.length > 0
      ? `만료 임박 예산 ${expiringBudgets.length}건은 종료 보고 및 환수 계획을 함께 점검하세요.`
      : "만료 임박 예산은 아직 많지 않습니다.",
  ];

  return {
    headline:
      anomalies.length > 0
        ? `현재 ${anomalies.length}건의 운영 이상 징후가 감지되었습니다.`
        : "현재 거래 흐름은 전반적으로 안정적으로 유지되고 있습니다.",
    highlights,
    recommendedActions,
    memoNormalizationExamples,
    counters: {
      anomalyCount: anomalies.length,
      highRiskCount,
      pendingCount,
      merchantConcentrationCount: anomalies.filter(
        (anomaly) => anomaly.type === "MERCHANT_CONCENTRATION"
      ).length,
      repeatedAmountCount: anomalies.filter(
        (anomaly) => anomaly.type === "REPEATED_AMOUNT"
      ).length,
      rushSpendCount: anomalies.filter(
        (anomaly) => anomaly.type === "RUSH_SPEND"
      ).length,
      lateNightCount: anomalies.filter(
        (anomaly) => anomaly.type === "LATE_NIGHT_REPEAT"
      ).length,
    },
  };
}
