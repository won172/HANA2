"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { parseJsonResponse } from "@/lib/fetchJson";

type AnchorRecordRow = {
  id: string;
  eventType: string;
  eventLabel: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityContext: string;
  payloadHash: string;
  chainStatus: string;
  txHash: string | null;
  anchoredAt: string | null;
  createdAt: string;
};

type AnchorResponse = {
  stats: {
    total: number;
    anchored: number;
    pending: number;
    failed: number;
    lastAnchoredAt: string | null;
    eventCounts: Record<string, number>;
  };
  records: AnchorRecordRow[];
};

function fmtDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("ko-KR");
}

export default function AdminAnchorsPage() {
  const [data, setData] = useState<AnchorResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAnchors() {
      try {
        const response = await fetch("/api/anchors");
        const result = await parseJsonResponse<AnchorResponse>(response);

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
          error instanceof Error ? error.message : "앵커링 기록을 불러오지 못했습니다."
        );
      }
    }

    void loadAnchors();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-[1200px] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">감사 앵커</h1>
          <p className="text-sm text-gray-500">
            예산 발행, 정책 스냅샷, 거래 판정, 정산 보고의 해시 앵커링 상태를
            확인합니다.
          </p>
        </div>

        {loadError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError}
            </CardContent>
          </Card>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-5">
              <div className="text-xs text-gray-500">전체 이벤트</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {data?.stats.total ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] bg-[#E8F7F4]/60">
            <CardContent className="p-5">
              <div className="text-xs text-gray-500">앵커 완료</div>
              <div className="mt-1 text-2xl font-semibold text-[#006B5D]">
                {data?.stats.anchored ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-5">
              <div className="text-xs text-gray-500">대기</div>
              <div className="mt-1 text-2xl font-semibold text-amber-600">
                {data?.stats.pending ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-5">
              <div className="text-xs text-gray-500">실패</div>
              <div className="mt-1 text-2xl font-semibold text-red-600">
                {data?.stats.failed ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-[#E5E7EB]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-5">
            <div>
              <div className="text-xs text-gray-500">예산 발행</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {data?.stats.eventCounts.BUDGET_ISSUED ?? 0}건
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">정책 스냅샷</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {data?.stats.eventCounts.POLICY_SNAPSHOT ?? 0}건
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">거래 판정</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {data?.stats.eventCounts.TRANSACTION_DECISION ?? 0}건
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">정산 보고</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {data?.stats.eventCounts.SETTLEMENT_REPORT ?? 0}건
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">마지막 앵커링</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {fmtDate(data?.stats.lastAnchoredAt ?? null)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardContent className="p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">최근 앵커링 기록</h2>
              <p className="text-sm text-gray-500">
                실제 결제 데이터 전체가 아니라 핵심 의사결정 이벤트의 해시만
                저장합니다.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">이벤트</th>
                    <th className="pb-2 font-medium">대상</th>
                    <th className="pb-2 font-medium">설명</th>
                    <th className="pb-2 font-medium">Payload Hash</th>
                    <th className="pb-2 font-medium">Tx Hash</th>
                    <th className="pb-2 font-medium text-center">상태</th>
                    <th className="pb-2 font-medium text-right">앵커 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.records.map((record) => (
                    <tr key={record.id} className="border-b border-gray-50">
                      <td className="py-3 text-gray-900">{record.eventLabel}</td>
                      <td className="py-3 text-gray-900">{record.entityLabel}</td>
                      <td className="py-3 text-gray-500">{record.entityContext}</td>
                      <td className="py-3 font-mono text-xs text-gray-500">
                        {record.payloadHash.slice(0, 18)}...
                      </td>
                      <td className="py-3 font-mono text-xs text-gray-500">
                        {record.txHash ? `${record.txHash.slice(0, 18)}...` : "-"}
                      </td>
                      <td className="py-3 text-center">
                        <StatusBadge status={record.chainStatus} />
                      </td>
                      <td className="py-3 text-right text-xs text-gray-400">
                        {fmtDate(record.anchoredAt)}
                      </td>
                    </tr>
                  ))}
                  {(!data || data.records.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-gray-400">
                        표시할 앵커링 기록이 없습니다.
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
