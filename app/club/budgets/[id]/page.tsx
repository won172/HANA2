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
import {
  ALL_BUDGET_CATEGORIES,
  formatCategoryList,
  getCategoryLabel,
} from "@/lib/categoryLabels";
import {
  formatPolicyExceptionWindow,
  getCurrentPolicyExceptionWindow,
  getNextPolicyExceptionWindow,
} from "@/lib/policyExceptionWindow";
import { parseJsonResponse } from "@/lib/fetchJson";

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
    displayName: string | null;
    summary: string | null;
    policySource: string | null;
    aiConfidence: number | null;
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
  policyExceptionRequests: Array<{
    id: string;
    merchantName: string;
    amount: number;
    requestedCategory: string;
    itemDescription: string;
    justification: string;
    status: string;
    adminComment: string | null;
    submissionWindowLabel: string;
    submissionWindowStart: number;
    submissionWindowEnd: number;
    reviewedAt: string | null;
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

type FollowUpForm = {
  merchantName: string;
  amount: number;
  requestedCategory: string;
  itemDescription: string;
  additionalExplanation: string;
};

type PolicyExceptionForm = {
  merchantName: string;
  amount: number;
  requestedCategory: string;
  itemDescription: string;
  justification: string;
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

function fmtDateTime(date: Date) {
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [now, setNow] = useState(() => new Date());
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false);
  const [exceptionError, setExceptionError] = useState("");
  const [exceptionMessage, setExceptionMessage] = useState("");
  const [exceptionForm, setExceptionForm] = useState<PolicyExceptionForm>({
    merchantName: "",
    amount: 0,
    requestedCategory: "",
    itemDescription: "",
    justification: "",
  });
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
    const data = await parseJsonResponse<BudgetDetail>(response);
    setBudget(data);
    setLoadError("");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBudget() {
      try {
        const response = await fetch(`/api/budgets/${id}`);
        const data = await parseJsonResponse<BudgetDetail>(response);
        if (!cancelled) {
          setBudget(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setBudget(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : "예산 상세 정보를 불러오지 못했습니다."
          );
        }
      }
    }

    void loadBudget();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
  const currentExceptionWindow = getCurrentPolicyExceptionWindow(now);
  const nextExceptionWindow = getNextPolicyExceptionWindow(now);
  const exceptionWindowState = currentExceptionWindow
    ? "진행 중"
    : nextExceptionWindow
      ? "운영창 시작 전"
      : "운영창 없음";

  useEffect(() => {
    if (
      exceptionForm.requestedCategory &&
      !ALL_BUDGET_CATEGORIES.includes(
        exceptionForm.requestedCategory as (typeof ALL_BUDGET_CATEGORIES)[number]
      )
    ) {
      setExceptionForm((previous) => ({
        ...previous,
        requestedCategory: "",
      }));
    }
  }, [exceptionForm.requestedCategory, requestCategories]);

  if (!budget && !loadError) {
    return (
      <SidebarLayout userName="동아리" userRole="동아리/학생회">
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (!budget) {
    return (
      <SidebarLayout userName="동아리" userRole="동아리/학생회">
        <div className="max-w-3xl p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError || "예산 상세 정보를 불러오지 못했습니다."}
            </CardContent>
          </Card>
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

  async function handleSubmitExceptionRequest() {
    if (!budget) {
      return;
    }

    if (
      !exceptionForm.merchantName.trim() ||
      exceptionForm.amount <= 0 ||
      !exceptionForm.itemDescription.trim() ||
      !exceptionForm.justification.trim() ||
      !exceptionForm.requestedCategory
    ) {
      setExceptionError(
        "가맹점명, 금액, 카테고리, 품목/메모, 예외 사유를 모두 입력하세요."
      );
      return;
    }

    setExceptionSubmitting(true);
    setExceptionError("");
    setExceptionMessage("");

    try {
      const response = await fetch("/api/policy-exception-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetId: budget.id,
          merchantName: exceptionForm.merchantName.trim(),
          amount: exceptionForm.amount,
          requestedCategory: exceptionForm.requestedCategory,
          itemDescription: exceptionForm.itemDescription.trim(),
          justification: exceptionForm.justification.trim(),
        }),
      });

      await parseJsonResponse<{ id: string }>(response);

      setExceptionMessage("정책 예외 결제 신청서를 제출했습니다.");
      setExceptionForm({
        merchantName: "",
        amount: 0,
        requestedCategory: "",
        itemDescription: "",
        justification: "",
      });
      await refreshBudget();
    } catch (error) {
      setExceptionError(
        error instanceof Error
          ? error.message
          : "네트워크 오류로 신청을 완료하지 못했습니다."
      );
    } finally {
      setExceptionSubmitting(false);
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

        <div className="mb-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-[#D5E2DE] bg-[#F7FBFA]">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#006B5D]">
                    정상 집행 흐름
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    일반 결제는 POS에서 진행합니다
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    이 예산을 선택한 상태로 POS를 열어 가맹점, 금액, 품목을 입력하세요.
                    AI 정책과 정책 엔진이 집행 가능 여부를 바로 판정합니다.
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                  <div className="text-xs text-gray-500">현재 사용 가능 잔액</div>
                  <div className="text-xl font-bold text-[#006B5D]">
                    {fmt(budget.currentBalance)}원
                  </div>
                </div>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="mb-2 text-xs font-medium text-[#006B5D]">1. 결제 입력</div>
                  <div className="text-sm text-gray-700">
                    POS에서 가맹점, 금액, 카테고리, 품목을 입력합니다.
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="mb-2 text-xs font-medium text-[#006B5D]">2. 정책 판정</div>
                  <div className="text-sm text-gray-700">
                    AI 정책과 정책 엔진이 즉시 승인, 알림, 검토, 거절을 판정합니다.
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="mb-2 text-xs font-medium text-[#006B5D]">3. 원장 반영</div>
                  <div className="text-sm text-gray-700">
                    승인되면 거래와 원장 기록이 연결되어 잔액이 즉시 갱신됩니다.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/pos?budgetId=${budget.id}&org=${budget.organizationId}`}>
                  <Button className="cursor-pointer bg-[#00857A] text-white hover:bg-[#006B5D]">
                    이 예산으로 결제하기
                  </Button>
                </Link>
                <a
                  href="#policy-exception"
                  className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  정책 예외 신청 보기
                </a>
                <div className="text-xs text-gray-500">
                  정책 밖의 긴급 결제만 예외 신청으로 접수합니다.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                <div className="mb-4">
                  <h2 className="font-semibold text-gray-900">운영창 상태</h2>
                  <p className="text-sm text-gray-500">
                    정책 예외 결제 신청은 정해진 운영창에서만 접수됩니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] p-4">
                  <div className="text-xs font-medium text-gray-500">현재 시각</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">
                    {fmtDateTime(now)}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        currentExceptionWindow
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {exceptionWindowState}
                    </span>
                    <span className="text-sm text-gray-700">
                      {currentExceptionWindow
                        ? formatPolicyExceptionWindow(currentExceptionWindow)
                        : nextExceptionWindow
                          ? `${formatPolicyExceptionWindow(nextExceptionWindow)} 예정`
                          : "운영창 정보 없음"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {currentExceptionWindow
                      ? "지금은 예외 신청서를 제출할 수 있습니다."
                      : nextExceptionWindow
                        ? `다음 운영창 시작: ${fmtDateTime(nextExceptionWindow.startsAt)}`
                        : "다음 운영창 정보를 불러오지 못했습니다."}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-5">
                <div className="mb-4">
                  <h2 className="font-semibold text-gray-900">
                    {policy?.displayName || "AI 정책"} 핵심
                  </h2>
                  <p className="text-sm text-gray-500">
                    결제 전에 꼭 보는 기준만 간단히 요약했습니다.
                  </p>
                </div>

                <div className="space-y-3 text-sm text-gray-700">
                  <div className="rounded-lg bg-gray-50 p-3">
                    자동 승인 한도 {fmt(policy?.autoApproveLimit ?? 0)}원 · 수동 검토 기준{" "}
                    {fmt(policy?.manualReviewLimit ?? 0)}원
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    허용 카테고리: {formatCategoryList(allowedCategories, "제한 없음")}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    금지 카테고리: {formatCategoryList(blockedCategories, "없음")}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    금지 키워드:{" "}
                    {blockedKeywords.length > 0
                      ? blockedKeywords.slice(0, 4).join(", ")
                      : "없음"}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    신규 가맹점은{" "}
                    <span className="font-semibold text-gray-900">
                      {policy?.allowNewMerchant ? "허용" : "검토 대상"}
                    </span>
                    입니다.
                  </div>
                  <div className="text-xs text-gray-500">
                    {policy?.summary ||
                      "예산 목적과 유효기간 안에서 정책 기준에 맞게 집행해 주세요."}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <details
          id="policy-exception"
          className="mb-6 rounded-2xl border border-[#E5E7EB] bg-white"
        >
          <summary className="cursor-pointer list-none px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-1 text-sm font-semibold text-gray-900">
                  정책 예외 결제 신청
                </div>
                <div className="text-sm text-gray-500">
                  정상 집행이 어려운 긴급 결제만 별도로 신청합니다.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    currentExceptionWindow
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {exceptionWindowState}
                </span>
                <span className="text-xs text-gray-500">
                  최근 신청 {budget.policyExceptionRequests.length}건
                </span>
              </div>
            </div>
          </summary>

          <div className="border-t border-[#E5E7EB] px-5 py-5">
            <div className="rounded-xl border border-[#D5E2DE] bg-[#F7FBFA] p-4">
              <div className="text-sm font-medium text-gray-900">
                {currentExceptionWindow
                  ? `${formatPolicyExceptionWindow(currentExceptionWindow)} 동안 제출 가능합니다.`
                  : "운영창 외 시간에는 예외 신청서를 제출할 수 없습니다."}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {currentExceptionWindow
                  ? "제출 후에는 관리자 검토를 거쳐 승인 또는 반려됩니다."
                  : nextExceptionWindow
                    ? `다음 운영창: ${fmtDateTime(nextExceptionWindow.startsAt)} · ${formatPolicyExceptionWindow(nextExceptionWindow)}`
                    : "다음 운영창 정보를 불러오지 못했습니다."}
              </div>
            </div>

            {currentExceptionWindow ? (
              <>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm text-gray-700">가맹점명</Label>
                    <Input
                      value={exceptionForm.merchantName}
                      onChange={(event) =>
                        setExceptionForm((previous) => ({
                          ...previous,
                          merchantName: event.target.value,
                        }))
                      }
                      placeholder="예: 문구사랑"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">결제 금액</Label>
                    <Input
                      type="number"
                      min={0}
                      value={exceptionForm.amount || ""}
                      onChange={(event) =>
                        setExceptionForm((previous) => ({
                          ...previous,
                          amount: Number(event.target.value),
                        }))
                      }
                      placeholder="금액을 입력하세요"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">카테고리</Label>
                    <select
                      value={exceptionForm.requestedCategory}
                      onChange={(event) =>
                        setExceptionForm((previous) => ({
                          ...previous,
                          requestedCategory: event.target.value,
                        }))
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                    >
                      <option value="">카테고리를 선택하세요</option>
                      {ALL_BUDGET_CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {getCategoryLabel(item)}
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
                    value={exceptionForm.itemDescription}
                    onChange={(event) =>
                      setExceptionForm((previous) => ({
                        ...previous,
                        itemDescription: event.target.value,
                      }))
                    }
                    placeholder="예: 행사 당일 추가 장비 대여"
                    className="mt-1 min-h-24"
                  />
                </div>

                <div className="mt-4">
                  <Label className="text-sm text-gray-700">예외 신청 사유</Label>
                  <Textarea
                    value={exceptionForm.justification}
                    onChange={(event) =>
                      setExceptionForm((previous) => ({
                        ...previous,
                        justification: event.target.value,
                      }))
                    }
                    placeholder="왜 정책 밖 결제가 필요한지, 행사나 운영에 어떤 영향이 있는지 적어주세요."
                    className="mt-1 min-h-28"
                  />
                </div>

                {exceptionError && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {exceptionError}
                  </div>
                )}

                {exceptionMessage && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {exceptionMessage}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    제출 즉시 결제가 생성되지는 않습니다. 신청서는 관리자 검토 후 승인 또는
                    반려됩니다.
                  </div>
                  <Button
                    onClick={handleSubmitExceptionRequest}
                    disabled={exceptionSubmitting}
                    className="cursor-pointer bg-[#00857A] text-white hover:bg-[#006B5D]"
                  >
                    {exceptionSubmitting ? "제출 중..." : "예외 결제 신청서 제출"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                운영창이 열리면 이 영역에서 예외 신청서를 작성할 수 있습니다.
              </div>
            )}

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  최근 예외 결제 신청
                </h3>
                <div className="text-xs text-gray-500">
                  {budget.policyExceptionRequests.length}건
                </div>
              </div>

              {budget.policyExceptionRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  아직 등록된 정책 예외 결제 신청이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {budget.policyExceptionRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border border-[#E5E7EB] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <div className="font-medium text-gray-900">
                              {request.merchantName}
                            </div>
                            <StatusBadge status={request.status} />
                          </div>
                          <div className="text-sm text-gray-600">
                            {request.itemDescription}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {fmt(request.amount)}원
                          </div>
                          <div className="text-xs text-gray-400">
                            {fmtDate(request.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          카테고리: {getCategoryLabel(request.requestedCategory)}
                        </span>
                        <span>
                          제출창: {request.submissionWindowLabel}{" "}
                          {String(request.submissionWindowStart).padStart(2, "0")}:00-
                          {String(request.submissionWindowEnd).padStart(2, "0")}:00
                        </span>
                      </div>
                      <div className="mt-3 rounded-lg bg-[#F8F9FB] px-3 py-2 text-sm text-gray-700">
                        신청 사유: {request.justification}
                      </div>
                      {request.adminComment && (
                        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          관리자 의견: {request.adminComment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>

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
	                          <span>
	                            카테고리: {getCategoryLabel(transaction.requestedCategory)}
	                          </span>
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
	                                      {getCategoryLabel(item)}
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
                          {policy.displayName || "정책"}
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

                    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                      <div className="mb-1 text-xs font-medium text-gray-500">
                        정책 설명
                      </div>
                      <div className="text-sm text-gray-700">
                        {policy.summary || "등록된 정책 설명이 없습니다."}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        생성 방식 {policy.policySource || "MANUAL"}
                        {typeof policy.aiConfidence === "number"
                          ? ` · AI 신뢰도 ${Math.round(policy.aiConfidence * 100)}%`
                          : ""}
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
	                            {getCategoryLabel(item)}
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
	                            {getCategoryLabel(item)}
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
	                              {getCategoryLabel(ruleCategory)}
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
	                          {formatCategoryList(eventCategories)}
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
