"use client";

import { useEffect, useState, useMemo } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type DashboardData = {
  budgets: Array<{
    id: string;
    name: string;
    totalAmount: number;
    currentBalance: number;
    status: string;
    organization: { name: string };
    _count: { transactions: number };
  }>;
  recentTransactions: Array<{
    id: string;
    merchantName: string;
    itemDescription: string;
    requestedCategory: string;
    amount: number;
    status: string;
    createdAt: string;
    organization: { id: string; name: string };
  }>;
  stats: {
    totalBudget: number;
    totalBalance: number;
    totalTransactions: number;
    pendingCount: number;
    activeBudgetCount: number;
    statusCounts: Record<string, number>;
  };
};

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <SidebarLayout userName="김관리자" userRole="관리자">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      </SidebarLayout>
    );
  }

  const { stats, budgets, recentTransactions } = data;

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
            <p className="text-sm text-gray-500">예산 발행 현황 및 거래 모니터링</p>
          </div>
          <Link href="/admin/issue">
            <Button className="bg-gray-900 hover:bg-gray-800 text-white cursor-pointer">
              + 예산 발행
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 mb-1">총 발행 예산</div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(stats.totalBudget)}원
              </div>
              <div className="text-[11px] text-gray-400">
                {stats.activeBudgetCount}개 예산
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 mb-1">현재 잔액 합계</div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(stats.totalBalance)}원
              </div>
              <div className="text-[11px] text-gray-400">
                활성 {stats.activeBudgetCount}개
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 mb-1">전체 거래 수</div>
              <div className="text-xl font-bold text-gray-900">
                {stats.totalTransactions}
              </div>
              <div className="text-[11px] text-gray-400">누적 거래</div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 mb-1">보류 거래</div>
              <div className="text-xl font-bold text-amber-600">
                {stats.pendingCount}
              </div>
              <div className="text-[11px] text-gray-400">검토 필요</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Counts */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4">거래 상태 분포</h3>
              {(() => {
                const maxCount = Math.max(
                  ...Object.values(stats.statusCounts),
                  1
                );
                const MAX_BAR_HEIGHT = 120; // px
                const colors: Record<string, string> = {
                  APPROVED: "bg-emerald-400",
                  NOTIFIED: "bg-blue-400",
                  PENDING: "bg-amber-400",
                  DECLINED: "bg-red-400",
                };
                const labels: Record<string, string> = {
                  APPROVED: "승인",
                  NOTIFIED: "알림",
                  PENDING: "보류",
                  DECLINED: "거절",
                };
                return (
                  <div className="flex items-end justify-around" style={{ height: 180 }}>
                    {Object.entries(stats.statusCounts).map(([status, count]) => {
                      const barHeight = Math.max(
                        (count / maxCount) * MAX_BAR_HEIGHT,
                        12
                      );
                      return (
                        <div
                          key={status}
                          className="flex flex-col items-center"
                        >
                          <span className="text-xs font-semibold text-gray-700 mb-1">
                            {count}
                          </span>
                          <div
                            className={`w-11 rounded-t-lg ${colors[status] || "bg-gray-300"}`}
                            style={{ height: barHeight }}
                          />
                          <span className="text-[11px] text-gray-500 mt-2">
                            {labels[status] || status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Budget List */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4">예산 목록</h3>
              <div className="space-y-3">
                {budgets.map((b) => {
                  const usedPercent =
                    b.totalAmount > 0
                      ? Math.round(
                          ((b.totalAmount - b.currentBalance) / b.totalAmount) *
                            100
                        )
                      : 0;
                  return (
                    <div key={b.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {b.name}
                          </span>
                          <StatusBadge status={b.status} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {fmt(b.currentBalance)}원
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mb-1">
                        {b.organization.name}
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-teal-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${100 - usedPercent}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-gray-400 mt-0.5">
                        잔액 ({100 - usedPercent}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions — org tabs */}
        {(() => {
          const orgNames = Array.from(
            new Set(recentTransactions.map((tx) => tx.organization?.name).filter(Boolean))
          );
          const filteredTx =
            selectedOrg === "ALL"
              ? recentTransactions
              : recentTransactions.filter(
                  (tx) => tx.organization?.name === selectedOrg
                );

          return (
            <Card className="border-gray-200 mt-6">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">최근 거래 내역</h3>
                  <span className="text-xs text-gray-400">{filteredTx.length}건</span>
                </div>

                {/* Org filter tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setSelectedOrg("ALL")}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      selectedOrg === "ALL"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    전체
                  </button>
                  {orgNames.map((orgName) => (
                    <button
                      key={orgName}
                      onClick={() => setSelectedOrg(orgName)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selectedOrg === orgName
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {orgName}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                        {selectedOrg === "ALL" && (
                          <th className="pb-2 font-medium">조직</th>
                        )}
                        <th className="pb-2 font-medium">가맹점</th>
                        <th className="pb-2 font-medium">설명</th>
                        <th className="pb-2 font-medium">카테고리</th>
                        <th className="pb-2 font-medium text-right">금액</th>
                        <th className="pb-2 font-medium text-center">상태</th>
                        <th className="pb-2 font-medium text-right">일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTx.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          {selectedOrg === "ALL" && (
                            <td className="py-2.5 text-gray-500 text-xs">
                              {tx.organization?.name}
                            </td>
                          )}
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
                          <td className="py-2.5 text-right text-gray-400 text-xs whitespace-nowrap">
                            {fmtDate(tx.createdAt)}
                          </td>
                        </tr>
                      ))}
                      {filteredTx.length === 0 && (
                        <tr>
                          <td
                            colSpan={selectedOrg === "ALL" ? 7 : 6}
                            className="py-8 text-center text-gray-400 text-sm"
                          >
                            거래 내역이 없습니다
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </SidebarLayout>
  );
}
