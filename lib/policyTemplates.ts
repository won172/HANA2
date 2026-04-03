export type PolicyTemplateConfig = {
  key: string;
  label: string;
  description: string;
  allowedCategories: string[];
  blockedCategories: string[];
  blockedKeywords: string[];
  allowedKeywords: string[];
  categoryAutoApproveRules: Record<string, number>;
  autoApproveLimit: number;
  manualReviewLimit: number;
  allowNewMerchant: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  eventCategories: string[];
};

export const POLICY_TEMPLATES: PolicyTemplateConfig[] = [
  {
    key: "event",
    label: "행사 예산",
    description: "행사성 예산에 맞춘 식음료·운영물품 중심 템플릿",
    allowedCategories: ["FOOD", "SUPPLIES", "VENUE", "TRANSPORT"],
    blockedCategories: ["ALCOHOL", "TOBACCO", "GAME"],
    blockedKeywords: ["술", "담배", "주류", "게임"],
    allowedKeywords: ["다과", "행사", "세미나", "총회"],
    categoryAutoApproveRules: {
      FOOD: 30000,
      SUPPLIES: 50000,
      TRANSPORT: 40000,
    },
    autoApproveLimit: 50000,
    manualReviewLimit: 150000,
    allowNewMerchant: false,
    quietHoursStart: 23,
    quietHoursEnd: 7,
    eventCategories: ["FOOD", "VENUE", "SUPPLIES"],
  },
  {
    key: "promo",
    label: "홍보 예산",
    description: "인쇄물과 디자인 제작 중심 예산 템플릿",
    allowedCategories: ["PRINT", "SUPPLIES", "DESIGN"],
    blockedCategories: ["ALCOHOL", "TOBACCO", "GAME"],
    blockedKeywords: ["술", "담배", "주류", "게임"],
    allowedKeywords: ["현수막", "포스터", "배너", "홍보"],
    categoryAutoApproveRules: {
      PRINT: 100000,
      DESIGN: 80000,
      SUPPLIES: 40000,
    },
    autoApproveLimit: 50000,
    manualReviewLimit: 150000,
    allowNewMerchant: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    eventCategories: [],
  },
  {
    key: "transport",
    label: "교통 지원",
    description: "교통비와 이동 지원 중심 예산 템플릿",
    allowedCategories: ["TRANSPORT", "FOOD"],
    blockedCategories: ["ALCOHOL", "TOBACCO", "GAME"],
    blockedKeywords: ["주류", "유흥", "게임"],
    allowedKeywords: ["버스", "기차", "출장", "교통"],
    categoryAutoApproveRules: {
      TRANSPORT: 70000,
      FOOD: 20000,
    },
    autoApproveLimit: 50000,
    manualReviewLimit: 120000,
    allowNewMerchant: false,
    quietHoursStart: 23,
    quietHoursEnd: 6,
    eventCategories: [],
  },
  {
    key: "equipment",
    label: "장비 구매",
    description: "기자재와 운영 물품 구매 중심 템플릿",
    allowedCategories: ["SUPPLIES", "OTHER", "PRINT"],
    blockedCategories: ["ALCOHOL", "TOBACCO", "GAME"],
    blockedKeywords: ["주류", "담배", "유흥"],
    allowedKeywords: ["장비", "기기", "운영", "구매"],
    categoryAutoApproveRules: {
      SUPPLIES: 80000,
      PRINT: 50000,
    },
    autoApproveLimit: 70000,
    manualReviewLimit: 250000,
    allowNewMerchant: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    eventCategories: [],
  },
];

export function getPolicyTemplate(key: string | null | undefined) {
  return POLICY_TEMPLATES.find((template) => template.key === key) || null;
}

export function recommendPolicyTemplate(categories: string[]) {
  const normalizedCategories = new Set(
    categories.map((category) => category.toUpperCase())
  );

  const rankedTemplates = POLICY_TEMPLATES.map((template) => {
    const score = template.allowedCategories.reduce((count, category) => {
      return normalizedCategories.has(category.toUpperCase()) ? count + 1 : count;
    }, 0);

    return { template, score };
  }).sort((left, right) => right.score - left.score);

  return rankedTemplates[0]?.score ? rankedTemplates[0].template : POLICY_TEMPLATES[0];
}
