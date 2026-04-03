"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Budget = {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  status: string;
  organization: { name: string };
  organizationId: string;
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

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export default function POSPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultType | null>(null);

  // Form state
  const [budgetId, setBudgetId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState(30000);
  const [category, setCategory] = useState("FOOD");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((data: Budget[]) => {
        const active = data.filter((b) => b.status === "ACTIVE");
        setBudgets(active);
        if (active.length > 0) setBudgetId(active[0].id);
      });
  }, []);

  const handleSubmit = async () => {
    if (!budgetId || !merchantName || !description) {
      alert("모든 항목을 입력하세요.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetId,
          merchantName,
          amount,
          requestedCategory: category,
          itemDescription: description,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        // Refresh budgets to update balances
        const budgetsRes = await fetch("/api/budgets");
        const updatedBudgets = await budgetsRes.json();
        setBudgets(updatedBudgets.filter((b: Budget) => b.status === "ACTIVE"));
      } else {
        alert(data.error || "결제 요청 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  const selectedBudget = budgets.find((b) => b.id === budgetId);

  return (
    <SidebarLayout userName="POS단말기" userRole="가맹점 시뮬레이터">
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <div className="mb-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            데모 모드
          </div>
          <h1 className="text-2xl font-bold text-gray-900">가맹점 결제 시뮬레이터</h1>
          <p className="text-sm text-gray-500">
            운영 흐름의 메인 화면은 동아리 예산 상세입니다. 이 페이지는 POS 요청을
            별도로 시연하기 위한 데모용 화면입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* POS Form */}
          <Card className="border-gray-200">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 text-xl mb-2">
                  🖥️
                </div>
                <h2 className="font-semibold text-gray-900">결제 요청 시뮬레이션</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-700">예산 선택</Label>
                  <select
                    value={budgetId}
                    onChange={(e) => setBudgetId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.organization.name}) - 잔액:{" "}
                        {fmt(b.currentBalance)}원
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm text-gray-700">가맹점명</Label>
                  <Input
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="예: 카페베네, 문구사랑"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-700">결제 금액 (원)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-700">카테고리</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm text-gray-700">상품/서비스 설명</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="예: 회의 다과 구매"
                    className="mt-1"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 cursor-pointer"
                >
                  {loading ? "처리 중..." : "💳 결제 요청"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Result & Info Column */}
          <div className="space-y-4">
            {/* Budget Info */}
            {selectedBudget && (
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    선택된 예산 정보
                  </h3>
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
                      <span className="font-bold text-teal-600">
                        {fmt(selectedBudget.currentBalance)}원
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Result */}
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
                    <div className="text-3xl mb-2">
                      {result.policyResult.status === "APPROVED"
                        ? "✅"
                        : result.policyResult.status === "NOTIFIED"
                        ? "🔔"
                        : result.policyResult.status === "PENDING"
                        ? "⏳"
                        : "❌"}
                    </div>
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

                  <div className="bg-white/60 rounded-lg p-3 text-sm text-gray-700">
                    <div className="font-medium text-gray-500 text-xs mb-1">
                      판정 사유
                    </div>
                    {result.policyResult.reason}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Analysis */}
            {result?.aiAnalysis && (
              <Card className="border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🤖</span>
                      <h3 className="text-sm font-semibold text-gray-700">AI 분석</h3>
                      {result.aiAnalysis.available ? (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">활성</span>
                      ) : (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">비활성</span>
                      )}
                    </div>

                    {result.aiAnalysis.available ? (
                      <div className="space-y-3">
                        {/* Risk Score */}
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>리스크 점수</span>
                            <span className={`font-bold ${
                              result.aiAnalysis.risk?.riskLevel === "HIGH" ? "text-red-600" :
                              result.aiAnalysis.risk?.riskLevel === "MEDIUM" ? "text-amber-600" :
                              "text-emerald-600"
                            }`}>
                              {result.aiAnalysis.risk?.riskScore}/100 ({result.aiAnalysis.risk?.riskLevel})
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                result.aiAnalysis.risk?.riskLevel === "HIGH" ? "bg-red-400" :
                                result.aiAnalysis.risk?.riskLevel === "MEDIUM" ? "bg-amber-400" :
                                "bg-emerald-400"
                              }`}
                              style={{ width: `${result.aiAnalysis.risk?.riskScore}%` }}
                            />
                          </div>
                        </div>

                        {/* Suggested Category */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">추천 카테고리</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900">
                              {result.aiAnalysis.category?.suggestedCategory}
                            </span>
                            <span className="text-gray-400">
                              (신뢰도 {result.aiAnalysis.category?.confidence !== undefined ? Math.round(result.aiAnalysis.category.confidence * 100) : 0}%)
                            </span>
                          </div>
                        </div>

                        {/* Explanation */}
                        <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 leading-relaxed">
                          {result.aiAnalysis.risk?.explanation}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-2">
                        AI 분석이 비활성화되어 있습니다 (API 키 미설정)
                      </div>
                    )}
                  </CardContent>
              </Card>
            )}

            {/* Quick Test Buttons */}
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  ⚡ 빠른 테스트
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setMerchantName("문구사랑");
                      setAmount(30000);
                      setCategory("SUPPLIES");
                      setDescription("A4 용지 구매");
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="text-emerald-500">●</span> Level A: 정상
                    소액 결제 (30,000원)
                  </button>
                  <button
                    onClick={() => {
                      setMerchantName("문구사랑");
                      setAmount(80000);
                      setCategory("SUPPLIES");
                      setDescription("대형 현수막 제작");
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="text-blue-500">●</span> Level B: 한도 초과
                    알림 (80,000원)
                  </button>
                  <button
                    onClick={() => {
                      setMerchantName("새가맹점");
                      setAmount(45000);
                      setCategory("FOOD");
                      setDescription("식비 결제");
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="text-amber-500">●</span> Level C: 신규
                    가맹점 (검토 필요)
                  </button>
                  <button
                    onClick={() => {
                      setMerchantName("편의점");
                      setAmount(15000);
                      setCategory("FOOD");
                      setDescription("주류 구매");
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="text-red-500">●</span> Level D: 금지
                    키워드 (즉시 거절)
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
