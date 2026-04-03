/**
 * AI 분석 서비스
 *
 * Google Gemini (gemini-2.5-flash)를 사용하여 거래 분석을 수행합니다.
 * - 카테고리 자동 추천
 * - 리스크 스코어 계산
 * - 종합 분석 설명
 *
 * API 키가 없으면 graceful fallback (stub 동작)
 */

import { GoogleGenAI, Type } from "@google/genai";

// ─── Types ───────────────────────────────────────────────

export type AiCategoryResult = {
  suggestedCategory: string;
  confidence: number;
};

export type AiRiskResult = {
  riskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
};

export type AiAnalysisResult = {
  category: AiCategoryResult;
  risk: AiRiskResult;
  available: boolean; // AI 분석 실행 여부
};

// ─── Gemini Client ───────────────────────────────────────

const CATEGORIES = [
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
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// ─── Fallback (stub) ─────────────────────────────────────

function fallbackResult(): AiAnalysisResult {
  return {
    category: { suggestedCategory: "OTHER", confidence: 0 },
    risk: {
      riskScore: 0,
      riskLevel: "LOW",
      explanation: "AI 분석 미적용 (API 키 미설정)",
    },
    available: false,
  };
}

// ─── Main: 통합 분석 (단일 API 호출) ─────────────────────

export async function analyzeTransaction(
  merchantName: string,
  amount: number,
  requestedCategory: string,
  itemDescription: string,
  policyContext: {
    allowedCategories: string[];
    blockedCategories: string[];
    blockedKeywords: string[];
    autoApproveLimit: number;
  }
): Promise<AiAnalysisResult> {
  const ai = getGeminiClient();
  if (!ai) return fallbackResult();

  const prompt = `당신은 학생회/동아리 예산 집행 감사 AI입니다.
아래 거래를 분석하여 응답을 작성하세요.

## 거래 정보
- 가맹점: ${merchantName}
- 금액: ${amount.toLocaleString()}원
- 요청 카테고리: ${requestedCategory}
- 설명: ${itemDescription}

## 정책 컨텍스트
- 허용 카테고리: ${policyContext.allowedCategories.join(", ") || "제한 없음"}
- 금지 카테고리: ${policyContext.blockedCategories.join(", ") || "없음"}
- 금지 키워드: ${policyContext.blockedKeywords.join(", ") || "없음"}
- 자동승인 한도: ${policyContext.autoApproveLimit.toLocaleString()}원

## 분석 지침
1. **카테고리 추천**: 가맹점과 설명을 기반으로 가장 적절한 카테고리를 하나만 선택하세요. 가능한 카테고리는 다음과 같습니다: ${CATEGORIES.join(", ")}
2. **신뢰도**: 선택한 카테고리에 대한 신뢰도(0.0에서 1.0 사이의 숫자)
3. **리스크 점수**: 0~100 점 (0=완전 안전, 100=매우 위험/금지사항)
4. **리스크 레벨**: LOW(0-30), MEDIUM(31-60), HIGH(61-100)
5. **분석 설명**: 왜 그런 점수를 주었는지에 대해 한국어로 2-3문장으로 간결하게 설명하세요. 리스크 판정 기준: 금지 카테고리/키워드에 해당하면 HIGH, 카테고리가 이상하거나 금액이 비정상적으로 크면 MEDIUM, 일상적인 집행이면 LOW.`;

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
            suggestedCategory: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            riskScore: { type: Type.NUMBER },
            riskLevel: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["suggestedCategory", "confidence", "riskScore", "riskLevel", "explanation"],
        },
      },
    });

    const content = response.text;
    if (!content) return fallbackResult();

    const parsed = JSON.parse(content);

    // Validate and sanitize
    const suggestedCategory = CATEGORIES.includes(parsed.suggestedCategory)
      ? parsed.suggestedCategory
      : requestedCategory;

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const riskScore = Math.max(0, Math.min(100, Math.round(Number(parsed.riskScore) || 0)));

    let riskLevel: "LOW" | "MEDIUM" | "HIGH";
    if (riskScore >= 61) riskLevel = "HIGH";
    else if (riskScore >= 31) riskLevel = "MEDIUM";
    else riskLevel = "LOW";

    return {
      category: { suggestedCategory, confidence },
      risk: {
        riskScore,
        riskLevel,
        explanation: parsed.explanation || "AI 분석 완료",
      },
      available: true,
    };
  } catch (error) {
    console.error("[AI Service] Gemini Error:", error);
    return {
      ...fallbackResult(),
      risk: {
        riskScore: 0,
        riskLevel: "LOW",
        explanation: `AI 분석 오류 발생 (fallback 모드)`,
      },
    };
  }
}

// ─── 개별 함수 (하위 호환) ────────────────────────────────

export async function suggestCategory(
  merchantName: string,
  itemDescription: string
): Promise<AiCategoryResult> {
  const result = await analyzeTransaction(
    merchantName,
    0,
    "OTHER",
    itemDescription,
    {
      allowedCategories: [],
      blockedCategories: [],
      blockedKeywords: [],
      autoApproveLimit: 50000,
    }
  );
  return result.category;
}

export async function calculateRiskScore(
  merchantName: string,
  amount: number,
  category: string,
  itemDescription: string
): Promise<AiRiskResult> {
  const result = await analyzeTransaction(
    merchantName,
    amount,
    category,
    itemDescription,
    {
      allowedCategories: [],
      blockedCategories: [],
      blockedKeywords: [],
      autoApproveLimit: 50000,
    }
  );
  return result.risk;
}
