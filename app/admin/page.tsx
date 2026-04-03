"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/fetchJson";

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
  recentAnchors: Array<{
    id: string;
    eventType: string;
    entityType: string;
    entityId: string;
    payloadHash: string;
    chainStatus: string;
    txHash: string | null;
    anchoredAt: string | null;
    createdAt: string;
  }>;
  anomalies: Array<{
    id: string;
    type: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    organizationName: string;
    budgetName?: string;
    merchantName?: string;
    transactionIds: string[];
    relatedAmount: number;
    detectedAt: string;
  }>;
  insights: {
    headline: string;
    highlights: string[];
    recommendedActions: string[];
    memoNormalizationExamples: Array<{
      transactionId: string;
      raw: string;
      normalizedCategory: string;
      normalizedLabel: string;
    }>;
    counters: {
      anomalyCount: number;
      highRiskCount: number;
      pendingCount: number;
      merchantConcentrationCount: number;
      repeatedAmountCount: number;
      rushSpendCount: number;
      lateNightCount: number;
    };
  };
  stats: {
    totalBudget: number;
    totalBalance: number;
    totalTransactions: number;
    pendingCount: number;
    activeBudgetCount: number;
    statusCounts: Record<string, number>;
    anchorSummary: {
      total: number;
      anchored: number;
      failed: number;
      lastAnchoredAt: string | null;
    };
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

function getSeverityTone(severity: "HIGH" | "MEDIUM" | "LOW") {
  if (severity === "HIGH") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (severity === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>("ALL");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard");
        const result = await parseJsonResponse<DashboardData>(response);

        if (!active) {
          return;
        }

        setLoadError("");
        setData(result);
      } catch (error) {
        if (!active) {
          return;
        }

        setData(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "대시보드 데이터를 불러오지 못했습니다."
        );
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (!data && !loadError) {
    return (
      <SidebarLayout userName="김관리자" userRole="관리자">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (!data) {
    return (
      <SidebarLayout userName="김관리자" userRole="관리자">
        <div className="p-6 max-w-6xl">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError || "대시보드 데이터를 불러오지 못했습니다."}
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  const { stats, budgets, recentTransactions, anomalies, insights } = data;
  const recentAnchors = data.recentAnchors;
  const statusCountEntries = Object.entries(stats.statusCounts) as Array<
    [keyof DashboardData["stats"]["statusCounts"], number]
  >;

  const anchorEventLabels: Record<string, string> = {
    BUDGET_ISSUED: "예산 발행",
    POLICY_SNAPSHOT: "정책 스냅샷",
    TRANSACTION_DECISION: "거래 판정",
    SETTLEMENT_REPORT: "정산 보고",
  };

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
            <Button className="cursor-pointer">
              + 예산 발행
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-6">
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
          <Card className="border-[#E5E7EB] bg-[#E8F7F4]/60">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 mb-1">감사 앵커</div>
              <div className="text-xl font-bold text-[#006B5D]">
                {stats.anchorSummary.anchored}
              </div>
              <div className="text-[11px] text-gray-400">
                전체 {stats.anchorSummary.total}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 mb-1">이상 징후</div>
              <div className="text-xl font-bold text-gray-900">
                {insights.counters.anomalyCount}
              </div>
              <div className="text-[11px] text-gray-400">
                고위험 {insights.counters.highRiskCount}건
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#E5E7EB] bg-white mb-6">
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                운영 인사이트 요약
              </h3>
              <p className="mt-1 text-sm text-gray-500">{insights.headline}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#006B5D]">
                  Highlights
                </div>
                <div className="space-y-2">
                  {insights.highlights.length > 0 ? (
                    insights.highlights.map((highlight, index) => (
                      <div
                        key={`${highlight}-${index}`}
                        className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-gray-700 shadow-[0_2px_8px_rgba(17,24,39,0.04)]"
                      >
                        {highlight}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-gray-500 shadow-[0_2px_8px_rgba(17,24,39,0.04)]">
                      현재 별도 이상 징후가 감지되지 않았습니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#006B5D]">
                    Recommended Actions
                  </div>
                  <div className="space-y-2">
                    {insights.recommendedActions.map((action, index) => (
                      <div
                        key={`${action}-${index}`}
                        className="rounded-xl border border-[#E5E7EB] bg-[#E8F7F4]/55 px-3 py-2 text-sm text-gray-700"
                      >
                        {action}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <div className="text-xs text-gray-500">가맹점 편중</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {insights.counters.merchantConcentrationCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <div className="text-xs text-gray-500">동일 금액 반복</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {insights.counters.repeatedAmountCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <div className="text-xs text-gray-500">종료 직전 집행</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {insights.counters.rushSpendCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <div className="text-xs text-gray-500">심야 결제</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {insights.counters.lateNightCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Counts */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4">거래 상태 분포</h3>
              {(() => {
                const maxCount = Math.max(
                  ...statusCountEntries.map(([, count]) => count),
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
                    {statusCountEntries.map(([status, count]) => {
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-[#E5E7EB] bg-white">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    AI 이상 패턴 탐지
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    반복 금액, 심야 결제, 종료 직전 집행, 가맹점 편중을 기준으로 집계합니다.
                  </p>
                </div>
                <div className="rounded-full border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-1 text-xs text-gray-500">
                  {anomalies.length}건
                </div>
              </div>

              <div className="space-y-3">
                {anomalies.length > 0 ? (
                  anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_8px_rgba(17,24,39,0.04)]"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">
                            {anomaly.title}
                          </h4>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getSeverityTone(
                              anomaly.severity
                            )}`}
                          >
                            {anomaly.severity === "HIGH"
                              ? "높음"
                              : anomaly.severity === "MEDIUM"
                                ? "중간"
                                : "낮음"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {fmtDate(anomaly.detectedAt)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{anomaly.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-[#F8F9FB] px-2.5 py-1">
                          조직 {anomaly.organizationName}
                        </span>
                        {anomaly.budgetName && (
                          <span className="rounded-full bg-[#F8F9FB] px-2.5 py-1">
                            예산 {anomaly.budgetName}
                          </span>
                        )}
                        {anomaly.merchantName && (
                          <span className="rounded-full bg-[#F8F9FB] px-2.5 py-1">
                            가맹점 {anomaly.merchantName}
                          </span>
                        )}
                        <span className="rounded-full bg-[#E8F7F4] px-2.5 py-1 text-[#006B5D]">
                          영향 금액 {fmt(anomaly.relatedAmount)}원
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8F9FB] px-4 py-8 text-center text-sm text-gray-500">
                    현재 감지된 이상 패턴이 없습니다.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB] bg-white">
            <CardContent className="p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">
                  메모 정규화 샘플
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  AI 보조 전처리로 결제 메모를 운영 카테고리 기준으로 정리합니다.
                </p>
              </div>

              <div className="space-y-3">
                {insights.memoNormalizationExamples.length > 0 ? (
                  insights.memoNormalizationExamples.map((example) => (
                    <div
                      key={example.transactionId}
                      className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {example.raw}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-white px-2.5 py-1 text-gray-600">
                          원문 메모
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className="rounded-full bg-[#E8F7F4] px-2.5 py-1 text-[#006B5D]">
                          {example.normalizedCategory}
                        </span>
                        <span className="text-gray-500">
                          {example.normalizedLabel}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8F9FB] px-4 py-8 text-center text-sm text-gray-500">
                    아직 표시할 정규화 사례가 없습니다.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions — org tabs */}
        {(() => {
          const orgNames = Array.from(
            new Set(
              recentTransactions
                .map((tx) => tx.organization?.name)
                .filter((name): name is string => Boolean(name))
            )
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
                        ? "bg-[#00857A] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-[#E8F7F4] hover:text-[#006B5D]"
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
                          ? "bg-[#00857A] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-[#E8F7F4] hover:text-[#006B5D]"
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

        <Card className="border-[#E5E7EB] mt-6">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">감사 레이어 요약</h3>
                <p className="text-xs text-gray-500">
                  핵심 의사결정 이벤트만 해시로 앵커링한 최근 기록입니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs text-gray-500">
                  마지막 앵커링
                  <div className="mt-1 font-medium text-gray-900">
                    {stats.anchorSummary.lastAnchoredAt
                      ? fmtDate(stats.anchorSummary.lastAnchoredAt)
                      : "-"}
                  </div>
                </div>
                <Link href="/admin/anchors">
                  <Button
                    variant="outline"
                    className="cursor-pointer border-[#E5E7EB] bg-white text-gray-700 hover:bg-[#F8F9FB]"
                  >
                    상세 보기
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="text-xs text-gray-500">완료</div>
                <div className="mt-1 text-lg font-semibold text-[#006B5D]">
                  {stats.anchorSummary.anchored}건
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="text-xs text-gray-500">실패</div>
                <div className="mt-1 text-lg font-semibold text-red-600">
                  {stats.anchorSummary.failed}건
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="text-xs text-gray-500">상태</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {stats.anchorSummary.failed > 0 ? "주의 필요" : "정상"}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">이벤트</th>
                    <th className="pb-2 font-medium">엔티티</th>
                    <th className="pb-2 font-medium">Payload Hash</th>
                    <th className="pb-2 font-medium">Tx Hash</th>
                    <th className="pb-2 font-medium text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAnchors.map((anchor) => (
                    <tr key={anchor.id} className="border-b border-gray-50">
                      <td className="py-2.5 text-gray-900">
                        {anchorEventLabels[anchor.eventType] || anchor.eventType}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {anchor.entityType} · {anchor.entityId.slice(0, 10)}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-gray-500">
                        {anchor.payloadHash.slice(0, 16)}...
                      </td>
                      <td className="py-2.5 font-mono text-xs text-gray-500">
                        {anchor.txHash ? `${anchor.txHash.slice(0, 16)}...` : "-"}
                      </td>
                      <td className="py-2.5 text-center">
                        <StatusBadge status={anchor.chainStatus} />
                      </td>
                    </tr>
                  ))}
                  {recentAnchors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                        아직 생성된 앵커링 기록이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
