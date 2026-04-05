"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCategoryLabel } from "@/lib/categoryLabels";
import { parseJsonResponse } from "@/lib/fetchJson";

type Transaction = {
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
  createdAt: string;
  budget: {
    id: string;
    name: string;
    currentBalance: number;
    organization: { name: string };
  };
  aiSuggestedCategory: string | null;
  aiRiskScore: number | null;
  aiRiskLevel: string | null;
  aiExplanation: string | null;
};

type PolicyExceptionRequest = {
  id: string;
  merchantName: string;
  itemDescription: string;
  requestedCategory: string;
  amount: number;
  justification: string;
  status: string;
  adminComment: string | null;
  submissionWindowLabel: string;
  submissionWindowStart: number;
  submissionWindowEnd: number;
  createdAt: string;
  budget: {
    id: string;
    name: string;
    currentBalance: number;
    organization: { name: string };
  };
};

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export default function PendingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exceptionRequests, setExceptionRequests] = useState<PolicyExceptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [viewMode, setViewMode] = useState<"QUEUE" | "RECENT">("QUEUE");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transactionData, exceptionData] = await Promise.all([
        fetch("/api/transactions").then((response) =>
          parseJsonResponse<Transaction[]>(response)
        ),
        fetch("/api/policy-exception-requests").then((response) =>
          parseJsonResponse<PolicyExceptionRequest[]>(response)
        ),
      ]);
      setLoadError("");
        setTransactions(
          transactionData
        );
        setExceptionRequests(exceptionData);
    } catch (error) {
      setTransactions([]);
      setExceptionRequests([]);
      setLoadError(
        error instanceof Error ? error.message : "검토 항목을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleAction = async (txId: string, action: "approve" | "decline") => {
    setProcessing(txId);
    try {
      const response = await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason:
            comments[txId]?.trim() ||
            (action === "approve" ? "관리자 수동 승인" : "관리자 거절"),
          adminComment: comments[txId]?.trim() || null,
        }),
      });

      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "처리 실패");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "네트워크 오류");
    } finally {
      setProcessing(null);
    }
  };

  const handleExceptionAction = async (
    requestId: string,
    action: "approve" | "reject"
  ) => {
    setProcessing(requestId);
    try {
      const response = await fetch(`/api/policy-exception-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          adminComment:
            comments[requestId]?.trim() ||
            (action === "approve"
              ? "정책 예외 결제를 승인했습니다."
              : "정책 예외 결제를 반려합니다."),
        }),
      });

      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "처리 실패");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "네트워크 오류");
    } finally {
      setProcessing(null);
    }
  };

  const pendingTransactions = transactions.filter(
    (transaction) => transaction.status === "PENDING"
  );
  const recentTransactions = transactions
    .filter((transaction) => transaction.status !== "PENDING")
    .slice(0, 8);
  const pendingExceptionRequests = exceptionRequests.filter(
    (request) => request.status === "PENDING"
  );
  const recentExceptionRequests = exceptionRequests
    .filter((request) => request.status !== "PENDING")
    .slice(0, 8);
  const hasQueue =
    pendingTransactions.length > 0 || pendingExceptionRequests.length > 0;
  const hasRecent =
    recentTransactions.length > 0 || recentExceptionRequests.length > 0;

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-4xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">보류 거래 / 예외 결제 신청 검토</h1>
          <p className="text-sm text-gray-500">
            승인자는 대기열을 먼저 보고, 관리자는 최근 처리 이력까지 이어서 확인할 수
            있게 구성했습니다.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">검토 대기 거래</div>
              <div className="mt-1 text-xl font-bold text-amber-600">
                {pendingTransactions.length}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">검토 대기 예외 신청</div>
              <div className="mt-1 text-xl font-bold text-orange-600">
                {pendingExceptionRequests.length}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">최근 처리 이력</div>
              <div className="mt-1 text-xl font-bold text-[#006B5D]">
                {recentTransactions.length + recentExceptionRequests.length}건
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-[#D5E2DE] bg-white">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("QUEUE")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  viewMode === "QUEUE"
                    ? "bg-[#00857A] text-white"
                    : "bg-[#F7FBFA] text-gray-600"
                }`}
              >
                지금 처리할 항목
              </button>
              <button
                type="button"
                onClick={() => setViewMode("RECENT")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  viewMode === "RECENT"
                    ? "bg-[#00857A] text-white"
                    : "bg-[#F7FBFA] text-gray-600"
                }`}
              >
                최근 처리 이력
              </button>
            </div>
          </CardContent>
        </Card>

        {loadError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{loadError}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-400 animate-pulse">로딩 중...</div>
        ) : viewMode === "QUEUE" && !hasQueue ? (
          <Card className="border-gray-200">
            <CardContent className="p-12 text-center">
              <div className="mb-3 text-4xl">✅</div>
              <p className="text-sm text-gray-500">검토 대기 중인 항목이 없습니다</p>
            </CardContent>
          </Card>
        ) : viewMode === "RECENT" && !hasRecent ? (
          <Card className="border-gray-200">
            <CardContent className="p-12 text-center text-sm text-gray-500">
              최근 처리 이력이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {viewMode === "QUEUE" && pendingExceptionRequests.length > 0 && (
              <Card className="border-[#D5E2DE] bg-[#F7FBFA]">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <h2 className="font-semibold text-gray-900">정책 예외 결제 신청</h2>
                    <p className="text-sm text-gray-500">
                      운영창 안에서 접수된 정책 외 결제 신청서입니다. 원장 반영은 없고 검토 결과만
                      기록합니다.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {pendingExceptionRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-[#E5E7EB] bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {request.merchantName}
                              </h3>
                              <StatusBadge status={request.status} />
                            </div>
                            <p className="mb-2 text-sm text-gray-600">
                              {request.itemDescription}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span>
                                카테고리: {getCategoryLabel(request.requestedCategory)}
                              </span>
                              <span>예산: {request.budget.name}</span>
                              <span>조직: {request.budget.organization.name}</span>
                              <span>예산 잔액: {fmt(request.budget.currentBalance)}원</span>
                              <span>
                                제출일: {new Date(request.createdAt).toLocaleDateString("ko-KR")}
                              </span>
                              <span>
                                운영창: {request.submissionWindowLabel}{" "}
                                {String(request.submissionWindowStart).padStart(2, "0")}:00-
                                {String(request.submissionWindowEnd).padStart(2, "0")}:00
                              </span>
                            </div>
                            <div className="mt-3 rounded-md border border-[#D5E2DE] bg-[#F8F9FB] p-3 text-sm text-gray-700">
                              신청 사유: {request.justification}
                            </div>
                            <div className="mt-4">
                              <Textarea
                                value={comments[request.id] ?? request.adminComment ?? ""}
                                onChange={(event) =>
                                  setComments((previous) => ({
                                    ...previous,
                                    [request.id]: event.target.value,
                                  }))
                                }
                                className="min-h-20"
                                placeholder="승인 또는 반려 의견을 입력하세요."
                              />
                            </div>
                          </div>

                          <div className="ml-4 flex flex-col items-end gap-2">
                            <span className="text-lg font-bold text-gray-900">
                              {fmt(request.amount)}원
                            </span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleExceptionAction(request.id, "approve")}
                                disabled={processing === request.id}
                                className="cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExceptionAction(request.id, "reject")}
                                disabled={processing === request.id}
                                className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50"
                              >
                                반려
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === "QUEUE" && pendingTransactions.length > 0 && (
              <div className="mb-1 text-sm font-semibold text-gray-700">보류 거래</div>
            )}
            {viewMode === "QUEUE" &&
              pendingTransactions.map((transaction) => (
              <Card
                key={transaction.id}
                className="border-gray-200 transition-shadow hover:shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {transaction.merchantName}
                        </h3>
                        <StatusBadge status={transaction.status} />
                      </div>
                      <p className="mb-2 text-sm text-gray-600">
                        {transaction.itemDescription}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
	                        <span>
	                          카테고리: {getCategoryLabel(transaction.requestedCategory)}
	                        </span>
                        <span>예산: {transaction.budget.name}</span>
                        <span>조직: {transaction.budget.organization.name}</span>
                        <span>예산 잔액: {fmt(transaction.budget.currentBalance)}원</span>
                        <span>
                          요청일: {new Date(transaction.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                        <span>재요청: {transaction.resubmissionCount}회</span>
                      </div>

                      {transaction.reviewReason && (
                        <div className="mt-2 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                          판정 사유: {transaction.reviewReason}
                        </div>
                      )}

                      {transaction.additionalExplanation && (
                        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                          추가 설명: {transaction.additionalExplanation}
                        </div>
                      )}

                      {transaction.aiRiskScore !== null && (
                        <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm">🤖</span>
                            <span className="text-xs font-semibold text-gray-700">
                              AI 분석 참고
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                transaction.aiRiskLevel === "HIGH"
                                  ? "bg-red-100 text-red-700"
                                  : transaction.aiRiskLevel === "MEDIUM"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              리스크: {transaction.aiRiskScore}/100 ({transaction.aiRiskLevel})
                            </span>
                            {transaction.aiSuggestedCategory && (
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
	                                추천: {getCategoryLabel(transaction.aiSuggestedCategory)}
	                              </span>
                            )}
                          </div>
                          {transaction.aiExplanation && (
                            <p className="mt-1.5 text-xs leading-snug text-gray-600">
                              {transaction.aiExplanation}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-4">
                        <Textarea
                          value={comments[transaction.id] ?? transaction.adminComment ?? ""}
                          onChange={(event) =>
                            setComments((previous) => ({
                              ...previous,
                              [transaction.id]: event.target.value,
                            }))
                          }
                          className="min-h-20"
                          placeholder="승인 또는 반려 사유를 입력하세요."
                        />
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        {fmt(transaction.amount)}원
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(transaction.id, "approve")}
                          disabled={processing === transaction.id}
                          className="cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(transaction.id, "decline")}
                          disabled={processing === transaction.id}
                          className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50"
                        >
                          반려
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {viewMode === "RECENT" && recentExceptionRequests.length > 0 && (
              <Card className="border-[#D5E2DE] bg-white">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <h2 className="font-semibold text-gray-900">최근 처리한 예외 신청</h2>
                  </div>
                  <div className="space-y-3">
                    {recentExceptionRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <div className="font-medium text-gray-900">{request.merchantName}</div>
                              <StatusBadge status={request.status} />
                            </div>
                            <div className="text-sm text-gray-600">{request.itemDescription}</div>
                            <div className="mt-2 text-xs text-gray-500">
                              {request.budget.organization.name} · {request.budget.name} ·{" "}
                              {new Date(request.createdAt).toLocaleDateString("ko-KR")}
                            </div>
                          </div>
                          <div className="text-right text-sm font-semibold text-gray-900">
                            {fmt(request.amount)}원
                          </div>
                        </div>
                        {request.adminComment && (
                          <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                            관리자 의견: {request.adminComment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === "RECENT" && recentTransactions.length > 0 && (
              <Card className="border-[#D5E2DE] bg-white">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <h2 className="font-semibold text-gray-900">최근 처리한 거래</h2>
                  </div>
                  <div className="space-y-3">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <div className="font-medium text-gray-900">{transaction.merchantName}</div>
                              <StatusBadge status={transaction.status} />
                            </div>
                            <div className="text-sm text-gray-600">{transaction.itemDescription}</div>
                            <div className="mt-2 text-xs text-gray-500">
                              {transaction.budget.organization.name} · {transaction.budget.name} ·{" "}
                              {new Date(transaction.createdAt).toLocaleDateString("ko-KR")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {fmt(transaction.amount)}원
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {transaction.reviewReason || "처리 사유 없음"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
