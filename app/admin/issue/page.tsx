"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALL_BUDGET_CATEGORIES,
  formatCategoryList,
  getCategoryLabel,
} from "@/lib/categoryLabels";
import { parseJsonResponse } from "@/lib/fetchJson";

type Organization = {
  id: string;
  name: string;
  type: string;
};

type AiPolicyDraft = {
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

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function formatHourRange(start: number | null, end: number | null) {
  if (start === null || end === null) {
    return "설정 없음";
  }

  return `${String(start).padStart(2, "0")}:00 ~ ${String(end).padStart(2, "0")}:00`;
}

function normalizeTextList(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

function sanitizeHour(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const normalized = Math.round(Number(value));
  if (normalized < 0 || normalized > 23) {
    return null;
  }

  return normalized;
}

function sanitizePolicyDraft(draft: AiPolicyDraft): AiPolicyDraft {
  const allowedCategories = [...new Set(draft.allowedCategories)].filter((category) =>
    ALL_BUDGET_CATEGORIES.includes(category as (typeof ALL_BUDGET_CATEGORIES)[number])
  );
  const normalizedAllowedCategories =
    allowedCategories.length > 0 ? allowedCategories : ["OTHER"];
  const blockedCategories = [...new Set(draft.blockedCategories)]
    .filter((category) =>
      ALL_BUDGET_CATEGORIES.includes(category as (typeof ALL_BUDGET_CATEGORIES)[number])
    )
    .filter((category) => !normalizedAllowedCategories.includes(category));
  const eventCategories = [...new Set(draft.eventCategories)].filter(
    (category) =>
      normalizedAllowedCategories.includes(category) && !blockedCategories.includes(category)
  );
  const autoApproveLimit = Math.max(1000, Math.round(Number(draft.autoApproveLimit) || 0));
  const manualReviewLimit = Math.max(
    autoApproveLimit,
    Math.round(Number(draft.manualReviewLimit) || 0)
  );
  const categoryAutoApproveRules = Object.entries(draft.categoryAutoApproveRules).reduce<
    Record<string, number>
  >((accumulator, [category, limit]) => {
    if (!normalizedAllowedCategories.includes(category)) {
      return accumulator;
    }

    const normalizedLimit = Math.max(1000, Math.round(Number(limit) || 0));
    if (normalizedLimit > 0) {
      accumulator[category] = normalizedLimit;
    }

    return accumulator;
  }, {});

  return {
    ...draft,
    displayName: draft.displayName || "AI 정책",
    summary: draft.summary.trim(),
    allowedCategories: normalizedAllowedCategories,
    blockedCategories,
    blockedKeywords: normalizeTextList(draft.blockedKeywords.join(", ")),
    allowedKeywords: normalizeTextList(draft.allowedKeywords.join(", ")),
    eventCategories,
    autoApproveLimit,
    manualReviewLimit,
    categoryAutoApproveRules,
    quietHoursStart: sanitizeHour(draft.quietHoursStart),
    quietHoursEnd: sanitizeHour(draft.quietHoursEnd),
  };
}

export default function IssueBudgetPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [policyDraft, setPolicyDraft] = useState<AiPolicyDraft | null>(null);

  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [totalAmount, setTotalAmount] = useState(500000);
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validUntil, setValidUntil] = useState("");
  const isBaseInfoValid =
    Boolean(organizationId) &&
    Boolean(name.trim()) &&
    totalAmount > 0 &&
    Boolean(validFrom) &&
    Boolean(validUntil) &&
    validFrom <= validUntil;

  useEffect(() => {
    fetch("/api/organizations")
      .then((response) =>
        parseJsonResponse<Array<{ id: string; name: string; type: string }>>(response)
      )
      .then((data) => {
        const clubs = data.filter((organization) => organization.type === "CLUB");
        setOrganizations(clubs);
        setOrganizationId(clubs[0]?.id || "");
      })
      .catch(() => {
        setOrganizations([]);
      });
  }, []);

  function invalidatePolicyDraft() {
    setPolicyDraft(null);
    setPolicyError("");
  }

  function updatePolicyDraft<K extends keyof AiPolicyDraft>(field: K, value: AiPolicyDraft[K]) {
    setPolicyDraft((previous) => {
      if (!previous) {
        return previous;
      }

      return sanitizePolicyDraft({
        ...previous,
        [field]: value,
      });
    });
  }

  function togglePolicyCategory(
    field: "allowedCategories" | "blockedCategories" | "eventCategories",
    category: string
  ) {
    setPolicyDraft((previous) => {
      if (!previous) {
        return previous;
      }

      const current = previous[field];
      const active = current.includes(category);
      const nextValues = active
        ? current.filter((item) => item !== category)
        : [...current, category];

      const nextDraft: AiPolicyDraft = {
        ...previous,
        [field]: nextValues,
      };

      if (field === "allowedCategories") {
        nextDraft.blockedCategories = previous.blockedCategories.filter(
          (item) => !nextValues.includes(item)
        );
        nextDraft.eventCategories = previous.eventCategories.filter((item) =>
          nextValues.includes(item)
        );
        nextDraft.categoryAutoApproveRules = Object.fromEntries(
          Object.entries(previous.categoryAutoApproveRules).filter(([item]) =>
            nextValues.includes(item)
          )
        );
      }

      if (field === "blockedCategories" && !active) {
        nextDraft.allowedCategories = previous.allowedCategories.filter((item) => item !== category);
        nextDraft.eventCategories = previous.eventCategories.filter((item) => item !== category);
        nextDraft.categoryAutoApproveRules = Object.fromEntries(
          Object.entries(previous.categoryAutoApproveRules).filter(([item]) => item !== category)
        );
      }

      if (field === "eventCategories" && !previous.allowedCategories.includes(category)) {
        nextDraft.allowedCategories = [...previous.allowedCategories, category];
      }

      return sanitizePolicyDraft(nextDraft);
    });
  }

  async function handleGeneratePolicy() {
    setPolicyError("");

    if (!name.trim() || !validFrom || !validUntil || totalAmount <= 0) {
      setPolicyError("예산명, 금액, 유효기간을 먼저 입력하세요.");
      return;
    }

    if (validFrom > validUntil) {
      setPolicyError("만료일은 유효 시작일보다 빠를 수 없습니다.");
      return;
    }

    setPolicyLoading(true);

    try {
      const response = await fetch("/api/ai-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          purpose,
          totalAmount,
          validFrom,
          validUntil,
        }),
      });

      const result = await parseJsonResponse<AiPolicyDraft>(response);
      setPolicyDraft(sanitizePolicyDraft(result));
    } catch (error) {
      setPolicyDraft(null);
      setPolicyError(
        error instanceof Error ? error.message : "AI 정책 생성에 실패했습니다."
      );
    } finally {
      setPolicyLoading(false);
    }
  }

  async function handleSubmit() {
    if (!organizationId || !name.trim() || !validUntil) {
      alert("필수 항목을 모두 입력하세요.");
      return;
    }

    if (!policyDraft) {
      alert("먼저 AI 정책 설정을 실행하세요.");
      return;
    }

    if (validFrom > validUntil) {
      alert("만료일은 유효 시작일보다 빠를 수 없습니다.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          totalAmount,
          validFrom,
          validUntil,
          organizationId,
          issuerOrganizationId: "org-issuer",
          policy: sanitizePolicyDraft(policyDraft),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "예산 발행에 실패했습니다.");
        return;
      }

      router.push("/admin");
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">예산 발행</h1>
          <p className="text-sm text-gray-500">
            예산명과 내용을 간략히 입력한 뒤 `AI 정책 설정`을 누르면 AI가 이 예산에
            맞는 집행 정책을 직접 구성합니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
          <Card className="border-[#E5E7EB] shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
            <CardContent className="p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">예산 기본 정보</h2>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-700">대상 조직</Label>
                  <select
                    value={organizationId}
                    onChange={(event) => {
                      setOrganizationId(event.target.value);
                      invalidatePolicyDraft();
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm text-gray-700">예산명</Label>
                  <Input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      invalidatePolicyDraft();
                    }}
                    placeholder="예: 5월 공개 세미나 운영 예산"
                    className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-700">예산 내용</Label>
                  <Textarea
                    value={purpose}
                    onChange={(event) => {
                      setPurpose(event.target.value);
                      invalidatePolicyDraft();
                    }}
                    placeholder="이 예산을 어디에 쓸지 간략히 작성하세요. 예: 외부 연사 세미나 진행을 위한 대관, 다과, 인쇄물 제작"
                    className="mt-1 min-h-28 border-[#D1D5DB]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-sm text-gray-700">총 금액</Label>
                    <Input
                      type="number"
                      value={totalAmount}
                      onChange={(event) => {
                        setTotalAmount(Number(event.target.value));
                        invalidatePolicyDraft();
                      }}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">유효 시작일</Label>
                    <Input
                      type="date"
                      value={validFrom}
                      onChange={(event) => {
                        setValidFrom(event.target.value);
                        invalidatePolicyDraft();
                      }}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">만료일</Label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(event) => {
                        setValidUntil(event.target.value);
                        invalidatePolicyDraft();
                      }}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleGeneratePolicy}
                  disabled={policyLoading}
                  className="h-11 w-full cursor-pointer rounded-xl bg-[#00857A] text-white hover:bg-[#006B5D]"
                >
                  {policyLoading ? "AI 정책 생성 중..." : "AI 정책 설정"}
                </Button>

                {policyError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {policyError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#D5E2DE] bg-[#F7FBFA]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F7F4] text-[#006B5D]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#006B5D]">
                    AI Policy
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-gray-900">
                    {policyDraft?.displayName || "AI 정책"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {policyDraft?.summary ||
                      "아직 정책이 생성되지 않았습니다. 왼쪽에서 기본 정보를 입력하고 AI 정책 설정을 실행하세요."}
                  </p>
                </div>
              </div>

              {policyDraft && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                      <div className="text-xs text-gray-500">AI 신뢰도</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {Math.round(policyDraft.aiConfidence * 100)}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                      <div className="text-xs text-gray-500">정책 소스</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {policyDraft.policySource}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                      <div className="text-xs text-gray-500">자동 승인 한도</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {fmt(policyDraft.autoApproveLimit)}원
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                      <div className="text-xs text-gray-500">수동 검토 기준</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {fmt(policyDraft.manualReviewLimit)}원
                      </div>
                    </div>
                  </div>

	                  <div>
	                    <div className="mb-2 text-xs font-medium text-gray-500">
	                      허용 카테고리
	                    </div>
	                    <div className="flex flex-wrap gap-2">
	                      {policyDraft.allowedCategories.map((category) => (
                        <span
	                          key={category}
	                          className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
	                        >
	                          {getCategoryLabel(category)}
	                        </span>
	                      ))}
	                    </div>
	                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium text-gray-500">
                      금지 카테고리
                    </div>
                    <div className="flex flex-wrap gap-2">
	                      {policyDraft.blockedCategories.map((category) => (
	                        <span
	                          key={category}
	                          className="rounded bg-red-50 px-2 py-1 text-xs text-red-600"
	                        >
	                          {getCategoryLabel(category)}
	                        </span>
	                      ))}
	                    </div>
	                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium text-gray-500">
                      금지 키워드
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {policyDraft.blockedKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded bg-red-50 px-2 py-1 text-xs text-red-600"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
	                    <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
	                      <div className="text-xs text-gray-500">행사 적용 카테고리</div>
	                      <div className="mt-1 text-sm font-medium text-gray-900">
	                        {formatCategoryList(policyDraft.eventCategories)}
	                      </div>
	                    </div>
                    <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                      <div className="text-xs text-gray-500">제한 시간대</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">
                        {formatHourRange(
                          policyDraft.quietHoursStart,
                          policyDraft.quietHoursEnd
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4 text-sm text-gray-700">
                    신규 가맹점은{" "}
	                    <span className="font-medium text-gray-900">
	                      {policyDraft.allowNewMerchant ? "허용" : "관리자 검토"}
	                    </span>
	                    입니다. 결제 시 정책 엔진은 이 AI 정책을 기준으로 승인, 보류,
	                    거절을 판정합니다.
	                  </div>

	                  <details className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
	                    <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
	                      세부 조정 직접 설정
	                    </summary>
	                    <p className="mt-2 text-xs leading-5 text-gray-500">
	                      AI가 만든 정책을 기본값으로 두고, 필요한 경우에만 사람이 한도와
	                      카테고리, 키워드를 조정합니다.
	                    </p>

	                    <div className="mt-4 space-y-5">
	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div>
	                          <Label className="text-sm text-gray-700">자동 승인 한도</Label>
	                          <Input
	                            type="number"
	                            value={policyDraft.autoApproveLimit}
	                            onChange={(event) =>
	                              updatePolicyDraft(
	                                "autoApproveLimit",
	                                Number(event.target.value)
	                              )
	                            }
	                            className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
	                          />
	                        </div>
	                        <div>
	                          <Label className="text-sm text-gray-700">수동 검토 기준</Label>
	                          <Input
	                            type="number"
	                            value={policyDraft.manualReviewLimit}
	                            onChange={(event) =>
	                              updatePolicyDraft(
	                                "manualReviewLimit",
	                                Number(event.target.value)
	                              )
	                            }
	                            className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
	                          />
	                        </div>
	                      </div>

	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div>
	                          <Label className="text-sm text-gray-700">제한 시작 시각</Label>
	                          <Input
	                            type="number"
	                            min={0}
	                            max={23}
	                            value={policyDraft.quietHoursStart ?? ""}
	                            onChange={(event) =>
	                              updatePolicyDraft(
	                                "quietHoursStart",
	                                event.target.value === ""
	                                  ? null
	                                  : Number(event.target.value)
	                              )
	                            }
	                            placeholder="예: 23"
	                            className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
	                          />
	                        </div>
	                        <div>
	                          <Label className="text-sm text-gray-700">제한 종료 시각</Label>
	                          <Input
	                            type="number"
	                            min={0}
	                            max={23}
	                            value={policyDraft.quietHoursEnd ?? ""}
	                            onChange={(event) =>
	                              updatePolicyDraft(
	                                "quietHoursEnd",
	                                event.target.value === ""
	                                  ? null
	                                  : Number(event.target.value)
	                              )
	                            }
	                            placeholder="예: 7"
	                            className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
	                          />
	                        </div>
	                      </div>

	                      <div>
	                        <div className="mb-2 text-sm font-medium text-gray-700">
	                          허용 카테고리
	                        </div>
	                        <div className="flex flex-wrap gap-2">
	                          {ALL_BUDGET_CATEGORIES.map((category) => {
	                            const active = policyDraft.allowedCategories.includes(category);
	                            return (
	                              <button
	                                key={`allowed-${category}`}
	                                type="button"
	                                onClick={() =>
	                                  togglePolicyCategory("allowedCategories", category)
	                                }
	                                className={`rounded-full border px-3 py-1.5 text-sm ${
	                                  active
	                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
	                                    : "border-gray-200 bg-white text-gray-600"
	                                }`}
	                              >
	                                {getCategoryLabel(category)}
	                              </button>
	                            );
	                          })}
	                        </div>
	                      </div>

	                      <div>
	                        <div className="mb-2 text-sm font-medium text-gray-700">
	                          금지 카테고리
	                        </div>
	                        <div className="flex flex-wrap gap-2">
	                          {ALL_BUDGET_CATEGORIES.map((category) => {
	                            const active = policyDraft.blockedCategories.includes(category);
	                            return (
	                              <button
	                                key={`blocked-${category}`}
	                                type="button"
	                                onClick={() =>
	                                  togglePolicyCategory("blockedCategories", category)
	                                }
	                                className={`rounded-full border px-3 py-1.5 text-sm ${
	                                  active
	                                    ? "border-red-200 bg-red-50 text-red-600"
	                                    : "border-gray-200 bg-white text-gray-600"
	                                }`}
	                              >
	                                {getCategoryLabel(category)}
	                              </button>
	                            );
	                          })}
	                        </div>
	                      </div>

	                      <div>
	                        <div className="mb-2 text-sm font-medium text-gray-700">
	                          행사 적용 카테고리
	                        </div>
	                        <div className="flex flex-wrap gap-2">
	                          {policyDraft.allowedCategories.map((category) => {
	                            const active = policyDraft.eventCategories.includes(category);
	                            return (
	                              <button
	                                key={`event-${category}`}
	                                type="button"
	                                onClick={() =>
	                                  togglePolicyCategory("eventCategories", category)
	                                }
	                                className={`rounded-full border px-3 py-1.5 text-sm ${
	                                  active
	                                    ? "border-[#A8D9D1] bg-[#E8F7F4] text-[#006B5D]"
	                                    : "border-gray-200 bg-white text-gray-600"
	                                }`}
	                              >
	                                {getCategoryLabel(category)}
	                              </button>
	                            );
	                          })}
	                        </div>
	                      </div>

	                      <div>
	                        <div className="mb-2 text-sm font-medium text-gray-700">
	                          카테고리별 자동 승인 한도
	                        </div>
	                        <div className="grid gap-3 md:grid-cols-2">
	                          {policyDraft.allowedCategories.map((category) => (
	                            <div key={`rule-${category}`}>
	                              <Label className="text-sm text-gray-700">
	                                {getCategoryLabel(category)}
	                              </Label>
	                              <Input
	                                type="number"
	                                value={
	                                  policyDraft.categoryAutoApproveRules[category] ??
	                                  policyDraft.autoApproveLimit
	                                }
	                                onChange={(event) =>
	                                  updatePolicyDraft("categoryAutoApproveRules", {
	                                    ...policyDraft.categoryAutoApproveRules,
	                                    [category]: Number(event.target.value),
	                                  })
	                                }
	                                className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
	                              />
	                            </div>
	                          ))}
	                        </div>
	                      </div>

	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div>
	                          <Label className="text-sm text-gray-700">허용 키워드</Label>
	                          <Textarea
	                            value={policyDraft.allowedKeywords.join(", ")}
	                            onChange={(event) =>
	                              updatePolicyDraft(
	                                "allowedKeywords",
	                                normalizeTextList(event.target.value)
	                              )
	                            }
	                            className="mt-1 min-h-24 border-[#D1D5DB]"
	                            placeholder="예: 세미나, 강연, 인쇄"
	                          />
	                        </div>
	                        <div>
	                          <Label className="text-sm text-gray-700">금지 키워드</Label>
	                          <Textarea
	                            value={policyDraft.blockedKeywords.join(", ")}
	                            onChange={(event) =>
	                              updatePolicyDraft(
	                                "blockedKeywords",
	                                normalizeTextList(event.target.value)
	                              )
	                            }
	                            className="mt-1 min-h-24 border-[#D1D5DB]"
	                            placeholder="예: 술, 담배, 게임"
	                          />
	                        </div>
	                      </div>

	                      <label className="flex items-center gap-3 rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] px-4 py-3 text-sm text-gray-700">
	                        <input
	                          type="checkbox"
	                          checked={policyDraft.allowNewMerchant}
	                          onChange={(event) =>
	                            updatePolicyDraft("allowNewMerchant", event.target.checked)
	                          }
	                          className="h-4 w-4 rounded border-gray-300 text-[#00857A] focus:ring-[#00857A]"
	                        />
	                        신규 가맹점 자동 허용
	                      </label>
	                    </div>
	                  </details>
	                </div>
	              )}
	            </CardContent>
	          </Card>
        </div>

        <Card className="mt-6 border-[#D5E2DE] bg-[#F7FBFA]">
          <CardContent className="p-5">
            <div className="mb-3 text-base font-semibold text-gray-900">발행 전 검토</div>
            <div className="grid gap-3 text-sm text-gray-700 md:grid-cols-2">
              <div className="rounded-xl bg-white px-4 py-3">
                기본 정보 입력:{" "}
                <span className="font-semibold text-gray-900">
                  {isBaseInfoValid ? "완료" : "확인 필요"}
                </span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3">
                AI 정책 생성:{" "}
                <span className="font-semibold text-gray-900">
                  {policyDraft ? "완료" : "아직 없음"}
                </span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3">
                자동 승인 한도: {fmt(policyDraft?.autoApproveLimit ?? 0)}원
              </div>
              <div className="rounded-xl bg-white px-4 py-3">
                수동 검토 기준: {fmt(policyDraft?.manualReviewLimit ?? 0)}원
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={loading || !policyDraft || !isBaseInfoValid}
          className="mt-6 h-11 w-full cursor-pointer rounded-xl bg-[#14332D] text-white hover:bg-[#0f2824]"
        >
          {loading ? "발행 중..." : "AI 정책으로 예산 발행"}
        </Button>
      </div>
    </SidebarLayout>
  );
}
