"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SettlementData = {
  budget: {
    id: string;
    name: string;
    organizationId: string;
    organization: { name: string };
  };
  settlement: {
    status: string;
    reportNote: string;
    reclaimAmount: number;
  } | null;
  summary: {
    totalIssued: number;
    totalUsed: number;
    totalRejected: number;
    pendingCount: number;
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

  async function fetchData() {
    const response = await fetch(`/api/budgets/${id}/settlement`);
    const result: SettlementData = await response.json();
    setData(result);
    setReportNote(result.settlement?.reportNote || "");
    setReclaimAmount(
      result.settlement?.reclaimAmount ?? result.summary.reclaimAmountSuggested
    );
  }

  useEffect(() => {
    void fetchData();
  }, [id]);

  if (!data) {
    return (
      <SidebarLayout userName="동아리" userRole="동아리/학생회">
        <div className="flex h-64 items-center justify-center text-gray-400">
          로딩 중...
        </div>
      </SidebarLayout>
    );
  }

  async function handleSubmit() {
    if (!reportNote.trim()) {
      alert("종료 보고 메모를 입력하세요.");
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

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "정산 제출 실패");
        return;
      }

      await fetchData();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidebarLayout
      userName={data.budget.organization.name}
      userRole="동아리/학생회"
      orgId={data.budget.organizationId}
    >
      <div className="max-w-5xl p-6">
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

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card className="border-gray-200"><CardContent className="p-4"><div className="text-xs text-gray-500">총 발행액</div><div className="text-lg font-bold text-gray-900">{fmt(data.summary.totalIssued)}원</div></CardContent></Card>
          <Card className="border-gray-200"><CardContent className="p-4"><div className="text-xs text-gray-500">총 사용액</div><div className="text-lg font-bold text-gray-900">{fmt(data.summary.totalUsed)}원</div></CardContent></Card>
          <Card className="border-gray-200"><CardContent className="p-4"><div className="text-xs text-gray-500">총 반려액</div><div className="text-lg font-bold text-red-600">{fmt(data.summary.totalRejected)}원</div></CardContent></Card>
          <Card className="border-gray-200"><CardContent className="p-4"><div className="text-xs text-gray-500">보류 거래 수</div><div className="text-lg font-bold text-amber-600">{data.summary.pendingCount}건</div></CardContent></Card>
          <Card className="border-gray-200"><CardContent className="p-4"><div className="text-xs text-gray-500">환수 예정 금액</div><div className="text-lg font-bold text-gray-900">{fmt(reclaimAmount)}원</div></CardContent></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h2 className="mb-3 font-semibold text-gray-900">카테고리별 사용 비율</h2>
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
                        className="h-2 rounded-full bg-teal-400"
                        style={{ width: `${Math.round(item.ratio * 100)}%` }}
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
              <div className="space-y-4">
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
                    className="mt-1 min-h-32"
                    placeholder="행사 종료 내용, 미집행 사유, 환수 예정 금액 근거를 적어주세요."
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800"
                  >
                    {saving ? "제출 중..." : "정산 보고 제출"}
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
