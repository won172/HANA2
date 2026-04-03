"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Transaction = {
  id: string;
  merchantName: string;
  itemDescription: string;
  requestedCategory: string;
  amount: number;
  status: string;
  reviewReason: string | null;
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

  const fetchData = () => {
    setLoading(true);
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.filter((t: Transaction) => t.status === "PENDING"));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (txId: string, action: "approve" | "decline") => {
    setProcessing(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "처리 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">보류 거래 검토</h1>
          <p className="text-sm text-gray-500">
            정책에 의해 보류된 거래를 승인하거나 반려합니다
          </p>
        </div>

        {loading ? (
          <div className="text-gray-400 animate-pulse text-center py-20">
            로딩 중...
          </div>
        ) : transactions.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="p-12 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-gray-500 text-sm">
                검토 대기 중인 거래가 없습니다
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <Card key={tx.id} className="border-gray-200 hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {tx.merchantName}
                        </h3>
                        <StatusBadge status={tx.status} />
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {tx.itemDescription}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>카테고리: {tx.requestedCategory}</span>
                        <span>예산: {tx.budget.name}</span>
                        <span>조직: {tx.budget.organization.name}</span>
                        <span>
                          예산 잔액: {fmt(tx.budget.currentBalance)}원
                        </span>
                        <span>
                          요청일:{" "}
                          {new Date(tx.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      {tx.reviewReason && (
                        <div className="mt-2 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-md inline-block">
                          💡 {tx.reviewReason}
                        </div>
                      )}
                      
                      {tx.aiRiskScore !== null && (
                        <div className="mt-3 bg-gray-50 rounded-md p-3 border border-gray-100">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">🤖</span>
                            <span className="text-xs font-semibold text-gray-700">AI 분석 참고 </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              tx.aiRiskLevel === "HIGH" ? "bg-red-100 text-red-700" :
                              tx.aiRiskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              리스크: {tx.aiRiskScore}/100 ({tx.aiRiskLevel})
                            </span>
                            {tx.aiSuggestedCategory && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                                추천: {tx.aiSuggestedCategory}
                              </span>
                            )}
                          </div>
                          {tx.aiExplanation && (
                            <p className="text-xs text-gray-600 mt-1.5 leading-snug">
                              {tx.aiExplanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <span className="text-lg font-bold text-gray-900">
                        {fmt(tx.amount)}원
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(tx.id, "approve")}
                          disabled={processing === tx.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs cursor-pointer"
                        >
                          ✓ 승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(tx.id, "decline")}
                          disabled={processing === tx.id}
                          className="text-red-600 border-red-200 hover:bg-red-50 text-xs cursor-pointer"
                        >
                          ✕ 반려
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
