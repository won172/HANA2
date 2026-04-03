"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BudgetDetail = {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  validFrom: string;
  validUntil: string;
  status: string;
  organizationId: string;
  organization: { name: string };
  issuerOrganization: { name: string };
  policy: {
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
    templateKey: string | null;
  } | null;
  transactions: Array<{
    id: string;
    merchantName: string;
    itemDescription: string;
    requestedCategory: string;
    amount: number;
    status: string;
    reviewReason: string | null;
    additionalExplanation: string | null;
    adminComment: string | null;
    resubmissionCount: number;
    lastSubmittedAt: string | null;
    createdAt: string;
  }>;
  ledgerEntries: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
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

type TransactionRequestResult = {
  transaction: {
    id: string;
    merchantName: string;
    amount: number;
    status: string;
  };
  policyResult: PolicyResultType;
  aiAnalysis?: AiAnalysis;
};

type FollowUpForm = {
  merchantName: string;
  amount: number;
  requestedCategory: string;
  itemDescription: string;
  additionalExplanation: string;
};

const FALLBACK_CATEGORIES = [
  "FOOD",
  "SUPPLIES",
  "PRINT",
  "VENUE",
  "TRANSPORT",
  "DESIGN",
  "OTHER",
];

const TYPE_LABELS: Record<string, string> = {
  ISSUE: "발행",
  SPEND: "지출",
  REFUND: "환불",
  EXPIRE_RECALL: "만료환수",
};

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

function formatHourRange(start: number | null, end: number | null) {
  if (start === null || end === null) {
    return "설정 없음";
  }

  return `${String(start).padStart(2, "0")}:00 ~ ${String(end).padStart(2, "0")}:00`;
}

function getDaysUntil(date: string) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / msPerDay);
}

function buildFollowUpForm(
  transaction: BudgetDetail["transactions"][number]
): FollowUpForm {
  return {
    merchantName: transaction.merchantName,
    amount: transaction.amount,
    requestedCategory: transaction.requestedCategory,
    itemDescription: transaction.itemDescription,
    additionalExplanation: transaction.additionalExplanation || "",
  };
}

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestResult, setRequestResult] = useState<TransactionRequestResult | null>(
    null
  );
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState(30000);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [transactionForms, setTransactionForms] = useState<
    Record<string, FollowUpForm>
  >({});
  const [transactionProcessingId, setTransactionProcessingId] = useState<
    string | null
  >(null);
  const [transactionMessages, setTransactionMessages] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});

  async function refreshBudget() {
    const response = await fetch(`/api/budgets/${id}`);
    const data: BudgetDetail = await response.json();
    setBudget(data);
  }

  useEffect(() => {
    void refreshBudget();
  }, [id]);

  const policy = budget?.policy ?? null;
  const allowedCategories = useMemo(
    () => parsePolicyList(policy?.allowedCategories),
    [policy?.allowedCategories]
  );
  const blockedCategories = useMemo(
    () => parsePolicyList(policy?.blockedCategories),
    [policy?.blockedCategories]
  );
  const blockedKeywords = useMemo(
    () => parsePolicyList(policy?.blockedKeywords),
    [policy?.blockedKeywords]
  );
  const allowedKeywords = useMemo(
    () => parsePolicyList(policy?.allowedKeywords),
    [policy?.allowedKeywords]
  );
  const eventCategories = useMemo(
    () => parsePolicyList(policy?.eventCategories),
    [policy?.eventCategories]
  );
  const categoryAutoApproveRules = useMemo(
    () => parsePolicyRecord(policy?.categoryAutoApproveRules),
    [policy?.categoryAutoApproveRules]
  );
  const categoryRuleEntries = Object.entries(categoryAutoApproveRules);
  const requestCategories =
    allowedCategories.length > 0 ? allowedCategories : FALLBACK_CATEGORIES;

  useEffect(() => {
    if (!category && requestCategories.length > 0) {
      setCategory(requestCategories[0]);
    }
  }, [category, requestCategories]);

  if (!budget) {
    return (
      <SidebarLayout userName="동아리" userRole="동아리/학생회">
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      </SidebarLayout>
    );
  }

  const usedPercent =
    budget.totalAmount > 0
      ? Math.round(
          ((budget.totalAmount - budget.currentBalance) / budget.totalAmount) * 100
        )
      : 0;
  const daysUntilExpiry = getDaysUntil(budget.validUntil);
  const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 14;

  function getTransactionForm(
    transaction: BudgetDetail["transactions"][number]
  ): FollowUpForm {
    return transactionForms[transaction.id] || buildFollowUpForm(transaction);
  }

  function updateTransactionForm(
    transactionId: string,
    nextForm: Partial<FollowUpForm>,
    baseTransaction: BudgetDetail["transactions"][number]
  ) {
    const current = getTransactionForm(baseTransaction);
    setTransactionForms((previous) => ({
      ...previous,
      [transactionId]: {
        ...current,
        ...nextForm,
      },
    }));
  }

  async function handleSubmitRequest() {
    if (!budget) {
      return;
    }

    if (!merchantName.trim() || !description.trim() || !category) {
      setSubmitError("가맹점명, 카테고리, 품목/메모를 모두 입력하세요.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setRequestResult(null);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetId: budget.id,
          merchantName: merchantName.trim(),
          amount,
          requestedCategory: category,
          itemDescription: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error || "결제 요청을 처리하지 못했습니다.");
        return;
      }

      setRequestResult(data);
      await refreshBudget();
    } catch {
      setSubmitError("네트워크 오류로 요청을 완료하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransactionAction(
    transaction: BudgetDetail["transactions"][number],
    action: "add_explanation" | "resubmit"
  ) {
    const form = getTransactionForm(transaction);
    setTransactionProcessingId(transaction.id);
    setTransactionMessages((previous) => {
      const next = { ...previous };
      delete next[transaction.id];
      return next;
    });

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...form,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTransactionMessages((previous) => ({
          ...previous,
          [transaction.id]: {
            type: "error",
            text: result.error || "처리에 실패했습니다.",
          },
        }));
        return;
      }

      setTransactionMessages((previous) => ({
        ...previous,
        [transaction.id]: {
          type: "success",
          text:
            action === "add_explanation"
              ? "추가 설명을 제출했습니다."
              : `재요청 완료: ${result.policyResult?.status || "처리됨"}`,
        },
      }));
      await refreshBudget();
    } finally {
      setTransactionProcessingId(null);
    }
  }

  return (
    <SidebarLayout
      userName={budget.organization.name}
      userRole="동아리/학생회"
      orgId={budget.organizationId}
    >
      <div className="max-w-6xl p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href={`/club?org=${budget.organizationId}`}
              className="mb-2 inline-flex text-sm text-gray-500 hover:text-gray-800"
            >
              ← 동아리 예산 목록으로
            </Link>
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{budget.name}</h1>
              <StatusBadge status={budget.status} />
              {isExpiringSoon && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                  만료 {daysUntilExpiry}일 전
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {budget.organization.name} · 발행기관 {budget.issuerOrganization.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/club/budgets/${budget.id}/settlement?org=${budget.organizationId}`}>
              <Button
                variant="outline"
                className="cursor-pointer border-gray-300 bg-white"
              >
                정산 보고
              </Button>
            </Link>
            <Link href="/pos">
              <Button
                variant="outline"
                className="cursor-pointer border-gray-300 bg-white"
              >
                데모 POS 열기
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">총 발행액</div>
              <div className="text-lg font-bold text-gray-900">
                {fmt(budget.totalAmount)}원
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">현재 잔액</div>
              <div className="text-lg font-bold text-[#006B5D]">
                {fmt(budget.currentBalance)}원
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">사용 가능 기간</div>
              <div className="text-sm font-medium text-gray-900">
                {fmtDate(budget.validFrom)} ~ {fmtDate(budget.validUntil)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">사용률</div>
              <div className="text-lg font-bold text-gray-900">{usedPercent}%</div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-[#00857A]"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="mb-4">
                <h2 className="font-semibold text-gray-900">결제 요청하기</h2>
                <p className="text-sm text-gray-500">
                  예산을 확인한 뒤 같은 화면에서 바로 집행 요청을 보낼 수 있습니다.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm text-gray-700">가맹점명</Label>
                  <Input
                    value={merchantName}
                    onChange={(event) => setMerchantName(event.target.value)}
                    placeholder="예: 문구사랑"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-700">결제 금액</Label>
                  <Input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
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
                    {requestCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm text-gray-700">예산</Label>
                  <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {budget.name} · 잔액 {fmt(budget.currentBalance)}원
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Label className="text-sm text-gray-700">품목 / 메모</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="예: 종강총회 현수막 거치대 구매"
                  className="mt-1 min-h-24"
                />
              </div>

              {submitError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {submitError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  요청 결과는 승인, 보류, 거절 사유와 함께 바로 표시됩니다.
                </div>
                <Button
                  onClick={handleSubmitRequest}
                  disabled={submitting}
                  className="cursor-pointer bg-[#00857A] text-white hover:bg-[#006B5D]"
                >
                  {submitting ? "처리 중..." : "결제 요청 보내기"}
                </Button>
              </div>

              {requestResult && (
                <Card
                  className={`mt-4 border-2 ${
                    requestResult.policyResult.status === "APPROVED"
                      ? "border-emerald-300 bg-emerald-50"
                      : requestResult.policyResult.status === "NOTIFIED"
                        ? "border-blue-300 bg-blue-50"
                        : requestResult.policyResult.status === "PENDING"
                          ? "border-amber-300 bg-amber-50"
                          : "border-red-300 bg-red-50"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <StatusBadge status={requestResult.policyResult.status} />
                      <div className="text-lg font-bold text-gray-900">
                        {fmt(requestResult.transaction.amount)}원
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {requestResult.transaction.merchantName}
                    </div>
                    <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-gray-700">
                      {requestResult.policyResult.reason}
                    </div>
                    {requestResult.aiAnalysis?.available && (
                      <div className="mt-3 text-xs text-gray-600">
                        AI 위험도 {requestResult.aiAnalysis.risk.riskLevel} · 추천
                        카테고리 {requestResult.aiAnalysis.category.suggestedCategory}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="mb-4">
                <h2 className="font-semibold text-gray-900">결제 전 확인할 정책</h2>
                <p className="text-sm text-gray-500">
                  사후 반려가 아니라 사전 이해가 되도록 핵심 제한 조건을 먼저
                  보여줍니다.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#006B5D]">
                      {policy?.templateKey || "custom"}
                    </div>
                    <div className="text-xs text-gray-500">자동 승인 한도</div>
                    <div className="text-lg font-bold text-gray-900">
                      {fmt(policy?.autoApproveLimit ?? 0)}원
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">수동 검토 기준</div>
                    <div className="text-lg font-bold text-gray-900">
                      {fmt(policy?.manualReviewLimit ?? 0)}원
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 text-xs font-medium text-gray-500">
                    사용 가능 기간
                  </div>
                  <div className="text-sm text-gray-800">
                    {fmtDate(budget.validFrom)} ~ {fmtDate(budget.validUntil)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {daysUntilExpiry >= 0
                      ? isExpiringSoon
                        ? `만료 임박: ${daysUntilExpiry}일 남음`
                        : `${daysUntilExpiry}일 남음`
                      : "유효기간이 지났습니다"}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-gray-500">
                    허용 카테고리
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedCategories.map((item) => (
                      <span
                        key={item}
                        className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-gray-500">
                    금지 카테고리
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {blockedCategories.map((item) => (
                      <span
                        key={item}
                        className="rounded bg-red-50 px-2 py-1 text-xs text-red-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-gray-500">
                    금지 키워드
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {blockedKeywords.map((item) => (
                      <span
                        key={item}
                        className="rounded bg-red-50 px-2 py-1 text-xs text-red-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-gray-500">
                    허용 키워드
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedKeywords.length > 0 ? (
                      allowedKeywords.map((item) => (
                        <span
                          key={item}
                          className="rounded bg-[#E8F7F4] px-2 py-1 text-xs text-[#006B5D]"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">설정 없음</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="mb-2 text-xs font-medium text-gray-500">
                    카테고리별 자동 승인 한도
                  </div>
                  {categoryRuleEntries.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categoryRuleEntries.map(([ruleCategory, limit]) => (
                        <div
                          key={ruleCategory}
                          className="rounded-lg bg-[#F8F9FB] px-3 py-2 text-sm text-gray-700"
                        >
                          <span className="font-medium text-gray-900">
                            {ruleCategory}
                          </span>
                          {" · "}
                          {fmt(limit)}원 이하
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">기본 자동 승인 한도만 적용됩니다.</div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="mb-1 text-xs font-medium text-gray-500">
                      제한 시간대
                    </div>
                    {formatHourRange(policy?.quietHoursStart ?? null, policy?.quietHoursEnd ?? null)}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="mb-1 text-xs font-medium text-gray-500">
                      행사 기간 카테고리
                    </div>
                    {eventCategories.length > 0 ? eventCategories.join(", ") : "설정 없음"}
                  </div>
                </div>

                {(policy?.eventWindowStart || policy?.eventWindowEnd) && (
                  <div className="rounded-lg border border-[#E5E7EB] p-4">
                    <div className="mb-1 text-xs font-medium text-gray-500">
                      행사 허용 기간
                    </div>
                    <div className="text-sm text-gray-700">
                      {policy?.eventWindowStart
                        ? fmtDate(policy.eventWindowStart)
                        : "-"}
                      {" ~ "}
                      {policy?.eventWindowEnd ? fmtDate(policy.eventWindowEnd) : "-"}
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  신규 가맹점은{" "}
                  <span className="font-semibold text-gray-900">
                    {policy?.allowNewMerchant ? "허용" : "자동 검토 대상"}
                  </span>
                  입니다.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="transactions" className="cursor-pointer">
              거래 내역 ({budget.transactions.length})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="cursor-pointer">
              원장 기록 ({budget.ledgerEntries.length})
            </TabsTrigger>
            <TabsTrigger value="policy" className="cursor-pointer">
              정책 상세
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <div className="space-y-4">
              {budget.transactions.length === 0 ? (
                <Card className="border-gray-200">
                  <CardContent className="p-8 text-center text-sm text-gray-400">
                    거래 내역이 없습니다
                  </CardContent>
                </Card>
              ) : (
                budget.transactions.map((transaction) => {
                  const followUpForm = getTransactionForm(transaction);
                  const isFollowUpTarget = ["PENDING", "DECLINED"].includes(
                    transaction.status
                  );

                  return (
                    <Card key={transaction.id} className="border-gray-200">
                      <CardContent className="p-5">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {transaction.merchantName}
                              </h3>
                              <StatusBadge status={transaction.status} />
                            </div>
                            <div className="text-sm text-gray-600">
                              {transaction.itemDescription}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {fmt(transaction.amount)}원
                            </div>
                            <div className="text-xs text-gray-400">
                              {fmtDate(transaction.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>카테고리: {transaction.requestedCategory}</span>
                          <span>재요청 횟수: {transaction.resubmissionCount}회</span>
                          {transaction.lastSubmittedAt && (
                            <span>
                              마지막 제출: {fmtDate(transaction.lastSubmittedAt)}
                            </span>
                          )}
                        </div>

                        {transaction.reviewReason && (
                          <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            판정 사유: {transaction.reviewReason}
                          </div>
                        )}

                        {transaction.adminComment && (
                          <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            관리자 의견: {transaction.adminComment}
                          </div>
                        )}

                        {transaction.additionalExplanation && (
                          <div className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                            제출한 추가 설명: {transaction.additionalExplanation}
                          </div>
                        )}

                        {isFollowUpTarget && (
                          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-4">
                            <div className="mb-3">
                              <h4 className="font-medium text-gray-900">
                                보류 후속 처리
                              </h4>
                              <p className="text-xs text-gray-500">
                                추가 설명만 제출하거나, 내용을 수정한 뒤 재요청할 수
                                있습니다.
                              </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <Label className="text-sm text-gray-700">
                                  가맹점명
                                </Label>
                                <Input
                                  value={followUpForm.merchantName}
                                  onChange={(event) =>
                                    updateTransactionForm(
                                      transaction.id,
                                      { merchantName: event.target.value },
                                      transaction
                                    )
                                  }
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-sm text-gray-700">
                                  금액
                                </Label>
                                <Input
                                  type="number"
                                  value={followUpForm.amount}
                                  onChange={(event) =>
                                    updateTransactionForm(
                                      transaction.id,
                                      { amount: Number(event.target.value) },
                                      transaction
                                    )
                                  }
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-sm text-gray-700">
                                  카테고리
                                </Label>
                                <select
                                  value={followUpForm.requestedCategory}
                                  onChange={(event) =>
                                    updateTransactionForm(
                                      transaction.id,
                                      { requestedCategory: event.target.value },
                                      transaction
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                                >
                                  {requestCategories.map((item) => (
                                    <option key={`${transaction.id}-${item}`} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Label className="text-sm text-gray-700">
                                  품목 / 메모
                                </Label>
                                <Input
                                  value={followUpForm.itemDescription}
                                  onChange={(event) =>
                                    updateTransactionForm(
                                      transaction.id,
                                      { itemDescription: event.target.value },
                                      transaction
                                    )
                                  }
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <Label className="text-sm text-gray-700">
                                추가 설명 / 증빙 메모
                              </Label>
                              <Textarea
                                value={followUpForm.additionalExplanation}
                                onChange={(event) =>
                                  updateTransactionForm(
                                    transaction.id,
                                    { additionalExplanation: event.target.value },
                                    transaction
                                  )
                                }
                                className="mt-1 min-h-24"
                                placeholder="신규 가맹점 사유, 예산 목적과의 연관성, 증빙 메모를 적어주세요."
                              />
                            </div>

                            {transactionMessages[transaction.id] && (
                              <div
                                className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                                  transactionMessages[transaction.id].type === "success"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                {transactionMessages[transaction.id].text}
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                onClick={() =>
                                  handleTransactionAction(
                                    transaction,
                                    "add_explanation"
                                  )
                                }
                                disabled={transactionProcessingId === transaction.id}
                                className="cursor-pointer border-gray-300 bg-white"
                              >
                                설명만 제출
                              </Button>
                              <Button
                                onClick={() =>
                                  handleTransactionAction(transaction, "resubmit")
                                }
                                disabled={transactionProcessingId === transaction.id}
                                className="cursor-pointer bg-[#00857A] text-white hover:bg-[#006B5D]"
                              >
                                수정 후 재요청
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="ledger">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                {budget.ledgerEntries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    원장 기록이 없습니다
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                          <th className="pb-2 font-medium">유형</th>
                          <th className="pb-2 font-medium">설명</th>
                          <th className="pb-2 font-medium text-right">변동액</th>
                          <th className="pb-2 font-medium text-right">잔액</th>
                          <th className="pb-2 font-medium text-right">일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.ledgerEntries.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-50">
                            <td className="py-2.5">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  entry.type === "ISSUE"
                                    ? "bg-blue-50 text-blue-700"
                                    : entry.type === "SPEND"
                                      ? "bg-red-50 text-red-600"
                                      : entry.type === "REFUND"
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {TYPE_LABELS[entry.type] || entry.type}
                              </span>
                            </td>
                            <td className="py-2.5 text-gray-600">{entry.description}</td>
                            <td
                              className={`py-2.5 text-right font-medium ${
                                entry.amount >= 0 ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {entry.amount >= 0 ? "+" : ""}
                              {fmt(entry.amount)}원
                            </td>
                            <td className="py-2.5 text-right font-medium text-gray-900">
                              {fmt(entry.balanceAfter)}원
                            </td>
                            <td className="py-2.5 text-right text-xs text-gray-400">
                              {fmtDate(entry.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policy">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                {!policy ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    정책이 설정되지 않았습니다
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#006B5D]">
                          {policy.templateKey || "custom"}
                        </div>
                        <div className="text-xs text-gray-500">자동승인 한도</div>
                        <div className="text-lg font-bold text-gray-900">
                          {fmt(policy.autoApproveLimit)}원
                        </div>
                        <div className="text-[11px] text-blue-500">
                          이하 금액은 즉시 승인 대상
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="text-xs text-gray-500">수동검토 한도</div>
                        <div className="text-lg font-bold text-gray-900">
                          {fmt(policy.manualReviewLimit)}원
                        </div>
                        <div className="text-[11px] text-amber-500">
                          초과 시 관리자 검토 필요
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-700">
                        허용 카테고리
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {allowedCategories.map((item) => (
                          <span
                            key={item}
                            className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-700">
                        금지 카테고리
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {blockedCategories.map((item) => (
                          <span
                            key={item}
                            className="rounded bg-red-50 px-2 py-1 text-xs text-red-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-700">
                        금지 키워드
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {blockedKeywords.map((item) => (
                          <span
                            key={item}
                            className="rounded bg-red-50 px-2 py-1 text-xs text-red-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-700">
                        허용 키워드
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {allowedKeywords.length > 0 ? (
                          allowedKeywords.map((item) => (
                            <span
                              key={item}
                              className="rounded bg-[#E8F7F4] px-2 py-1 text-xs text-[#006B5D]"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">설정 없음</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-700">
                        카테고리별 자동승인 규칙
                      </h4>
                      {categoryRuleEntries.length > 0 ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          {categoryRuleEntries.map(([ruleCategory, limit]) => (
                            <div
                              key={ruleCategory}
                              className="rounded-lg bg-[#F8F9FB] px-3 py-2 text-sm text-gray-700"
                            >
                              <span className="font-medium text-gray-900">
                                {ruleCategory}
                              </span>
                              {" · "}
                              {fmt(limit)}원 이하 자동 승인
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          기본 자동승인 한도만 사용합니다.
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="text-xs text-gray-500">제한 시간대</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          {formatHourRange(policy.quietHoursStart, policy.quietHoursEnd)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="text-xs text-gray-500">행사 기간 카테고리</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          {eventCategories.length > 0
                            ? eventCategories.join(", ")
                            : "설정 없음"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">행사 허용 기간</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">
                        {policy.eventWindowStart ? fmtDate(policy.eventWindowStart) : "-"}
                        {" ~ "}
                        {policy.eventWindowEnd ? fmtDate(policy.eventWindowEnd) : "-"}
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      신규 가맹점은{" "}
                      <span className="font-medium">
                        {policy.allowNewMerchant ? "허용" : "검토 필요"}
                      </span>
                      입니다.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
