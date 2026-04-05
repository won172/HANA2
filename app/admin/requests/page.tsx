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
import { formatCategoryList, getCategoryLabel } from "@/lib/categoryLabels";
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

type AiPolicyDraft = {
  displayName: string;
  summary: string;
  policySource: "AI";
  aiConfidence: number;
  templateKey: string;
  allowedCategories: string[];
  blockedCategories: string[];
  blockedKeywords: string[];
  allowedKeywords: string[];
  categoryAutoApproveRules: Record<string, number>;
  eventCategories: string[];
  autoApproveLimit: number;
  manualReviewLimit: number;
  allowNewMerchant: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [policyPreviews, setPolicyPreviews] = useState<Record<string, AiPolicyDraft>>({});
  const [policyLoadingIds, setPolicyLoadingIds] = useState<Record<string, boolean>>({});
  const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");

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

      const response = await fetch(`/api/budget-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewerComment: reviewComments[id],
          ...(action === "approve"
            ? {
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

  async function handlePreviewPolicy(request: BudgetRequest) {
    setPolicyLoadingIds((previous) => ({ ...previous, [request.id]: true }));
    setPolicyErrors((previous) => ({ ...previous, [request.id]: "" }));

    try {
      const response = await fetch("/api/ai-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: request.title,
          purpose: request.purpose,
          totalAmount: request.requestedAmount,
          validFrom: request.requestedPeriodStart,
          validUntil: request.requestedPeriodEnd,
          requestedCategories: parseRequestedCategories(request.requestedCategories),
        }),
      });

      const result = await parseJsonResponse<AiPolicyDraft>(response);
      setPolicyPreviews((previous) => ({ ...previous, [request.id]: result }));
    } catch (error) {
      setPolicyErrors((previous) => ({
        ...previous,
        [request.id]:
          error instanceof Error ? error.message : "AI 정책 미리보기를 불러오지 못했습니다.",
      }));
    } finally {
      setPolicyLoadingIds((previous) => ({ ...previous, [request.id]: false }));
    }
  }

  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
  const rejectedCount = requests.filter((request) => request.status === "REJECTED").length;
  const filteredRequests =
    statusFilter === "ALL"
      ? requests
      : requests.filter((request) => request.status === statusFilter);
  const filterOptions: Array<{
    key: StatusFilter;
    label: string;
    count: number;
  }> = [
    { key: "PENDING", label: "검토 대기", count: pendingRequests.length },
    { key: "APPROVED", label: "발행 완료", count: approvedCount },
    { key: "REJECTED", label: "반려", count: rejectedCount },
    { key: "ALL", label: "전체", count: requests.length },
  ];

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">예산 신청 검토</h1>
          <p className="text-sm text-gray-500">
            신청서를 승인하면 예산과 AI 정책이 즉시 발행되고, 반려 시 검토 의견이
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
                  신청서 내용을 기준으로 승인 시 AI 정책을 생성하고, `Budget + Policy +
                  LedgerEntry + AnchorRecord`를 한 번에 연결합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-[#D5E2DE] bg-white">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStatusFilter(option.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    statusFilter === option.key
                      ? "bg-[#00857A] text-white"
                      : "bg-[#F7FBFA] text-gray-600 hover:bg-[#E8F7F4] hover:text-[#006B5D]"
                  }`}
                >
                  {option.label} {option.count}건
                </button>
              ))}
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
            filteredRequests.map((request) => {
              const categories = parseRequestedCategories(request.requestedCategories);
              const preview = policyPreviews[request.id];
              const policyLoading = Boolean(policyLoadingIds[request.id]);
              const policyError = policyErrors[request.id];

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

                    <div className="mb-3 grid gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4 md:grid-cols-4">
                      <div>
                        <div className="text-[11px] text-gray-500">조직</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          {request.organization.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">기간</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          {new Date(request.requestedPeriodStart).toLocaleDateString("ko-KR")}
                          {" ~ "}
                          {new Date(request.requestedPeriodEnd).toLocaleDateString("ko-KR")}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">요청 금액</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          {fmt(request.requestedAmount)}원
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">정책 생성 방식</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          AI 정책 자동 생성
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <span
                          key={`${request.id}-${category}`}
                          className="rounded bg-[#E8F7F4] px-2 py-1 text-xs text-[#006B5D]"
                        >
                          {getCategoryLabel(category)}
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
                      <span>승인 시 신청 내용 기준 AI 정책 생성</span>
                    </div>

                    {request.status === "PENDING" && (
                      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                        <div className="rounded-2xl border border-[#D5E2DE] bg-white p-4">
                          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Sparkles className="h-4 w-4 text-[#006B5D]" />
                            승인 시 생성할 AI 정책
                          </label>
                          <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] p-4 text-sm text-gray-600">
                            신청 제목, 목적, 금액, 기간을 기준으로 승인 시점에 AI 정책을
                            생성합니다. 승인 전에 같은 입력값으로 정책 초안을 미리
                            확인할 수 있습니다.
                          </div>
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="outline"
                              className="cursor-pointer"
                              disabled={policyLoading}
                              onClick={() => handlePreviewPolicy(request)}
                            >
                              {policyLoading
                                ? "AI 정책 생성 중..."
                                : preview
                                  ? "AI 정책 다시 생성"
                                  : "AI 정책 미리 보기"}
                            </Button>
                          </div>
                          {policyError && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {policyError}
                            </div>
                          )}
                          {preview && (
                            <details className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] p-3">
                              <summary className="cursor-pointer text-sm font-medium text-gray-900">
                                생성된 AI 정책 보기
                              </summary>
                              <div className="mt-3 space-y-3 text-sm text-gray-600">
                                <div>{preview.summary}</div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    허용 카테고리:{" "}
                                    {formatCategoryList(preview.allowedCategories)}
                                  </div>
                                  <div>
                                    제한 카테고리:{" "}
                                    {formatCategoryList(preview.blockedCategories, "없음")}
                                  </div>
                                  <div>
                                    자동 승인 한도: {fmt(preview.autoApproveLimit)}원
                                  </div>
                                  <div>
                                    수동 검토 기준: {fmt(preview.manualReviewLimit)}원
                                  </div>
                                  <div>
                                    행사 적용:{" "}
                                    {formatCategoryList(preview.eventCategories, "없음")}
                                  </div>
                                  <div>
                                    신규 가맹점:{" "}
                                    {preview.allowNewMerchant ? "허용" : "기존 등록만"}
                                  </div>
                                </div>
                                {preview.blockedKeywords.length > 0 && (
                                  <div>
                                    금지 키워드: {preview.blockedKeywords.join(", ")}
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
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
                              발행 기간:{" "}
                              {new Date(request.requestedPeriodStart).toLocaleDateString("ko-KR")}
                              {" ~ "}
                              {new Date(request.requestedPeriodEnd).toLocaleDateString("ko-KR")}
                            </div>
                            {preview ? (
                              <>
                                <div>
                                  자동 승인 한도: {fmt(preview.autoApproveLimit)}원
                                </div>
                                <div>
                                  수동 검토 기준: {fmt(preview.manualReviewLimit)}원
                                </div>
                                <div>
                                  허용 카테고리: {formatCategoryList(preview.allowedCategories)}
                                </div>
                              </>
                            ) : (
                              <div>
                                승인하면 AI가 신청 목적에 맞는 허용 카테고리와 한도를
                                자동 설정합니다.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {request.status === "PENDING" ? (
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
                    ) : null}

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

          {!loading && filteredRequests.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                선택한 상태의 신청서가 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
