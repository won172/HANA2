"use client";

import { useEffect, useState, use } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BudgetDetail = {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  validFrom: string;
  validUntil: string;
  status: string;
  organization: { name: string };
  issuerOrganization: { name: string };
  policy: {
    allowedCategories: string;
    blockedCategories: string;
    blockedKeywords: string;
    autoApproveLimit: number;
    manualReviewLimit: number;
    allowNewMerchant: boolean;
  } | null;
  transactions: Array<{
    id: string;
    merchantName: string;
    itemDescription: string;
    requestedCategory: string;
    amount: number;
    status: string;
    reviewReason: string | null;
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

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("ko-KR");
}

const TYPE_LABELS: Record<string, string> = {
  ISSUE: "발행",
  SPEND: "지출",
  REFUND: "환불",
  EXPIRE_RECALL: "만료환수",
};

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [budget, setBudget] = useState<BudgetDetail | null>(null);

  useEffect(() => {
    fetch(`/api/budgets/${id}`)
      .then((r) => r.json())
      .then(setBudget);
  }, [id]);

  if (!budget) {
    return (
      <SidebarLayout userName="동아리" userRole="동아리/학생회">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      </SidebarLayout>
    );
  }

  const usedPercent =
    budget.totalAmount > 0
      ? Math.round(
          ((budget.totalAmount - budget.currentBalance) / budget.totalAmount) *
            100
        )
      : 0;

  const policy = budget.policy;
  const allowedCats = policy
    ? JSON.parse(policy.allowedCategories)
    : [];
  const blockedCats = policy
    ? JSON.parse(policy.blockedCategories)
    : [];
  const blockedKws = policy
    ? JSON.parse(policy.blockedKeywords)
    : [];

  return (
    <SidebarLayout
      userName={budget.organization.name}
      userRole="동아리/학생회"
    >
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{budget.name}</h1>
            <StatusBadge status={budget.status} />
          </div>
          <p className="text-sm text-gray-500">
            {budget.organization.name} · 발행: {budget.issuerOrganization.name}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <div className="text-xs text-gray-500">잔액</div>
              <div className="text-lg font-bold text-teal-600">
                {fmt(budget.currentBalance)}원
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">유효기간</div>
              <div className="text-sm font-medium text-gray-900">
                {fmtDate(budget.validFrom)} ~ {fmtDate(budget.validUntil)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">사용률</div>
              <div className="text-lg font-bold text-gray-900">
                {usedPercent}%
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                <div
                  className="bg-teal-400 h-1.5 rounded-full"
                  style={{ width: `${usedPercent}%` }}
                />
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
              정책 설정
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                {budget.transactions.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    거래 내역이 없습니다
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-2 font-medium">가맹점</th>
                          <th className="pb-2 font-medium">설명</th>
                          <th className="pb-2 font-medium">카테고리</th>
                          <th className="pb-2 font-medium text-right">금액</th>
                          <th className="pb-2 font-medium text-center">상태</th>
                          <th className="pb-2 font-medium text-right">일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className="border-b border-gray-50"
                          >
                            <td className="py-2.5 font-medium text-gray-900">
                              {tx.merchantName}
                            </td>
                            <td className="py-2.5 text-gray-600">
                              {tx.itemDescription}
                            </td>
                            <td className="py-2.5 text-gray-500">
                              {tx.requestedCategory}
                            </td>
                            <td className="py-2.5 text-right font-medium text-gray-900">
                              {fmt(tx.amount)}원
                            </td>
                            <td className="py-2.5 text-center">
                              <StatusBadge status={tx.status} />
                            </td>
                            <td className="py-2.5 text-right text-gray-400 text-xs">
                              {fmtDate(tx.createdAt)}
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

          {/* Ledger Tab */}
          <TabsContent value="ledger">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                {budget.ledgerEntries.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    원장 기록이 없습니다
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-2 font-medium">유형</th>
                          <th className="pb-2 font-medium">설명</th>
                          <th className="pb-2 font-medium text-right">변동액</th>
                          <th className="pb-2 font-medium text-right">잔액</th>
                          <th className="pb-2 font-medium text-right">일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.ledgerEntries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-b border-gray-50"
                          >
                            <td className="py-2.5">
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded ${
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
                            <td className="py-2.5 text-gray-600">
                              {entry.description}
                            </td>
                            <td
                              className={`py-2.5 text-right font-medium ${
                                entry.amount >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                            >
                              {entry.amount >= 0 ? "+" : ""}
                              {fmt(entry.amount)}원
                            </td>
                            <td className="py-2.5 text-right text-gray-900 font-medium">
                              {fmt(entry.balanceAfter)}원
                            </td>
                            <td className="py-2.5 text-right text-gray-400 text-xs">
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

          {/* Policy Tab */}
          <TabsContent value="policy">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                {!policy ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    정책이 설정되지 않았습니다
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-1">
                          자동승인 한도
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {fmt(policy.autoApproveLimit)}원
                        </div>
                        <div className="text-[11px] text-blue-500">
                          이하: 즉시 승인 (Level A)
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-xs text-gray-500 mb-1">
                          수동검토 한도
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {fmt(policy.manualReviewLimit)}원
                        </div>
                        <div className="text-[11px] text-amber-500">
                          초과: 검토 필요 (Level C)
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        허용 카테고리
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {allowedCats.map((c: string) => (
                          <span
                            key={c}
                            className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        금지 카테고리
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {blockedCats.map((c: string) => (
                          <span
                            key={c}
                            className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        금지 키워드
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {blockedKws.map((kw: string) => (
                          <span
                            key={kw}
                            className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      신규 가맹점:{" "}
                      <span className="font-medium">
                        {policy.allowNewMerchant ? "허용" : "검토 필요"}
                      </span>
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
