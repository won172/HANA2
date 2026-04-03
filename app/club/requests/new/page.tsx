"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REQUEST_CATEGORIES = [
  "FOOD",
  "SUPPLIES",
  "PRINT",
  "VENUE",
  "TRANSPORT",
  "DESIGN",
  "OTHER",
];

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
  const [requestedPeriodStart, setRequestedPeriodStart] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [requestedPeriodEnd, setRequestedPeriodEnd] = useState("");
  const [requestedCategories, setRequestedCategories] = useState<string[]>([
    "FOOD",
    "SUPPLIES",
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/organizations")
      .then((response) => response.json())
      .then((data: Array<{ id: string; name: string; type: string }>) => {
        const clubs = data
          .filter((organization) => organization.type === "CLUB")
          .map(({ id, name }) => ({ id, name }));
        setOrganizations(clubs);
        if (!clubs.some((organization) => organization.id === initialOrgId)) {
          setOrganizationId(clubs[0]?.id || "");
        }
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
    if (
      !organizationId ||
      !title.trim() ||
      !purpose.trim() ||
      !requestedPeriodEnd ||
      requestedCategories.length === 0
    ) {
      alert("필수 항목을 모두 입력하세요.");
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
        const error = await response.json();
        alert(error.error || "예산 신청 등록에 실패했습니다.");
        return;
      }

      router.push(`/club/requests?org=${organizationId}`);
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

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="space-y-5">
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
                  className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800"
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
