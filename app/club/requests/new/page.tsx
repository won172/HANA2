"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CircleAlert, FileCheck2, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseJsonResponse } from "@/lib/fetchJson";
import {
  getRecommendedTemplateForRequest,
  REQUEST_CATEGORIES,
} from "@/lib/budgetRequests";

type Organization = {
  id: string;
  name: string;
};

function ClubRequestNewPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialOrgId = searchParams.get("org") || "org-stats";
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState(initialOrgId);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requestedAmount, setRequestedAmount] = useState(500000);
  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 30);
  const [requestedPeriodStart, setRequestedPeriodStart] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [requestedPeriodEnd, setRequestedPeriodEnd] = useState(
    defaultEndDate.toISOString().split("T")[0]
  );
  const [requestedCategories, setRequestedCategories] = useState<string[]>([
    "FOOD",
    "SUPPLIES",
  ]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const recommendedTemplate = getRecommendedTemplateForRequest(requestedCategories);

  useEffect(() => {
    fetch("/api/organizations")
      .then((response) =>
        parseJsonResponse<Array<{ id: string; name: string; type: string }>>(response)
      )
      .then((data) => {
        const clubs = data
          .filter((organization) => organization.type === "CLUB")
          .map(({ id, name }) => ({ id, name }));
        setOrganizations(clubs);
        if (!clubs.some((organization) => organization.id === initialOrgId)) {
          setOrganizationId(clubs[0]?.id || "");
        }
      })
      .catch(() => {
        setOrganizations([]);
        setSubmitError("조직 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      });
  }, [initialOrgId]);

  function toggleCategory(category: string) {
    setRequestedCategories((previous) =>
      previous.includes(category)
        ? previous.filter((item) => item !== category)
        : [...previous, category]
    );
  }

  async function handleSubmit() {
    setSubmitError("");

    if (
      !organizationId ||
      !title.trim() ||
      !purpose.trim() ||
      !requestedPeriodEnd ||
      requestedCategories.length === 0
    ) {
      setSubmitError("필수 항목을 모두 입력해 주세요.");
      return;
    }

    if (requestedAmount <= 0) {
      setSubmitError("신청 금액은 0보다 커야 합니다.");
      return;
    }

    if (requestedPeriodStart > requestedPeriodEnd) {
      setSubmitError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/budget-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title: title.trim(),
          purpose: purpose.trim(),
          requestedAmount,
          requestedCategories,
          requestedPeriodStart,
          requestedPeriodEnd,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = "예산 신청 등록에 실패했습니다.";
        try {
          const parsed = JSON.parse(errorText) as { error?: string };
          message = parsed.error || message;
        } catch {
          message = "예산 신청 등록에 실패했습니다.";
        }
        throw new Error(message);
      }

      router.push(`/club/requests?org=${organizationId}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "예산 신청 등록에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SidebarLayout userName="동아리" userRole="동아리/학생회" orgId={organizationId}>
      <div className="max-w-3xl p-6">
        <div className="mb-6">
          <Link
            href={`/club/requests?org=${organizationId}`}
            className="mb-2 inline-flex text-sm text-gray-500 hover:text-gray-800"
          >
            ← 신청 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">예산 신청서 작성</h1>
          <p className="text-sm text-gray-500">
            동아리 예산 요청을 등록하면 관리자가 검토 후 발행 여부를 결정합니다.
          </p>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F7F4] text-[#006B5D]">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    신청 후 운영 흐름
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    신청서가 승인되면 예산과 기본 정책이 자동 발행되고, 이후 예산 상세에서
                    바로 집행 요청을 할 수 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#D5E2DE] bg-[#F7FBFA]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#006B5D]">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Recommended Template
                </span>
              </div>
              <div className="mt-2 text-base font-semibold text-gray-900">
                {recommendedTemplate.label}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {recommendedTemplate.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {recommendedTemplate.allowedCategories.slice(0, 4).map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#006B5D]"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="space-y-5">
              {submitError && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <Label className="text-sm text-gray-700">신청 조직</Label>
                <select
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm text-gray-700">신청 제목</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 5월 공개 세미나 운영 예산"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm text-gray-700">예산 목적</Label>
                <Textarea
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="행사 목적, 사용처, 운영 계획을 구체적으로 적어주세요."
                  className="mt-1 min-h-28"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-sm text-gray-700">신청 금액</Label>
                  <Input
                    type="number"
                    value={requestedAmount}
                    onChange={(event) => setRequestedAmount(Number(event.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-700">시작일</Label>
                  <Input
                    type="date"
                    value={requestedPeriodStart}
                    onChange={(event) => setRequestedPeriodStart(event.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-700">종료일</Label>
                  <Input
                    type="date"
                    value={requestedPeriodEnd}
                    onChange={(event) => setRequestedPeriodEnd(event.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#006B5D]" />
                  <div className="text-sm font-medium text-gray-900">
                    사용 예정 기간 체크
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  행사 운영 기간, 정산 종료 시점, 집행 가능 기간이 겹치도록 입력해 주세요.
                  승인 시 이 기간이 예산 발행 기간의 기본값으로 사용됩니다.
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-sm text-gray-700">
                  요청 카테고리
                </Label>
                <div className="flex flex-wrap gap-2">
                  {REQUEST_CATEGORIES.map((category) => {
                    const active = requestedCategories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-teal-300 bg-teal-50 text-teal-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? "제출 중..." : "예산 신청 제출"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}

export default function ClubRequestNewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-gray-400 animate-pulse">로딩 중...</div>
        </div>
      }
    >
      <ClubRequestNewPageContent />
    </Suspense>
  );
}
