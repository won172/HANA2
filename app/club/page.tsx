"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Budget = {
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
  _count: { transactions: number };
};

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function getDaysUntil(date: string) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / msPerDay);
}

function ClubDashboardContent() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org") || "org-stats";
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadBudgets() {
      setLoading(true);

      try {
        const response = await fetch("/api/budgets");
        const allBudgets: Budget[] = await response.json();
        const filtered = allBudgets.filter((budget) => budget.organizationId === orgId);

        if (!isMounted) {
          return;
        }

        setBudgets(filtered);
        setOrgName(filtered[0]?.organization.name ?? "동아리");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadBudgets();

    return () => {
      isMounted = false;
    };
  }, [orgId]);

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.totalAmount, 0);
  const totalBalance = budgets.reduce(
    (sum, budget) => sum + budget.currentBalance,
    0
  );
  const expiringSoonCount = budgets.filter((budget) => {
    const daysUntil = getDaysUntil(budget.validUntil);
    return daysUntil >= 0 && daysUntil <= 14;
  }).length;

  return (
    <SidebarLayout
      userName={orgName || "동아리"}
      userRole="동아리/학생회"
      orgId={orgId}
    >
      <div className="p-6 max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {orgName || "동아리"} 대시보드
            </h1>
            <p className="text-sm text-gray-500">
              예산 현황을 확인하고 예산 상세에서 바로 결제 요청을 진행합니다
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/pos">
              <Button
                variant="outline"
                className="cursor-pointer border-gray-300 bg-white"
              >
                데모 POS 보기
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 animate-pulse">
            로딩 중...
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">총 배정 예산</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">
                    {fmt(totalBudget)}원
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">현재 잔액</div>
                  <div className="mt-1 text-xl font-bold text-teal-600">
                    {fmt(totalBalance)}원
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">활성 예산 수</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">
                    {budgets.filter((budget) => budget.status === "ACTIVE").length}개
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">만료 임박</div>
                  <div className="mt-1 text-xl font-bold text-amber-600">
                    {expiringSoonCount}개
                  </div>
                  <div className="text-[11px] text-gray-400">
                    14일 이내 종료 예정
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6 border-amber-200 bg-amber-50/70">
              <CardContent className="p-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      예산 상세에서 바로 요청하세요
                    </h2>
                    <p className="text-sm text-gray-600">
                      허용 카테고리, 금지 키워드, 자동 승인 한도를 확인한 뒤 같은
                      화면에서 결제 요청을 보낼 수 있습니다.
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    `/pos`는 데모용 가맹점 시뮬레이터로 유지됩니다.
                  </div>
                </div>
              </CardContent>
            </Card>

            <h2 className="mb-3 font-semibold text-gray-900">예산 목록</h2>
            <div className="space-y-3">
              {budgets.map((budget) => {
                const usedPercent =
                  budget.totalAmount > 0
                    ? Math.round(
                        ((budget.totalAmount - budget.currentBalance) /
                          budget.totalAmount) *
                          100
                      )
                    : 0;
                const daysUntilExpiry = getDaysUntil(budget.validUntil);
                const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 14;

                return (
                  <Link
                    key={budget.id}
                    href={`/club/budgets/${budget.id}?org=${orgId}`}
                  >
                    <Card className="mb-3 cursor-pointer border-gray-200 transition-shadow hover:shadow-md">
                      <CardContent className="p-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {budget.name}
                            </span>
                            <StatusBadge status={budget.status} />
                            {isExpiringSoon && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                                만료 {daysUntilExpiry}일 전
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-gray-900">
                            {fmt(budget.currentBalance)}원
                          </span>
                        </div>

                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>발행: {budget.issuerOrganization.name}</span>
                          <span>거래 {budget._count.transactions}건</span>
                          <span>
                            사용기간 {new Date(budget.validFrom).toLocaleDateString("ko-KR")}
                            {" ~ "}
                            {new Date(budget.validUntil).toLocaleDateString("ko-KR")}
                          </span>
                        </div>

                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-teal-400 transition-all"
                            style={{ width: `${100 - usedPercent}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                          <span>
                            사용금액 {fmt(budget.totalAmount - budget.currentBalance)}원
                          </span>
                          <span>상세 보기 및 결제 요청</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}

              {budgets.length === 0 && (
                <Card className="border-dashed border-gray-300 bg-white">
                  <CardContent className="p-8 text-center text-sm text-gray-500">
                    조회 가능한 예산이 없습니다.
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

export default function ClubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      }
    >
      <ClubDashboardContent />
    </Suspense>
  );
}
