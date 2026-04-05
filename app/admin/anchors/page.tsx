"use client";

import { useEffect, useMemo, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type EventFilter =
  | "ALL"
  | "BUDGET_ISSUED"
  | "POLICY_SNAPSHOT"
  | "TRANSACTION_DECISION"
  | "SETTLEMENT_REPORT"
  | "POLICY_EXCEPTION_REQUEST";

type StatusFilter = "ALL" | "ANCHORED" | "PENDING" | "FAILED";

function fmtDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("ko-KR");
}

function shortenHash(value: string | null, size = 16) {
  if (!value) {
    return "-";
  }

  return `${value.slice(0, size)}...`;
}

export default function AdminAnchorsPage() {
  const [data, setData] = useState<AnchorResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [copiedLabel, setCopiedLabel] = useState("");

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

  async function copyText(label: string, value: string | null) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel(""), 1500);
    } catch {
      setCopiedLabel("복사 실패");
      window.setTimeout(() => setCopiedLabel(""), 1500);
    }
  }

  const filteredRecords = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.records.filter((record) => {
      const matchesEvent =
        eventFilter === "ALL" || record.eventType === eventFilter;
      const matchesStatus =
        statusFilter === "ALL" || record.chainStatus === statusFilter;
      const matchesQuery =
        query.trim().length === 0 ||
        `${record.eventLabel} ${record.entityLabel} ${record.entityContext}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());

      return matchesEvent && matchesStatus && matchesQuery;
    });
  }, [data, eventFilter, query, statusFilter]);

  const eventOptions: Array<{ key: EventFilter; label: string }> = [
    { key: "ALL", label: "전체 이벤트" },
    { key: "BUDGET_ISSUED", label: "예산 발행" },
    { key: "POLICY_SNAPSHOT", label: "정책 스냅샷" },
    { key: "TRANSACTION_DECISION", label: "거래 판정" },
    { key: "SETTLEMENT_REPORT", label: "정산 보고" },
    { key: "POLICY_EXCEPTION_REQUEST", label: "예외 신청" },
  ];

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-[1200px] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">감사 앵커</h1>
          <p className="text-sm text-gray-500">
            운영자는 이벤트 요약을 먼저 보고, 필요할 때만 해시와 트랜잭션 값을 펼쳐
            확인하면 됩니다.
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

        <Card className="mb-6 border-[#D5E2DE] bg-white">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이벤트, 대상, 설명 검색"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
            >
              <option value="ALL">전체 상태</option>
              <option value="ANCHORED">앵커 완료</option>
              <option value="PENDING">대기</option>
              <option value="FAILED">실패</option>
            </select>
            <select
              value={eventFilter}
              onChange={(event) =>
                setEventFilter(event.target.value as EventFilter)
              }
              className="h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
            >
              {eventOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="mb-6 border-[#E5E7EB]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-6">
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
              <div className="text-xs text-gray-500">예외 신청</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {data?.stats.eventCounts.POLICY_EXCEPTION_REQUEST ?? 0}건
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">앵커링 기록</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {filteredRecords.length}건 표시 중 · 필요할 때만 상세 해시를 펼쳐 확인합니다.
                </p>
              </div>
              {copiedLabel && <div className="text-xs text-[#006B5D]">{copiedLabel}</div>}
            </div>

            <div className="space-y-3">
              {filteredRecords.map((record) => (
                <details
                  key={record.id}
                  className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <div className="font-medium text-gray-900">{record.eventLabel}</div>
                          <StatusBadge status={record.chainStatus} />
                        </div>
                        <div className="text-sm text-gray-700">{record.entityLabel}</div>
                        <div className="mt-1 text-xs text-gray-500">{record.entityContext}</div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{fmtDate(record.anchoredAt || record.createdAt)}</div>
                        <div className="mt-1">
                          Payload {shortenHash(record.payloadHash)} · Tx{" "}
                          {shortenHash(record.txHash)}
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] text-gray-500">Payload Hash</div>
                      <div className="mt-1 break-all font-mono text-xs text-gray-700">
                        {record.payloadHash}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyText("Payload Hash 복사 완료", record.payloadHash)}
                        className="mt-2 cursor-pointer border-[#D5E2DE] bg-white text-xs text-gray-700 hover:bg-[#F7FBFA]"
                      >
                        Payload Hash 복사
                      </Button>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500">Tx Hash</div>
                      <div className="mt-1 break-all font-mono text-xs text-gray-700">
                        {record.txHash || "기록 없음"}
                      </div>
                      {record.txHash && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => copyText("Tx Hash 복사 완료", record.txHash)}
                          className="mt-2 cursor-pointer border-[#D5E2DE] bg-white text-xs text-gray-700 hover:bg-[#F7FBFA]"
                        >
                          Tx Hash 복사
                        </Button>
                      )}
                    </div>
                  </div>
                </details>
              ))}

              {filteredRecords.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#D5E2DE] bg-[#F7FBFA] px-4 py-10 text-center text-sm text-gray-500">
                  조건에 맞는 앵커링 기록이 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
