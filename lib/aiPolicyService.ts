import { GoogleGenAI, Type } from "@google/genai";
import { getPolicyTemplate, POLICY_TEMPLATES } from "@/lib/policyTemplates";

const ALL_CATEGORIES = [
  "FOOD",
  "SUPPLIES",
  "PRINT",
  "VENUE",
  "TRANSPORT",
  "DESIGN",
  "ALCOHOL",
  "TOBACCO",
  "GAME",
  "OTHER",
] as const;

const DEFAULT_BLOCKED_CATEGORIES = ["ALCOHOL", "TOBACCO", "GAME"];
const DEFAULT_BLOCKED_KEYWORDS = ["술", "담배", "주류", "게임"];
const SENSITIVE_CATEGORY_HINTS = {
  ALCOHOL: {
    patterns: [/주류/, /술/, /맥주/, /와인/, /소주/, /칵테일/, /샴페인/],
    keywords: ["술", "주류", "맥주", "와인", "소주", "칵테일", "샴페인"],
  },
  TOBACCO: {
    patterns: [/담배/, /흡연/, /전자담배/],
    keywords: ["담배", "흡연", "전자담배"],
  },
  GAME: {
    patterns: [/게임/, /e스포츠/, /이스포츠/, /오락/],
    keywords: ["게임", "e스포츠", "이스포츠", "오락"],
  },
} as const;

export type AiPolicyInput = {
  name: string;
  purpose: string;
  totalAmount: number;
  validFrom: string;
  validUntil: string;
};

export type AiPolicyDraft = {
  displayName: string;
  summary: string;
  policySource: "AI";
  aiConfidence: number;
  templateKey: string;
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
};

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

function normalizeCategoryList(input: unknown, fallback: string[]) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const normalized = input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => ALL_CATEGORIES.includes(item as (typeof ALL_CATEGORIES)[number]));

  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

function normalizeKeywordList(input: unknown, fallback: string[]) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const normalized = input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

function normalizeCategoryRules(
  input: unknown,
  allowedCategories: string[],
  fallbackLimit: number
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.fromEntries(
      allowedCategories.slice(0, 3).map((category) => [category, fallbackLimit])
    ) as Record<string, number>;
  }

  const normalized = Object.entries(input).reduce<Record<string, number>>(
    (accumulator, [key, rawValue]) => {
      const normalizedKey = key.trim().toUpperCase();
      const amount = Math.round(Number(rawValue));
      if (
        allowedCategories.includes(normalizedKey) &&
        Number.isFinite(amount) &&
        amount > 0
      ) {
        accumulator[normalizedKey] = amount;
      }
      return accumulator;
    },
    {}
  );

  if (Object.keys(normalized).length > 0) {
    return normalized;
  }

  return Object.fromEntries(
    allowedCategories.slice(0, 3).map((category) => [category, fallbackLimit])
  ) as Record<string, number>;
}

function detectExplicitSensitivePurpose(text: string) {
  return Object.entries(SENSITIVE_CATEGORY_HINTS).reduce<string[]>(
    (accumulator, [category, config]) => {
      if (config.patterns.some((pattern) => pattern.test(text))) {
        accumulator.push(category);
      }
      return accumulator;
    },
    []
  );
}

function applySensitiveCategoryOverrides(
  draft: AiPolicyDraft,
  text: string
): AiPolicyDraft {
  const explicitSensitiveCategories = detectExplicitSensitivePurpose(text);

  if (explicitSensitiveCategories.length === 0) {
    return draft;
  }

  const allowedCategories = [
    ...new Set([...draft.allowedCategories, ...explicitSensitiveCategories]),
  ];
  const blockedCategories = draft.blockedCategories.filter(
    (category) => !explicitSensitiveCategories.includes(category)
  );
  const exceptionKeywords: string[] = explicitSensitiveCategories.flatMap(
    (category) =>
      SENSITIVE_CATEGORY_HINTS[category as keyof typeof SENSITIVE_CATEGORY_HINTS]?.keywords ?? []
  );
  const blockedKeywords = draft.blockedKeywords.filter(
    (keyword) => !exceptionKeywords.includes(keyword)
  );
  const allowedKeywords = [...new Set([...draft.allowedKeywords, ...exceptionKeywords])];
  const categoryAutoApproveRules = { ...draft.categoryAutoApproveRules };

  for (const category of explicitSensitiveCategories) {
    if (!categoryAutoApproveRules[category]) {
      categoryAutoApproveRules[category] = draft.autoApproveLimit;
    }
  }

  return {
    ...draft,
    allowedCategories,
    blockedCategories,
    blockedKeywords,
    allowedKeywords,
    categoryAutoApproveRules,
  };
}

function buildFallbackDraft(input: AiPolicyInput): AiPolicyDraft {
  const text = `${input.name} ${input.purpose}`.toLowerCase();

  const templateKey =
    /(홍보|포스터|배너|인쇄|디자인|브랜딩|sns)/.test(text)
      ? "promo"
      : /(교통|버스|기차|이동|출장)/.test(text)
        ? "transport"
        : /(장비|기기|노트북|카메라|기자재|구매)/.test(text)
          ? "equipment"
          : "event";

  const template = getPolicyTemplate(templateKey) || POLICY_TEMPLATES[0];
  const baseAutoLimit =
    input.totalAmount >= 2_000_000
      ? 100000
      : input.totalAmount >= 1_000_000
        ? 70000
        : 50000;
  const manualReviewLimit = Math.max(baseAutoLimit * 3, 150000);

  const fallbackDraft: AiPolicyDraft = {
    displayName: "AI 정책",
    summary: `"${input.name}" 예산 목적과 금액을 기준으로 ${template.label} 중심 정책을 자동 구성했습니다.`,
    policySource: "AI",
    aiConfidence: 0.62,
    templateKey: "ai-generated",
    allowedCategories: template.allowedCategories,
    blockedCategories: template.blockedCategories,
    blockedKeywords: template.blockedKeywords,
    allowedKeywords: template.allowedKeywords,
    categoryAutoApproveRules:
      Object.keys(template.categoryAutoApproveRules).length > 0
        ? template.categoryAutoApproveRules
        : Object.fromEntries(
            template.allowedCategories.slice(0, 3).map((category) => [category, baseAutoLimit])
          ),
    eventCategories: /(행사|세미나|총회|워크숍|축제|오리엔테이션)/.test(text)
      ? template.allowedCategories.filter((category) =>
          ["FOOD", "SUPPLIES", "VENUE", "TRANSPORT"].includes(category)
        )
      : [],
    autoApproveLimit: baseAutoLimit,
    manualReviewLimit,
    allowNewMerchant: input.totalAmount < 700000,
    quietHoursStart: /(행사|총회|세미나|축제)/.test(text) ? 23 : null,
    quietHoursEnd: /(행사|총회|세미나|축제)/.test(text) ? 7 : null,
  };

  return applySensitiveCategoryOverrides(fallbackDraft, text);
}

export async function generateAiPolicy(
  input: AiPolicyInput
): Promise<AiPolicyDraft> {
  const fallback = buildFallbackDraft(input);
  const ai = getGeminiClient();

  if (!ai) {
    return fallback;
  }

  const prompt = `당신은 기관용 목적형 예산 플랫폼의 정책 설계 AI입니다.
아래 예산 정보를 보고 실제 집행용 정책(JSON)을 생성하세요.

## 예산 정보
- 예산명: ${input.name}
- 예산 설명: ${input.purpose || "-"}
- 총 금액: ${input.totalAmount.toLocaleString("ko-KR")}원
- 유효 시작일: ${input.validFrom}
- 만료일: ${input.validUntil}

## 정책 설계 원칙
1. allowedCategories는 실제 목적에 맞는 카테고리만 선택
2. ALCOHOL, TOBACCO, GAME은 기본적으로 금지하지만, 예산명/설명에 공식 목적이 명확히 적혀 있으면 허용 가능
3. 공식 목적상 허용한 민감 카테고리는 blockedCategories와 blockedKeywords에서 제거해야 함
4. autoApproveLimit은 소액 자동승인 기준
5. manualReviewLimit은 그 이상에서 보류 검토가 필요한 기준
6. eventCategories는 행사성 예산에서만 설정
7. summary는 관리자가 바로 이해할 수 있는 한국어 2문장 이내 설명
8. displayName은 반드시 "AI 정책"
9. templateKey는 반드시 "ai-generated"
10. policySource는 반드시 "AI"

## 카테고리 후보
FOOD, SUPPLIES, PRINT, VENUE, TRANSPORT, DESIGN, ALCOHOL, TOBACCO, GAME, OTHER

## 응답 형식
JSON만 반환하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            displayName: { type: Type.STRING },
            summary: { type: Type.STRING },
            aiConfidence: { type: Type.NUMBER },
            allowedCategories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            blockedCategories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            blockedKeywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            allowedKeywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            categoryAutoApproveRules: {
              type: Type.OBJECT,
              properties: {},
            },
            eventCategories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            autoApproveLimit: { type: Type.NUMBER },
            manualReviewLimit: { type: Type.NUMBER },
            allowNewMerchant: { type: Type.BOOLEAN },
            quietHoursStart: { type: Type.NUMBER },
            quietHoursEnd: { type: Type.NUMBER },
          },
          required: [
            "displayName",
            "summary",
            "aiConfidence",
            "allowedCategories",
            "blockedCategories",
            "blockedKeywords",
            "allowedKeywords",
            "categoryAutoApproveRules",
            "eventCategories",
            "autoApproveLimit",
            "manualReviewLimit",
            "allowNewMerchant",
          ],
        },
      },
    });

    const raw = response.text;
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const allowedCategories = normalizeCategoryList(
      parsed.allowedCategories,
      fallback.allowedCategories
    );
    const autoApproveLimit = Math.max(
      10000,
      Math.round(Number(parsed.autoApproveLimit) || fallback.autoApproveLimit)
    );
    const manualReviewLimit = Math.max(
      autoApproveLimit,
      Math.round(Number(parsed.manualReviewLimit) || fallback.manualReviewLimit)
    );
    const blockedCategories = [
      ...new Set([
        ...DEFAULT_BLOCKED_CATEGORIES,
        ...normalizeCategoryList(parsed.blockedCategories, fallback.blockedCategories),
      ]),
    ];

    const aiDraft: AiPolicyDraft = {
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName.trim()
          : "AI 정책",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : fallback.summary,
      policySource: "AI",
      aiConfidence: Math.max(
        0,
        Math.min(1, Number(parsed.aiConfidence) || fallback.aiConfidence)
      ),
      templateKey: "ai-generated",
      allowedCategories,
      blockedCategories,
      blockedKeywords: [
        ...new Set([
          ...DEFAULT_BLOCKED_KEYWORDS,
          ...normalizeKeywordList(parsed.blockedKeywords, fallback.blockedKeywords),
        ]),
      ],
      allowedKeywords: normalizeKeywordList(
        parsed.allowedKeywords,
        fallback.allowedKeywords
      ),
      categoryAutoApproveRules: normalizeCategoryRules(
        parsed.categoryAutoApproveRules,
        allowedCategories,
        autoApproveLimit
      ),
      eventCategories: normalizeCategoryList(
        parsed.eventCategories,
        fallback.eventCategories
      ).filter((category) => allowedCategories.includes(category)),
      autoApproveLimit,
      manualReviewLimit,
      allowNewMerchant:
        typeof parsed.allowNewMerchant === "boolean"
          ? parsed.allowNewMerchant
          : fallback.allowNewMerchant,
      quietHoursStart:
        Number.isInteger(parsed.quietHoursStart) && Number(parsed.quietHoursStart) >= 0
          ? Number(parsed.quietHoursStart)
          : fallback.quietHoursStart,
      quietHoursEnd:
        Number.isInteger(parsed.quietHoursEnd) && Number(parsed.quietHoursEnd) >= 0
          ? Number(parsed.quietHoursEnd)
          : fallback.quietHoursEnd,
    };

    return applySensitiveCategoryOverrides(aiDraft, `${input.name} ${input.purpose}`.toLowerCase());
  } catch (error) {
    console.error("[AI Policy] Gemini Error:", error);
    return fallback;
  }
}
