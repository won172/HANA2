"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export default function PendingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const fetchData = () => {
    setLoading(true);
    fetch("/api/transactions")
      .then((response) => response.json())
      .then((data) => {
        setTransactions(data.filter((transaction: Transaction) => transaction.status === "PENDING"));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
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
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "처리 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-4xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">보류 거래 검토</h1>
          <p className="text-sm text-gray-500">
            보류 거래를 승인/반려하고, 요청자가 남긴 추가 설명을 함께 검토합니다.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 animate-pulse">로딩 중...</div>
        ) : transactions.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="p-12 text-center">
              <div className="mb-3 text-4xl">✅</div>
              <p className="text-sm text-gray-500">검토 대기 중인 거래가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
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
                        <span>카테고리: {transaction.requestedCategory}</span>
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
                                추천: {transaction.aiSuggestedCategory}
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
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
