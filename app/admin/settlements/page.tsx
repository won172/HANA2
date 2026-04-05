"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  FileCheck2,
  Funnel,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseJsonResponse } from "@/lib/fetchJson";

type SettlementRow = {
  budget: {
    id: string;
    name: string;
    currentBalance: number;
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
    remainingBalance: number;
    totalRejected: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    reclaimAmountSuggested: number;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      ratio: number;
    }>;
  };
};

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

type StatusFilter = "ALL" | "SUBMITTED" | "REVIEWED";

export default function AdminSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("SUBMITTED");
  const [processingBudgetId, setProcessingBudgetId] = useState<string | null>(null);
  const [draftReclaim, setDraftReclaim] = useState<Record<string, number>>({});

  async function loadRows() {
    setLoading(true);

    try {
      const response = await fetch("/api/settlements");
      const data = await parseJsonResponse<SettlementRow[]>(response);
      setRows(data);
      setLoadError("");
    } catch (error) {
      setRows([]);
      setLoadError(
        error instanceof Error ? error.message : "정산 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  async function updateSettlementStatus(
    budgetId: string,
    nextStatus: "SUBMITTED" | "REVIEWED"
  ) {
    setProcessingBudgetId(budgetId);

    try {
      const target = rows.find((row) => row.budget.id === budgetId);
      const reclaimAmount =
        draftReclaim[budgetId] ?? target?.settlement.reclaimAmount ?? 0;

      const response = await fetch("/api/settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetId,
          status: nextStatus,
          reclaimAmount,
        }),
      });
      await parseJsonResponse(response);
      await loadRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "정산 상태 업데이트에 실패했습니다.");
    } finally {
      setProcessingBudgetId(null);
    }
  }

  const filteredRows =
    statusFilter === "ALL"
      ? rows
      : rows.filter((row) => row.settlement.status === statusFilter);

  const submittedCount = rows.filter(
    (row) => row.settlement.status === "SUBMITTED"
  ).length;
  const reviewedCount = rows.filter(
    (row) => row.settlement.status === "REVIEWED"
  ).length;
  const totalReclaim = rows.reduce(
    (sum, row) => sum + row.settlement.reclaimAmount,
    0
  );

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-6xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
          <p className="text-sm text-gray-500">
            검토 대기를 먼저 보고, 필요할 때 완료된 정산까지 다시 확인하는 구조로
            정리했습니다.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">검토 대기</div>
              <div className="mt-1 text-xl font-bold text-amber-600">
                {submittedCount}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">검토 완료</div>
              <div className="mt-1 text-xl font-bold text-[#006B5D]">
                {reviewedCount}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">총 환수 예정</div>
              <div className="mt-1 text-xl font-bold text-gray-900">
                {fmt(totalReclaim)}원
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-[#D5E2DE] bg-[#F7FBFA]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F7F4] text-[#006B5D]">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  정산 검토 운영 가이드
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  `SUBMITTED` 상태의 종료 보고를 검토한 뒤 금액/메모를 확인하고
                  `REVIEWED`로 확정하세요. 총 환수 예정은 현재 입력값이고, 추천 환수는
                  시스템이 계산한 기준값입니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Funnel className="h-4 w-4 text-[#006B5D]" />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-10 rounded-xl border border-[#D5E2DE] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
              >
                <option value="ALL">전체 상태</option>
                <option value="SUBMITTED">검토 대기</option>
                <option value="REVIEWED">검토 완료</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {loadError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {loading && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                로딩 중...
              </CardContent>
            </Card>
          )}

          {!loading &&
            filteredRows.map((row) => {
              const reclaimDraft =
                draftReclaim[row.budget.id] ?? row.settlement.reclaimAmount;

              return (
                <Card key={row.budget.id} className="border-gray-200">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h2 className="font-semibold text-gray-900">{row.budget.name}</h2>
                          <StatusBadge status={row.settlement.status} />
                        </div>
                        <p className="text-sm text-gray-500">
                          {row.budget.organization.name} · 발행{" "}
                          {row.budget.issuerOrganization.name}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(row.settlement.updatedAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">총 발행액</div>
                        <div className="font-semibold text-gray-900">
                          {fmt(row.summary.totalIssued)}원
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">총 사용액</div>
                        <div className="font-semibold text-gray-900">
                          {fmt(row.summary.totalUsed)}원
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">남은 잔액</div>
                        <div className="font-semibold text-[#006B5D]">
                          {fmt(row.summary.remainingBalance)}원
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">승인 / 보류 / 반려</div>
                        <div className="font-semibold text-gray-900">
                          {row.summary.approvedCount} / {row.summary.pendingCount} /{" "}
                          {row.summary.rejectedCount}
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">환수 예정</div>
                        <div className="font-semibold text-gray-900">
                          {fmt(reclaimDraft)}원
                        </div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">추천 환수</div>
                        <div className="font-semibold text-gray-900">
                          {fmt(row.summary.reclaimAmountSuggested)}원
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                          <ReceiptText className="h-4 w-4 text-[#006B5D]" />
                          카테고리별 사용 요약
                        </div>
                        <div className="space-y-2">
                          {row.summary.categoryBreakdown.map((category) => (
                            <div key={`${row.budget.id}-${category.category}`}>
                              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                <span>{category.category}</span>
                                <span>{fmt(category.amount)}원</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-gray-100">
                                <div
                                  className="h-2 rounded-full bg-[#00A18F]"
                                  style={{
                                    width: `${Math.max(
                                      6,
                                      Math.round(category.ratio * 100)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                          {row.summary.categoryBreakdown.length === 0 && (
                            <div className="text-xs text-gray-500">
                              카테고리 집계 데이터가 없습니다.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                          <WalletCards className="h-4 w-4 text-[#006B5D]" />
                          정산 검토 입력
                        </div>
                        <div className="mb-3 text-sm text-gray-700">
                          <div className="mb-1 text-xs text-gray-500">환수 예정 금액</div>
                          <Input
                            type="number"
                            value={reclaimDraft}
                            onChange={(event) =>
                              setDraftReclaim((previous) => ({
                                ...previous,
                                [row.budget.id]: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="mb-3 rounded-lg bg-[#F8F9FB] px-3 py-3 text-sm text-gray-700">
                          {reclaimDraft === row.summary.reclaimAmountSuggested
                            ? "현재 입력값이 추천 환수 금액과 같습니다."
                            : reclaimDraft > row.summary.reclaimAmountSuggested
                              ? `추천 환수보다 ${fmt(
                                  reclaimDraft - row.summary.reclaimAmountSuggested
                                )}원 높게 설정했습니다. 근거 메모를 함께 확인하세요.`
                              : `추천 환수보다 ${fmt(
                                  row.summary.reclaimAmountSuggested - reclaimDraft
                                )}원 낮게 설정했습니다. 예외 사유 확인이 필요합니다.`}
                        </div>
                        <div className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700">
                          <div className="mb-1 text-xs text-gray-500">정산 메모</div>
                          {row.settlement.reportNote}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {row.settlement.status === "SUBMITTED" ? (
                            <Button
                              onClick={() =>
                                updateSettlementStatus(row.budget.id, "REVIEWED")
                              }
                              disabled={processingBudgetId === row.budget.id}
                              className="cursor-pointer"
                            >
                              <ShieldCheck className="mr-1 h-4 w-4" />
                              정산 확정
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() =>
                                updateSettlementStatus(row.budget.id, "SUBMITTED")
                              }
                              disabled={processingBudgetId === row.budget.id}
                              className="cursor-pointer"
                            >
                              <RotateCcw className="mr-1 h-4 w-4" />
                              다시 검토 대기로
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          {!loading && filteredRows.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                <div className="mb-2 flex justify-center">
                  <CircleAlert className="h-5 w-5 text-gray-400" />
                </div>
                표시할 정산 보고가 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
