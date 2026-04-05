"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseJsonResponse } from "@/lib/fetchJson";

type DashboardData = {
  expiringBudgets: Array<{
    id: string;
    name: string;
    currentBalance: number;
    validUntil: string;
    organization: { name: string };
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
  stats: {
    totalBudget: number;
    totalBalance: number;
    totalTransactions: number;
    pendingCount: number;
    pendingTransactionCount: number;
    pendingExceptionRequestCount: number;
    activeBudgetCount: number;
    pendingRequestCount: number;
    settlementPendingCount: number;
    expiringBudgetCount: number;
    highRiskCount: number;
    anchorSummary: {
      total: number;
      anchored: number;
      failed: number;
      lastAnchoredAt: string | null;
    };
  };
};

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const anchorEventLabels: Record<string, string> = {
  BUDGET_ISSUED: "예산 발행",
  POLICY_SNAPSHOT: "정책 스냅샷",
  TRANSACTION_DECISION: "거래 판정",
  SETTLEMENT_REPORT: "정산 보고",
  POLICY_EXCEPTION_REQUEST: "정책 예외 신청",
};

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

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
        setLastUpdatedAt(new Date().toISOString());
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
        <div className="flex h-64 items-center justify-center">
          <div className="animate-pulse text-gray-400">로딩 중...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (!data) {
    return (
      <SidebarLayout userName="김관리자" userRole="관리자">
        <div className="max-w-6xl p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError || "대시보드 데이터를 불러오지 못했습니다."}
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  const { expiringBudgets, recentAnchors, stats } = data;
  const quickLinks = [
    {
      href: "/admin/requests",
      label: "예산 신청 검토",
      count: `${stats.pendingRequestCount}건`,
      description: "승인 또는 반려가 필요한 신청서",
      note: "대기열 우선 확인",
      tone: "border-amber-200 bg-amber-50/70",
    },
    {
      href: "/admin/pending",
      label: "보류 거래",
      count: `${stats.pendingCount}건`,
      description: "보류 거래와 정책 예외 결제 신청을 함께 검토하는 화면",
      note: `거래 ${stats.pendingTransactionCount}건 · 예외 ${stats.pendingExceptionRequestCount}건`,
      tone: "border-orange-200 bg-orange-50/70",
    },
    {
      href: "/admin/settlements",
      label: "정산 대기",
      count: `${stats.settlementPendingCount}건`,
      description: "종료 보고를 검토하고 환수 금액을 확정할 예산",
      note: "정산 흐름 확인",
      tone: "border-sky-200 bg-sky-50/70",
    },
    {
      href: "/admin/transactions",
      label: "거래 내역",
      count: `${stats.totalTransactions}건`,
      description: "전체 거래를 페이지별로 확인하는 상세 화면",
      note: `보류 ${stats.pendingCount}건 · 고위험 ${stats.highRiskCount}건`,
      tone: "border-[#D5E2DE] bg-[#F7FBFA]",
    },
  ];

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-6xl p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
            <p className="mt-1 text-sm text-gray-500">
              들어가자마자 확인해야 하는 운영 대기열만 남겼습니다. 상세 목록은 각
              화면에서 페이지별로 확인하세요.
            </p>
            <div className="mt-2 text-xs text-gray-400">
              마지막 업데이트 {lastUpdatedAt ? fmtDateTime(lastUpdatedAt) : "기록 없음"}
            </div>
          </div>
          <Link href="/admin/issue">
            <Button className="cursor-pointer">+ 예산 발행</Button>
          </Link>
        </div>

        <Card className="mb-6 border-[#D5E2DE] bg-[linear-gradient(135deg,#F7FBFA_0%,#FFFFFF_100%)]">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#006B5D]">
                  Budget Overview
                </div>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">
                  발행 예산 / 잔액
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  현재 운영 중인 전체 발행 규모와 남은 잔액을 함께 봅니다.
                </p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
                활성 예산 {stats.activeBudgetCount}개
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#D5E2DE] bg-white p-5 shadow-[0_2px_8px_rgba(17,24,39,0.04)]">
                <div className="text-xs text-gray-500">총 발행 예산</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {fmt(stats.totalBudget)}원
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  활성 예산 전체 기준
                </div>
              </div>
              <div className="rounded-2xl border border-[#D5E2DE] bg-white p-5 shadow-[0_2px_8px_rgba(17,24,39,0.04)]">
                <div className="text-xs text-gray-500">현재 잔액</div>
                <div className="mt-2 text-3xl font-bold text-[#006B5D]">
                  {fmt(stats.totalBalance)}원
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  원장 기준 사용 가능 금액
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card
                className={`h-full transition-colors hover:border-[#00857A] ${item.tone}`}
              >
                <CardContent className="p-5">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">
                    {item.count}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                  <div className="mt-4 text-xs font-medium text-[#006B5D]">
                    {item.note}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="border-[#D5E2DE] bg-white">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">만료 임박 예산</h2>
                <p className="mt-1 text-xs text-gray-500">
                  7일 이내 종료되는 활성 예산만 표시합니다.
                </p>
              </div>
              <div className="rounded-full bg-[#F7FBFA] px-3 py-1 text-xs text-gray-600">
                {stats.expiringBudgetCount}건
              </div>
            </div>

            <div className="space-y-3">
              {expiringBudgets.length > 0 ? (
                expiringBudgets.map((budget) => (
                  <div
                    key={budget.id}
                    className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{budget.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {budget.organization.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {fmt(budget.currentBalance)}원
                        </div>
                        <div className="mt-1 text-xs text-amber-600">
                          {fmtDate(budget.validUntil)} 종료
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#D5E2DE] bg-[#F7FBFA] px-4 py-8 text-center text-sm text-gray-500">
                  당장 종료 대응이 필요한 예산이 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 border-[#D5E2DE] bg-white">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">최근 감사 이벤트</h2>
                <p className="mt-1 text-xs text-gray-500">
                  감사 레이어에는 핵심 의사결정 이벤트만 남깁니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="rounded-full bg-[#F7FBFA] px-3 py-1 text-xs text-gray-600">
                  완료 {stats.anchorSummary.anchored}건
                </div>
                <div className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">
                  실패 {stats.anchorSummary.failed}건
                </div>
                <div className="rounded-full bg-[#E8F7F4]/60 px-3 py-1 text-xs text-gray-600">
                  최근 앵커링{" "}
                  {stats.anchorSummary.lastAnchoredAt
                    ? fmtDateTime(stats.anchorSummary.lastAnchoredAt)
                    : "기록 없음"}
                </div>
                <Link href="/admin/anchors">
                  <Button
                    variant="outline"
                    className="cursor-pointer border-[#D5E2DE] bg-white text-gray-700 hover:bg-[#F7FBFA]"
                  >
                    감사 화면 보기
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {recentAnchors.length > 0 ? (
                recentAnchors.map((anchor) => (
                  <div
                    key={anchor.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-gray-900">
                          {anchorEventLabels[anchor.eventType] || anchor.eventType}
                        </div>
                        <StatusBadge status={anchor.chainStatus} />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {anchor.entityType} · {anchor.entityId.slice(0, 10)} · Payload{" "}
                        {anchor.payloadHash.slice(0, 12)}...
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>
                        {fmtDateTime(anchor.anchoredAt || anchor.createdAt)}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-gray-400">
                        {anchor.txHash ? `${anchor.txHash.slice(0, 14)}...` : "txHash 없음"}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#D5E2DE] bg-[#F7FBFA] px-4 py-8 text-center text-sm text-gray-500">
                  아직 생성된 앵커링 기록이 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
