"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  POLICY_TEMPLATES,
  recommendPolicyTemplate,
} from "@/lib/policyTemplates";
import { parseJsonResponse } from "@/lib/fetchJson";

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
  organization: { name: string };
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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [templateKeys, setTemplateKeys] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");

  async function fetchRequests() {
    try {
      const response = await fetch("/api/budget-requests");
      const data = await parseJsonResponse<BudgetRequest[]>(response);
      setLoadError("");
      setRequests(data);
    } catch (error) {
      setRequests([]);
      setLoadError(
        error instanceof Error ? error.message : "예산 신청 목록을 불러오지 못했습니다."
      );
    }
  }

  useEffect(() => {
    void fetchRequests();
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessingId(id);

    try {
      const response = await fetch(`/api/budget-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewerComment: reviewComments[id],
          ...(action === "approve"
            ? { templateKey: templateKeys[id] }
            : {}),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "처리에 실패했습니다.");
        return;
      }

      await fetchRequests();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">예산 신청 검토</h1>
          <p className="text-sm text-gray-500">
            동아리 예산 신청을 검토하고 승인 시 예산과 정책을 자동 발행합니다.
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
          {requests.map((request) => (
            <Card key={request.id} className="border-gray-200">
              <CardContent className="p-5">
                {(() => {
                  const categories = parseCategories(request.requestedCategories)
                    .filter((category): category is string => typeof category === "string");
                  const selectedTemplateKey =
                    templateKeys[request.id] ||
                    recommendPolicyTemplate(categories).key;

                  return (
                    <>
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
                    <div className="text-xs text-gray-500">{request.organization.name}</div>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={`${request.id}-${category}`}
                      className="rounded bg-[#FFF3E8] px-2 py-1 text-xs text-[#E26F12]"
                    >
                      {String(category)}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-gray-500">
                  요청 사용 기간 {new Date(request.requestedPeriodStart).toLocaleDateString("ko-KR")}
                  {" ~ "}
                  {new Date(request.requestedPeriodEnd).toLocaleDateString("ko-KR")}
                </div>

                <div className="mt-4">
                  <Textarea
                    value={reviewComments[request.id] ?? request.reviewerComment ?? ""}
                    onChange={(event) =>
                      setReviewComments((previous) => ({
                        ...previous,
                        [request.id]: event.target.value,
                      }))
                    }
                    placeholder="승인/반려 의견을 입력하세요."
                    className="min-h-20"
                  />
                </div>

                {request.status === "PENDING" && (
                  <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      승인 시 적용할 정책 템플릿
                    </label>
                    <select
                      value={selectedTemplateKey}
                      onChange={(event) =>
                        setTemplateKeys((previous) => ({
                          ...previous,
                          [request.id]: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F58220]"
                    >
                      {POLICY_TEMPLATES.map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {request.issuedBudget && (
                  <div className="mt-3 text-sm text-[#E26F12]">
                    발행 예산: {request.issuedBudget.name}
                  </div>
                )}

                {request.status === "PENDING" && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => handleAction(request.id, "approve")}
                      disabled={processingId === request.id}
                      className="cursor-pointer bg-[#F58220] text-white hover:bg-[#E26F12]"
                    >
                      승인 후 예산 발행
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction(request.id, "reject")}
                      disabled={processingId === request.id}
                      className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50"
                    >
                      반려
                    </Button>
                  </div>
                )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          ))}

          {requests.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                검토할 신청서가 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
