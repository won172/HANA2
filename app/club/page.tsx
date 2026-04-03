"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

type Budget = {
  id: string;
  name: string;
  totalAmount: number;
  currentBalance: number;
  validFrom: string;
  validUntil: string;
  status: string;
  organization: { name: string };
  issuerOrganization: { name: string };
  _count: { transactions: number };
};

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function ClubDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = searchParams.get("org") || "org-stats";
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((data: Budget[]) => {
        const filtered = data.filter(
          (b: Budget) =>
            (b as unknown as { organizationId: string }).organizationId ===
              orgId || b.organization?.name?.includes(orgId)
        );

        // If we don't have the organizationId in the response, filter by the query result
        // and set org name from first match
        if (filtered.length > 0) {
          setOrgName(filtered[0].organization.name);
        }
        setBudgets(filtered.length > 0 ? filtered : data.filter((b: Budget) => {
          // Fallback: try direct match via fetch
          return true;
        }));
        setLoading(false);
      });
  }, [orgId]);

  // Actually let's fetch all budgets and filter client-side based on org
  useEffect(() => {
    setLoading(true);
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((allBudgets: (Budget & { organizationId: string })[]) => {
        const filtered = allBudgets.filter(
          (b) => b.organizationId === orgId
        );
        if (filtered.length > 0) {
          setOrgName(filtered[0].organization.name);
        }
        setBudgets(filtered);
        setLoading(false);
      });
  }, [orgId]);

  const totalBudget = budgets.reduce((s, b) => s + b.totalAmount, 0);
  const totalBalance = budgets.reduce((s, b) => s + b.currentBalance, 0);

  const handleLogout = () => {
    document.cookie = "userId=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <SidebarLayout
      userName={orgName || "동아리"}
      userRole="동아리/학생회"
    >
      <div className="p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {orgName || "동아리"} 대시보드
          </h1>
          <p className="text-sm text-gray-500">
            예산 현황 및 거래 내역을 확인합니다
          </p>
        </div>

        {loading ? (
          <div className="text-gray-400 animate-pulse text-center py-20">
            로딩 중...
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">총 배정 예산</div>
                  <div className="text-xl font-bold text-gray-900 mt-1">
                    {fmt(totalBudget)}원
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">현재 잔액</div>
                  <div className="text-xl font-bold text-teal-600 mt-1">
                    {fmt(totalBalance)}원
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-500">활성 예산 수</div>
                  <div className="text-xl font-bold text-gray-900 mt-1">
                    {budgets.filter((b) => b.status === "ACTIVE").length}개
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Budget Cards */}
            <h2 className="font-semibold text-gray-900 mb-3">📋 예산 목록</h2>
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
                  <Link key={b.id} href={`/club/budgets/${b.id}?org=${orgId}`}>
                    <Card className="border-gray-200 hover:shadow-md transition-shadow cursor-pointer mb-3">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {b.name}
                            </span>
                            <StatusBadge status={b.status} />
                          </div>
                          <span className="font-bold text-gray-900">
                            {fmt(b.currentBalance)}원
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          발행: {b.issuerOrganization.name} · 거래{" "}
                          {b._count.transactions}건
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-teal-400 h-2 rounded-full transition-all"
                            style={{ width: `${100 - usedPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>
                            사용금액: {fmt(b.totalAmount - b.currentBalance)}원
                          </span>
                          <span>잔액 {100 - usedPercent}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      }
    >
      <ClubDashboardContent />
    </Suspense>
  );
}
