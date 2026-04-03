"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { parseJsonResponse } from "@/lib/fetchJson";

type SettlementRow = {
  budget: {
    id: string;
    name: string;
    organization: { name: string };
    issuerOrganization: { name: string };
  };
  settlement: {
    status: string;
    reportNote: string;
    reclaimAmount: number;
    updatedAt: string;
  };
  summary: {
    totalIssued: number;
    totalUsed: number;
    totalRejected: number;
    pendingCount: number;
  };
};

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

export default function AdminSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRows() {
      try {
        const response = await fetch("/api/settlements");
        const data = await parseJsonResponse<SettlementRow[]>(response);

        if (!active) {
          return;
        }

        setLoadError("");
        setRows(data);
      } catch (error) {
        if (!active) {
          return;
        }

        setRows([]);
        setLoadError(
          error instanceof Error ? error.message : "정산 목록을 불러오지 못했습니다."
        );
      }
    }

    void loadRows();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
          <p className="text-sm text-gray-500">
            종료 보고가 제출된 예산의 사용 현황과 환수 예정 금액을 확인합니다.
          </p>
        </div>

        {loadError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.budget.id} className="border-gray-200">
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{row.budget.name}</h2>
                      <StatusBadge status={row.settlement.status} />
                    </div>
                    <p className="text-sm text-gray-500">
                      {row.budget.organization.name} · 발행 {row.budget.issuerOrganization.name}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(row.settlement.updatedAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">총 발행액</div><div className="font-semibold text-gray-900">{fmt(row.summary.totalIssued)}원</div></div>
                  <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">총 사용액</div><div className="font-semibold text-gray-900">{fmt(row.summary.totalUsed)}원</div></div>
                  <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">총 반려액</div><div className="font-semibold text-red-600">{fmt(row.summary.totalRejected)}원</div></div>
                  <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">보류 거래</div><div className="font-semibold text-amber-600">{row.summary.pendingCount}건</div></div>
                  <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">환수 예정</div><div className="font-semibold text-gray-900">{fmt(row.settlement.reclaimAmount)}원</div></div>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700">
                  {row.settlement.reportNote}
                </div>
              </CardContent>
            </Card>
          ))}

          {rows.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                제출된 정산 보고가 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
