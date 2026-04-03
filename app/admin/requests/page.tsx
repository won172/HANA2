"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  FileCheck2,
  Sparkles,
  WalletCards,
} from "lucide-react";
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
import {
  getRequestStatusLabel,
  parseRequestedCategories,
} from "@/lib/budgetRequests";

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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [templateKeys, setTemplateKeys] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchRequests() {
    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRequests();
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessingId(id);

    try {
      const request = requests.find((item) => item.id === id);
      const categories = request
        ? parseRequestedCategories(request.requestedCategories)
        : [];
      const recommendedTemplate = recommendPolicyTemplate(categories);

      const response = await fetch(`/api/budget-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewerComment: reviewComments[id],
          ...(action === "approve"
            ? {
                templateKey: templateKeys[id] || recommendedTemplate.key,
                title: request?.title,
                totalAmount: request?.requestedAmount,
                validFrom: request?.requestedPeriodStart,
                validUntil: request?.requestedPeriodEnd,
              }
            : {}),
        }),
      });

      await parseJsonResponse(response);
      await fetchRequests();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
  const rejectedCount = requests.filter((request) => request.status === "REJECTED").length;

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">예산 신청 검토</h1>
          <p className="text-sm text-gray-500">
            신청서를 승인하면 예산과 기본 정책이 즉시 발행되고, 반려 시 검토 의견이
            동아리 화면에 바로 노출됩니다.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">검토 대기</div>
              <div className="mt-1 text-xl font-bold text-amber-600">
                {pendingRequests.length}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">발행 완료</div>
              <div className="mt-1 text-xl font-bold text-[#006B5D]">
                {approvedCount}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">반려</div>
              <div className="mt-1 text-xl font-bold text-red-600">
                {rejectedCount}건
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-[#D5E2DE] bg-[#F7FBFA]">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F7F4] text-[#006B5D]">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  운영형 예산 발행 플로우
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  요청 카테고리를 기준으로 추천 템플릿을 제안하고, 승인 시 `Budget +
                  Policy + LedgerEntry + AnchorRecord`가 한 번에 연결됩니다.
                </p>
              </div>
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
            requests.map((request) => {
              const categories = parseRequestedCategories(request.requestedCategories);
              const selectedTemplateKey =
                templateKeys[request.id] || recommendPolicyTemplate(categories).key;
              const selectedTemplate =
                POLICY_TEMPLATES.find((template) => template.key === selectedTemplateKey) ||
                POLICY_TEMPLATES[0];

              return (
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
                        <div className="text-xs text-gray-500">
                          {request.organization.name}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {getRequestStatusLabel(request.status)}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <span
                          key={`${request.id}-${category}`}
                          className="rounded bg-[#E8F7F4] px-2 py-1 text-xs text-[#006B5D]"
                        >
                          {category}
                        </span>
                      ))}
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(request.requestedPeriodStart).toLocaleDateString("ko-KR")}
                        {" ~ "}
                        {new Date(request.requestedPeriodEnd).toLocaleDateString("ko-KR")}
                      </span>
                      <span>추천 템플릿: {selectedTemplate.label}</span>
                    </div>

                    {request.status === "PENDING" && (
                      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                        <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Sparkles className="h-4 w-4 text-[#006B5D]" />
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
                            className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                          >
                            {POLICY_TEMPLATES.map((template) => (
                              <option key={template.key} value={template.key}>
                                {template.label}
                              </option>
                            ))}
                          </select>
                          <div className="mt-3 text-sm text-gray-600">
                            {selectedTemplate.description}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedTemplate.allowedCategories.map((category) => (
                              <span
                                key={`${request.id}-${selectedTemplate.key}-${category}`}
                                className="rounded-full bg-[#F7FBFA] px-2.5 py-1 text-[11px] text-[#006B5D]"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] p-4">
                          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                            <WalletCards className="h-4 w-4 text-[#006B5D]" />
                            승인 시 발행 내용
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div>예산명: {request.title}</div>
                            <div>발행금액: {fmt(request.requestedAmount)}원</div>
                            <div>
                              기본 자동승인 한도: {fmt(selectedTemplate.autoApproveLimit)}원
                            </div>
                            <div>
                              수동 검토 기준: {fmt(selectedTemplate.manualReviewLimit)}원
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <Textarea
                        value={reviewComments[request.id] ?? request.reviewerComment ?? ""}
                        onChange={(event) =>
                          setReviewComments((previous) => ({
                            ...previous,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="승인 또는 반려 의견을 남겨 주세요."
                        className="min-h-20"
                      />
                    </div>

                    {request.reviewerComment && request.status !== "PENDING" && (
                      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <span>{request.reviewerComment}</span>
                      </div>
                    )}

                    {request.issuedBudget && (
                      <div className="mt-4 rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] px-4 py-3 text-sm text-gray-700">
                        발행 예산: <strong>{request.issuedBudget.name}</strong>
                      </div>
                    )}

                    {request.status === "PENDING" && (
                      <div className="mt-4 flex gap-2">
                        <Button
                          onClick={() => handleAction(request.id, "approve")}
                          disabled={processingId === request.id}
                          className="cursor-pointer"
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
                  </CardContent>
                </Card>
              );
            })}

          {!loading && requests.length === 0 && (
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
