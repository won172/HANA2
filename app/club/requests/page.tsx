"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type BudgetRequest = {
  id: string;
  title: string;
  purpose: string;
  requestedAmount: number;
  requestedCategories: string;
  requestedPeriodStart: string;
  requestedPeriodEnd: string;
  status: string;
  reviewerComment: string | null;
  createdAt: string;
  issuedBudget: { id: string; name: string } | null;
};

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function parseCategories(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ClubRequestsPageContent() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org") || "org-stats";
  const [requests, setRequests] = useState<BudgetRequest[]>([]);

  useEffect(() => {
    fetch(`/api/budget-requests?organizationId=${orgId}`)
      .then((response) => response.json())
      .then(setRequests);
  }, [orgId]);

  return (
    <SidebarLayout userName="동아리" userRole="동아리/학생회" orgId={orgId}>
      <div className="max-w-4xl p-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">예산 신청 내역</h1>
            <p className="text-sm text-gray-500">
              신청 상태와 검토 의견을 확인하고 필요 시 새 신청서를 작성합니다.
            </p>
          </div>
          <Link href={`/club/requests/new?org=${orgId}`}>
            <Button className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800">
              + 새 신청
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id} className="border-gray-200">
              <CardContent className="p-5">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{request.title}</h2>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="text-sm text-gray-600">{request.purpose}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {fmt(request.requestedAmount)}원
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {parseCategories(request.requestedCategories).map((category) => (
                    <span
                      key={`${request.id}-${category}`}
                      className="rounded bg-teal-50 px-2 py-1 text-xs text-teal-700"
                    >
                      {String(category)}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-gray-500">
                  사용 예정 기간 {new Date(request.requestedPeriodStart).toLocaleDateString("ko-KR")}
                  {" ~ "}
                  {new Date(request.requestedPeriodEnd).toLocaleDateString("ko-KR")}
                </div>

                {request.reviewerComment && (
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    검토 의견: {request.reviewerComment}
                  </div>
                )}

                {request.issuedBudget && (
                  <div className="mt-3">
                    <Link
                      href={`/club/budgets/${request.issuedBudget.id}?org=${orgId}`}
                      className="text-sm font-medium text-teal-700 hover:text-teal-800"
                    >
                      발행된 예산 보기 →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {requests.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                아직 등록된 예산 신청이 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}

export default function ClubRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      }
    >
      <ClubRequestsPageContent />
    </Suspense>
  );
}
