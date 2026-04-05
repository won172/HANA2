"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCategoryLabel } from "@/lib/categoryLabels";
import { parseJsonResponse } from "@/lib/fetchJson";

type Budget = {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  status: string;
  organization: { name: string };
  organizationId: string;
};

type BudgetPolicyDetail = Budget & {
  validFrom: string;
  validUntil: string;
  policy: {
    displayName: string | null;
    summary: string | null;
    allowedCategories: string;
    blockedCategories: string;
    blockedKeywords: string;
    allowedKeywords: string;
    categoryAutoApproveRules: string;
    eventCategories: string;
    autoApproveLimit: number;
    manualReviewLimit: number;
    allowNewMerchant: boolean;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    eventWindowStart: string | null;
    eventWindowEnd: string | null;
  } | null;
};

type PolicyResultType = {
  status: string;
  reason: string;
};

type AiAnalysis = {
  category: { suggestedCategory: string; confidence: number };
  risk: { riskScore: number; riskLevel: string; explanation: string };
  available: boolean;
};

type ResultType = {
  transaction: {
    id: string;
    merchantName: string;
    amount: number;
    status: string;
  };
  policyResult: PolicyResultType;
  aiAnalysis?: AiAnalysis;
};

type PreviewTone = "ok" | "info" | "warn" | "block";

type PreviewSummary = {
  tone: PreviewTone;
  title: string;
  items: string[];
};

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

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("ko-KR");
}

function parsePolicyList(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parsePolicyRecord(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, number>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, number>>(
      (accumulator, [key, rawValue]) => {
        if (typeof rawValue === "number") {
          accumulator[key] = rawValue;
        }
        return accumulator;
      },
      {}
    );
  } catch {
    return {};
  }
}

function isWithinQuietHours(
  currentHour: number,
  startHour: number | null,
  endHour: number | null
) {
  if (startHour === null || endHour === null || startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }

  return currentHour >= startHour || currentHour < endHour;
}

function buildPreviewSummary(input: {
  budget: BudgetPolicyDetail | null;
  amount: number;
  merchantName: string;
  category: string;
  description: string;
}): PreviewSummary {
  const { budget, amount, merchantName, category, description } = input;

  if (!budget || !budget.policy) {
    return {
      tone: "info",
      title: "정책 정보를 불러오는 중입니다.",
      items: ["예산 정책이 준비되면 예상 판정을 보여줍니다."],
    };
  }

  const missingFields: string[] = [];
  if (!merchantName.trim()) {
    missingFields.push("가맹점명");
  }
  if (amount <= 0) {
    missingFields.push("결제 금액");
  }
  if (!category) {
    missingFields.push("카테고리");
  }
  if (!description.trim()) {
    missingFields.push("품목 설명");
  }

  if (missingFields.length > 0) {
    return {
      tone: "info",
      title: "입력을 마치면 예상 판정을 보여줍니다.",
      items: [`필수 입력: ${missingFields.join(", ")}`],
    };
  }

  const now = new Date();
  const upperCategory = category.toUpperCase();
  const blockedCategories = parsePolicyList(budget.policy.blockedCategories);
  const allowedCategories = parsePolicyList(budget.policy.allowedCategories);
  const blockedKeywords = parsePolicyList(budget.policy.blockedKeywords);
  const allowedKeywords = parsePolicyList(budget.policy.allowedKeywords);
  const eventCategories = parsePolicyList(budget.policy.eventCategories);
  const categoryAutoApproveRules = parsePolicyRecord(
    budget.policy.categoryAutoApproveRules
  );
  const autoApproveLimit =
    categoryAutoApproveRules[upperCategory] ?? budget.policy.autoApproveLimit;

  const searchableText = `${merchantName} ${description}`.toLowerCase();
  const blockedKeyword = blockedKeywords.find((keyword) =>
    searchableText.includes(keyword.toLowerCase())
  );
  const allowedKeyword = allowedKeywords.find((keyword) =>
    searchableText.includes(keyword.toLowerCase())
  );

  const blockItems: string[] = [];
  const warnItems: string[] = [];
  const infoItems: string[] = [];

  if (budget.status === "EXPIRED" || budget.status === "RECALLED") {
    blockItems.push("이 예산은 이미 만료되었거나 환수 처리되었습니다.");
  }

  if (now < new Date(budget.validFrom)) {
    blockItems.push("예산 시작일 이전이라 집행할 수 없습니다.");
  }

  if (now > new Date(budget.validUntil)) {
    blockItems.push("예산 유효기간이 지나 집행할 수 없습니다.");
  }

  if (amount > budget.currentBalance) {
    blockItems.push(
      `잔액 부족입니다. 요청 ${fmt(amount)}원 / 잔액 ${fmt(
        budget.currentBalance
      )}원`
    );
  }

  if (blockedCategories.includes(upperCategory)) {
    blockItems.push(`선택한 카테고리 ${getCategoryLabel(category)}는 금지 대상입니다.`);
  }

  if (blockedKeyword && !allowedKeyword) {
    blockItems.push(`금지 키워드 "${blockedKeyword}"가 감지되었습니다.`);
  }

  if (blockedKeyword && allowedKeyword) {
    warnItems.push(
      `금지 키워드 "${blockedKeyword}"와 허용 키워드 "${allowedKeyword}"가 함께 감지되어 검토가 필요합니다.`
    );
  }

  if (
    allowedCategories.length > 0 &&
    !allowedCategories.includes(upperCategory)
  ) {
    warnItems.push(
      `선택한 카테고리 ${getCategoryLabel(category)}는 기본 허용 목록에 없습니다.`
    );
  }

  if (amount > budget.policy.manualReviewLimit) {
    warnItems.push(
      `수동 검토 기준 ${fmt(
        budget.policy.manualReviewLimit
      )}원을 초과했습니다.`
    );
  }

  if (
    isWithinQuietHours(
      now.getHours(),
      budget.policy.quietHoursStart,
      budget.policy.quietHoursEnd
    )
  ) {
    warnItems.push("현재는 제한 시간대여서 검토 대상으로 넘어갈 수 있습니다.");
  }

  if (
    eventCategories.includes(upperCategory) &&
    budget.policy.eventWindowStart &&
    budget.policy.eventWindowEnd
  ) {
    const eventStart = new Date(budget.policy.eventWindowStart);
    const eventEnd = new Date(budget.policy.eventWindowEnd);
    if (now < eventStart || now > eventEnd) {
      warnItems.push(
        `행사 카테고리는 ${fmtDate(
          budget.policy.eventWindowStart
        )} ~ ${fmtDate(budget.policy.eventWindowEnd)} 안에서만 집행 가능합니다.`
      );
    }
  }

  if (amount > autoApproveLimit && amount <= budget.policy.manualReviewLimit) {
    infoItems.push(
      `${getCategoryLabel(category)} 카테고리 기준 자동 승인 한도 ${fmt(
        autoApproveLimit
      )}원을 넘어 관리자 알림이 발생할 수 있습니다.`
    );
  }

  if (!budget.policy.allowNewMerchant) {
    infoItems.push("신규 가맹점이면 검토 대상으로 전환될 수 있습니다.");
  }

  if (blockItems.length > 0) {
    return {
      tone: "block",
      title: "현재 입력 기준 즉시 거절 가능성이 큽니다.",
      items: [...blockItems, ...warnItems, ...infoItems],
    };
  }

  if (warnItems.length > 0) {
    return {
      tone: "warn",
      title: "현재 입력 기준 검토 대상으로 넘어갈 수 있습니다.",
      items: [...warnItems, ...infoItems],
    };
  }

  if (infoItems.length > 0) {
    return {
      tone: "info",
      title: "현재 입력 기준 승인 후 알림 가능성이 있습니다.",
      items: infoItems,
    };
  }

  return {
    tone: "ok",
    title: "현재 입력 기준 정상 승인 가능성이 큽니다.",
    items: ["예산 잔액, 카테고리, 금액 기준이 모두 정책 범위 안에 있습니다."],
  };
}

export default function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ budgetId?: string; org?: string }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const requestedBudgetId =
    typeof resolvedSearchParams.budgetId === "string"
      ? resolvedSearchParams.budgetId
      : "";
  const requestedOrgId =
    typeof resolvedSearchParams.org === "string" ? resolvedSearchParams.org : "";

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetDetail, setBudgetDetail] = useState<BudgetPolicyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [result, setResult] = useState<ResultType | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [allowBudgetSwitch, setAllowBudgetSwitch] = useState(!requestedBudgetId);

  const [budgetId, setBudgetId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadBudgets() {
      try {
        const response = await fetch("/api/budgets");
        const data = await parseJsonResponse<Budget[]>(response);
        const active = data.filter((budget) => budget.status === "ACTIVE");

        if (!isMounted) {
          return;
        }

        setBudgets(active);

        if (requestedBudgetId) {
          const requestedBudget = active.find((budget) => budget.id === requestedBudgetId);
          setBudgetId(requestedBudget?.id || active[0]?.id || "");
          setAllowBudgetSwitch(!requestedBudget);
          return;
        }

        setBudgetId(active[0]?.id || "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBudgets([]);
        setSubmitError(
          error instanceof Error ? error.message : "예산 목록을 불러오지 못했습니다."
        );
      }
    }

    void loadBudgets();

    return () => {
      isMounted = false;
    };
  }, [requestedBudgetId]);

  useEffect(() => {
    let isMounted = true;

    async function loadBudgetDetail(targetBudgetId: string) {
      if (!targetBudgetId) {
        setBudgetDetail(null);
        setDetailError("");
        return;
      }

      setDetailLoading(true);

      try {
        const response = await fetch(`/api/budgets/${targetBudgetId}`);
        const data = await parseJsonResponse<BudgetPolicyDetail>(response);

        if (!isMounted) {
          return;
        }

        setBudgetDetail(data);
        setDetailError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBudgetDetail(null);
        setDetailError(
          error instanceof Error ? error.message : "예산 정책 정보를 불러오지 못했습니다."
        );
      } finally {
        if (isMounted) {
          setDetailLoading(false);
        }
      }
    }

    void loadBudgetDetail(budgetId);

    return () => {
      isMounted = false;
    };
  }, [budgetId]);

  const selectedBudget = budgets.find((budget) => budget.id === budgetId) || null;
  const previewSummary = useMemo(
    () =>
      buildPreviewSummary({
        budget: budgetDetail,
        amount,
        merchantName,
        category,
        description,
      }),
    [amount, budgetDetail, category, description, merchantName]
  );

  const handleSubmit = async () => {
    if (!budgetId || !merchantName.trim() || !description.trim() || !category || amount <= 0) {
      setSubmitError("예산, 가맹점명, 금액, 카테고리, 품목 설명을 모두 입력하세요.");
      return;
    }

    setLoading(true);
    setResult(null);
    setSubmitError("");

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetId,
          merchantName: merchantName.trim(),
          amount,
          requestedCategory: category,
          itemDescription: description.trim(),
        }),
      });

      const data = await parseJsonResponse<ResultType>(response);
      setResult(data);

      const budgetsResponse = await fetch("/api/budgets");
      const updatedBudgets = await parseJsonResponse<Budget[]>(budgetsResponse);
      setBudgets(updatedBudgets.filter((budget) => budget.status === "ACTIVE"));

      const detailResponse = await fetch(`/api/budgets/${budgetId}`);
      const updatedDetail = await parseJsonResponse<BudgetPolicyDetail>(detailResponse);
      setBudgetDetail(updatedDetail);
      setDetailError("");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "결제 요청을 처리하지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const previewToneClass: Record<PreviewTone, string> = {
    ok: "border-emerald-200 bg-emerald-50",
    info: "border-blue-200 bg-blue-50",
    warn: "border-amber-200 bg-amber-50",
    block: "border-red-200 bg-red-50",
  };

  return (
    <SidebarLayout userName="POS단말기" userRole="가맹점/결제 단말">
      <div className="max-w-5xl p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {requestedBudgetId && selectedBudget && (
              <Link
                href={`/club/budgets/${selectedBudget.id}?org=${
                  requestedOrgId || selectedBudget.organizationId
                }`}
                className="mb-2 inline-flex text-sm text-gray-500 hover:text-gray-800"
              >
                ← 예산 상세로 돌아가기
              </Link>
            )}
            <div className="mb-2 inline-flex rounded-full bg-[#E8F7F4] px-2.5 py-1 text-[11px] font-medium text-[#006B5D]">
              정상 집행
            </div>
            <h1 className="text-2xl font-bold text-gray-900">POS 결제 요청</h1>
            <p className="text-sm text-gray-500">
              예산 상세에서 넘어온 흐름을 기준으로, 이 화면에서 실제 결제 입력과 정책
              판정을 진행합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-gray-200">
            <CardContent className="p-6">
              <div className="mb-4">
                <h2 className="font-semibold text-gray-900">결제 입력</h2>
                <p className="text-sm text-gray-500">
                  입력 중인 내용은 오른쪽에서 정책 기준으로 바로 확인할 수 있습니다.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-700">예산</Label>
                  {requestedBudgetId && selectedBudget && !allowBudgetSwitch ? (
                    <div className="mt-1 rounded-xl border border-[#D5E2DE] bg-[#F7FBFA] p-3">
                      <div className="font-medium text-gray-900">{selectedBudget.name}</div>
                      <div className="text-xs text-gray-500">
                        {selectedBudget.organization.name} · 잔액 {fmt(selectedBudget.currentBalance)}
                        원
                      </div>
                      <button
                        type="button"
                        onClick={() => setAllowBudgetSwitch(true)}
                        className="mt-2 text-xs font-medium text-[#006B5D] underline underline-offset-2"
                      >
                        다른 예산 선택
                      </button>
                    </div>
                  ) : (
                    <select
                      value={budgetId}
                      onChange={(event) => setBudgetId(event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                    >
                      <option value="">예산을 선택하세요</option>
                      {budgets.map((budget) => (
                        <option key={budget.id} value={budget.id}>
                          {budget.name} ({budget.organization.name}) · 잔액 {fmt(
                            budget.currentBalance
                          )}
                          원
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <Label className="text-sm text-gray-700">가맹점명</Label>
                  <Input
                    value={merchantName}
                    onChange={(event) => setMerchantName(event.target.value)}
                    placeholder="예: 카페베네, 문구사랑"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-700">결제 금액 (원)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={amount || ""}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    placeholder="금액을 입력하세요"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-700">카테고리</Label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                  >
                    <option value="">카테고리를 선택하세요</option>
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {getCategoryLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm text-gray-700">상품/서비스 설명</Label>
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="예: 회의 다과 구매"
                    className="mt-1"
                  />
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {submitError}
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full cursor-pointer bg-[#00857A] text-white hover:bg-[#006B5D]"
                >
                  {loading ? "처리 중..." : "결제 요청 보내기"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedBudget && (
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      선택된 예산 정보
                    </h3>
                    {budgetDetail && (
                      <span className="text-xs text-gray-400">
                        {fmtDate(budgetDetail.validFrom)} ~{" "}
                        {fmtDate(budgetDetail.validUntil)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">예산명</span>
                      <span className="font-medium">{selectedBudget.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">조직</span>
                      <span>{selectedBudget.organization.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">총 발행액</span>
                      <span>{fmt(selectedBudget.totalAmount)}원</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">현재 잔액</span>
                      <span className="font-bold text-[#006B5D]">
                        {fmt(selectedBudget.currentBalance)}원
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className={`border ${previewToneClass[previewSummary.tone]}`}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">정책 체크 예상</h3>
                    <div className="text-xs text-gray-500">
                      결제 전 단계에서 확인 가능한 기준만 먼저 보여줍니다.
                    </div>
                  </div>
                  {budgetDetail?.policy?.displayName && (
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-gray-600">
                      {budgetDetail.policy.displayName}
                    </span>
                  )}
                </div>

                {detailLoading ? (
                  <div className="text-sm text-gray-500">정책 정보를 불러오는 중...</div>
                ) : detailError ? (
                  <div className="text-sm text-red-600">{detailError}</div>
                ) : (
                  <>
                    <div className="mb-3 font-medium text-gray-900">
                      {previewSummary.title}
                    </div>
                    <div className="space-y-2">
                      {previewSummary.items.map((item) => (
                        <div
                          key={item}
                          className="rounded-lg bg-white/70 px-3 py-2 text-sm text-gray-700"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      실제 승인, 보류, 거절 결정은 결제 요청 시 정책 엔진이 최종 판정합니다.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {result && result.policyResult && result.transaction && (
              <Card
                className={`border-2 ${
                  result.policyResult.status === "APPROVED"
                    ? "border-emerald-300 bg-emerald-50"
                    : result.policyResult.status === "NOTIFIED"
                      ? "border-blue-300 bg-blue-50"
                      : result.policyResult.status === "PENDING"
                        ? "border-amber-300 bg-amber-50"
                        : "border-red-300 bg-red-50"
                }`}
              >
                <CardContent className="p-5">
                  <div className="text-center mb-3">
                    <StatusBadge status={result.policyResult.status} />
                  </div>

                  <div className="text-center mb-3">
                    <div className="text-lg font-bold text-gray-900">
                      {fmt(result.transaction.amount)}원
                    </div>
                    <div className="text-sm text-gray-600">
                      {result.transaction.merchantName}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/70 p-3 text-sm text-gray-700">
                    <div className="mb-1 text-xs font-medium text-gray-500">판정 사유</div>
                    {result.policyResult.reason}
                  </div>
                </CardContent>
              </Card>
            )}

            {result?.aiAnalysis && (
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-700">AI 분석</h3>
                    {result.aiAnalysis.available ? (
                      <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                        활성
                      </span>
                    ) : (
                      <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        비활성
                      </span>
                    )}
                  </div>

                  {result.aiAnalysis.available ? (
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                          <span>리스크 점수</span>
                          <span
                            className={`font-bold ${
                              result.aiAnalysis.risk?.riskLevel === "HIGH"
                                ? "text-red-600"
                                : result.aiAnalysis.risk?.riskLevel === "MEDIUM"
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }`}
                          >
                            {result.aiAnalysis.risk?.riskScore}/100 (
                            {result.aiAnalysis.risk?.riskLevel})
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              result.aiAnalysis.risk?.riskLevel === "HIGH"
                                ? "bg-red-400"
                                : result.aiAnalysis.risk?.riskLevel === "MEDIUM"
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                            }`}
                            style={{ width: `${result.aiAnalysis.risk?.riskScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">추천 카테고리</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">
                            {getCategoryLabel(
                              result.aiAnalysis.category?.suggestedCategory || ""
                            )}
                          </span>
                          <span className="text-gray-400">
                            (신뢰도{" "}
                            {result.aiAnalysis.category?.confidence !== undefined
                              ? Math.round(result.aiAnalysis.category.confidence * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-600">
                        {result.aiAnalysis.risk?.explanation}
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-gray-400">
                      AI 분석이 비활성화되어 있습니다.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                  빠른 시뮬레이션
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setMerchantName("문구사랑");
                      setAmount(30000);
                      setCategory("SUPPLIES");
                      setDescription("A4 용지 구매");
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
                  >
                    Level A: 정상 소액 결제
                  </button>
                  <button
                    onClick={() => {
                      setMerchantName("문구사랑");
                      setAmount(80000);
                      setCategory("SUPPLIES");
                      setDescription("대형 현수막 제작");
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
                  >
                    Level B: 승인 후 관리자 알림
                  </button>
                  <button
                    onClick={() => {
                      setMerchantName("새가맹점");
                      setAmount(45000);
                      setCategory("FOOD");
                      setDescription("식비 결제");
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
                  >
                    Level C: 신규 가맹점 검토
                  </button>
                  <button
                    onClick={() => {
                      setMerchantName("편의점");
                      setAmount(15000);
                      setCategory("FOOD");
                      setDescription("주류 구매");
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
                  >
                    Level D: 금지 키워드 거절
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
