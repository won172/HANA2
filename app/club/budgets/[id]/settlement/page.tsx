"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  FileText,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseJsonResponse } from "@/lib/fetchJson";

type SettlementData = {
  budget: {
    id: string;
    name: string;
    organizationId: string;
    totalAmount: number;
    currentBalance: number;
    validUntil: string;
    organization: { name: string };
    issuerOrganization: { name: string };
  };
  settlement: {
    status: string;
    reportNote: string;
    reclaimAmount: number;
    updatedAt: string;
  } | null;
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
    recentApprovedTransactions: Array<{
      merchantName: string;
      itemDescription: string;
      amount: number;
      requestedCategory: string;
      createdAt: string | null;
    }>;
  };
};

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function BudgetSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<SettlementData | null>(null);
  const [reportNote, setReportNote] = useState("");
  const [reclaimAmount, setReclaimAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  async function fetchData() {
    const response = await fetch(`/api/budgets/${id}/settlement`);
    const result = await parseJsonResponse<SettlementData>(response);
    setData(result);
    setReportNote(result.settlement?.reportNote || "");
    setReclaimAmount(
      result.settlement?.reclaimAmount ?? result.summary.reclaimAmountSuggested
    );
  }

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        const response = await fetch(`/api/budgets/${id}/settlement`);
        const result = await parseJsonResponse<SettlementData>(response);

        if (!active) {
          return;
        }

        setData(result);
        setReportNote(result.settlement?.reportNote || "");
        setReclaimAmount(
          result.settlement?.reclaimAmount ?? result.summary.reclaimAmountSuggested
        );
        setLoadError("");
      } catch (error) {
        if (!active) {
          return;
        }

        setData(null);
        setLoadError(
          error instanceof Error ? error.message : "정산 정보를 불러오지 못했습니다."
        );
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit() {
    setSubmitError("");
    setSubmitMessage("");

    if (!reportNote.trim()) {
      setSubmitError("종료 보고 메모를 입력해 주세요.");
      return;
    }

    if (!Number.isFinite(reclaimAmount) || reclaimAmount < 0) {
      setSubmitError("환수 예정 금액을 다시 확인해 주세요.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/budgets/${id}/settlement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportNote: reportNote.trim(),
          reclaimAmount,
          status: "SUBMITTED",
        }),
      });

      await parseJsonResponse(response);
      await fetchData();
      setSubmitMessage("정산 보고가 저장되었습니다.");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "정산 보고 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <SidebarLayout userName="동아리" userRole="동아리/학생회">
        <div className="p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {loadError || "정산 정보를 불러오지 못했습니다."}
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout
      userName={data.budget.organization.name}
      userRole="동아리/학생회"
      orgId={data.budget.organizationId}
    >
      <div className="max-w-6xl p-6">
        <div className="mb-6">
          <Link
            href={`/club/budgets/${data.budget.id}?org=${data.budget.organizationId}`}
            className="mb-2 inline-flex text-sm text-gray-500 hover:text-gray-800"
          >
            ← 예산 상세로
          </Link>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">정산 / 종료 보고</h1>
            {data.settlement && <StatusBadge status={data.settlement.status} />}
          </div>
          <p className="text-sm text-gray-500">{data.budget.name}</p>
        </div>

        <Card className="mb-6 border-[#D5E2DE] bg-[#F7FBFA]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                집행 종료 이후 운영 보고를 남깁니다
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                사용 실적, 미집행 잔액, 환수 예정 금액을 함께 제출하면 관리자 검토와
                감사 앵커 기록으로 이어집니다.
              </p>
            </div>
            <div className="rounded-2xl border border-[#D5E2DE] bg-white px-4 py-3 text-sm text-gray-600">
              정산 기준일 {fmtDate(data.budget.validUntil)}
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">총 발행액</div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {fmt(data.summary.totalIssued)}원
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">총 사용액</div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {fmt(data.summary.totalUsed)}원
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">남은 잔액</div>
              <div className="mt-1 text-lg font-bold text-[#006B5D]">
                {fmt(data.summary.remainingBalance)}원
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">승인 거래</div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {data.summary.approvedCount}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">보류 / 반려</div>
              <div className="mt-1 text-lg font-bold text-amber-600">
                {data.summary.pendingCount} / {data.summary.rejectedCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">환수 예정</div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {fmt(reclaimAmount)}원
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card className="border-gray-200">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-[#006B5D]" />
                  <h2 className="font-semibold text-gray-900">카테고리별 사용 요약</h2>
                </div>
                <div className="space-y-3">
                  {data.summary.categoryBreakdown.map((item) => (
                    <div key={item.category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.category}</span>
                        <span className="font-medium text-gray-900">
                          {fmt(item.amount)}원
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-[#00A18F]"
                          style={{ width: `${Math.max(6, Math.round(item.ratio * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {data.summary.categoryBreakdown.length === 0 && (
                    <div className="text-sm text-gray-500">사용 완료 거래가 없습니다.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <WalletCards className="h-4 w-4 text-[#006B5D]" />
                  <h2 className="font-semibold text-gray-900">최근 승인 거래</h2>
                </div>
                <div className="space-y-3">
                  {data.summary.recentApprovedTransactions.map((transaction, index) => (
                    <div
                      key={`${transaction.merchantName}-${transaction.createdAt}-${index}`}
                      className="rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {transaction.merchantName}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {transaction.itemDescription}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {fmt(transaction.amount)}원
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {transaction.requestedCategory}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.summary.recentApprovedTransactions.length === 0 && (
                    <div className="text-sm text-gray-500">최근 승인 거래가 없습니다.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#006B5D]" />
                <h2 className="font-semibold text-gray-900">종료 보고서 작성</h2>
              </div>

              {(submitError || submitMessage) && (
                <div
                  className={`mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
                    submitError
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError || submitMessage}</span>
                </div>
              )}

              <div className="space-y-5">
                <div className="rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                    <CalendarDays className="h-4 w-4 text-[#006B5D]" />
                    보고 작성 가이드
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>1. 행사/사업 종료 결과와 집행 목적 달성 여부를 적습니다.</div>
                    <div>2. 남은 잔액이 발생한 이유와 환수 예정 금액 근거를 적습니다.</div>
                    <div>3. 보류/반려 거래가 있으면 후속 조치 계획을 남깁니다.</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-gray-700">환수 예정 금액</Label>
                  <Input
                    type="number"
                    value={reclaimAmount}
                    onChange={(event) => setReclaimAmount(Number(event.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-700">종료 보고 메모</Label>
                  <Textarea
                    value={reportNote}
                    onChange={(event) => setReportNote(event.target.value)}
                    className="mt-1 min-h-40"
                    placeholder="행사 종료 내용, 미집행 사유, 환수 예정 금액 근거, 보류/반려 거래 후속 조치를 적어주세요."
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="cursor-pointer"
                  >
                    {saving ? "저장 중..." : "정산 보고 제출"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
