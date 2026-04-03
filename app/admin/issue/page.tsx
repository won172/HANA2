"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPolicyTemplate,
  POLICY_TEMPLATES,
  type PolicyTemplateConfig,
} from "@/lib/policyTemplates";

const ALL_CATEGORIES = [
  { key: "FOOD", label: "식비" },
  { key: "SUPPLIES", label: "물품" },
  { key: "PRINT", label: "인쇄" },
  { key: "VENUE", label: "장소" },
  { key: "TRANSPORT", label: "교통" },
  { key: "DESIGN", label: "디자인" },
  { key: "ALCOHOL", label: "주류" },
  { key: "TOBACCO", label: "담배" },
  { key: "GAME", label: "게임" },
  { key: "OTHER", label: "기타" },
];

type Organization = {
  id: string;
  name: string;
  type: string;
};

function stringifyCategoryRules(rules: Record<string, number>) {
  return Object.entries(rules)
    .map(([key, value]) => `${key}:${value}`)
    .join(", ");
}

function parseCategoryRules(input: string) {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, number>>((accumulator, part) => {
      const [category, rawValue] = part.split(":").map((item) => item.trim());
      const parsed = Number(rawValue);
      if (category && Number.isFinite(parsed)) {
        accumulator[category.toUpperCase()] = parsed;
      }
      return accumulator;
    }, {});
}

function getDefaultTemplateWindow(templateKey: string | null, validFrom: string, validUntil: string) {
  if (templateKey !== "event") {
    return {
      eventWindowStart: "",
      eventWindowEnd: "",
    };
  }

  if (!validFrom || !validUntil) {
    return {
      eventWindowStart: "",
      eventWindowEnd: "",
    };
  }

  const start = new Date(validFrom);
  start.setDate(start.getDate() - 1);

  return {
    eventWindowStart: start.toISOString().split("T")[0],
    eventWindowEnd: validUntil,
  };
}

export default function IssueBudgetPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState(500000);
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validUntil, setValidUntil] = useState("");
  const [templateKey, setTemplateKey] = useState("event");
  const [autoApproveLimit, setAutoApproveLimit] = useState(50000);
  const [manualReviewLimit, setManualReviewLimit] = useState(150000);
  const [allowedCategories, setAllowedCategories] = useState<string[]>([
    "FOOD",
    "SUPPLIES",
    "PRINT",
    "VENUE",
  ]);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([
    "ALCOHOL",
    "TOBACCO",
    "GAME",
  ]);
  const [blockedKeywords, setBlockedKeywords] = useState("술, 담배, 주류, 게임");
  const [allowedKeywords, setAllowedKeywords] = useState("다과, 행사, 세미나");
  const [allowNewMerchant, setAllowNewMerchant] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState<number | "">(23);
  const [quietHoursEnd, setQuietHoursEnd] = useState<number | "">(7);
  const [eventCategories, setEventCategories] = useState<string[]>([
    "FOOD",
    "VENUE",
  ]);
  const [eventWindowStart, setEventWindowStart] = useState("");
  const [eventWindowEnd, setEventWindowEnd] = useState("");
  const [categoryAutoApproveRules, setCategoryAutoApproveRules] = useState(
    "FOOD:30000, SUPPLIES:50000, TRANSPORT:40000"
  );

  useEffect(() => {
    fetch("/api/organizations")
      .then((response) => response.json())
      .then((data) => {
        const clubs = data.filter((organization: Organization) => organization.type === "CLUB");
        setOrgs(clubs);
        if (clubs.length > 0) {
          setOrgId(clubs[0].id);
        }
      });
  }, []);

  const selectedTemplate = useMemo(
    () => getPolicyTemplate(templateKey),
    [templateKey]
  );

  function applyTemplate(template: PolicyTemplateConfig) {
    setAllowedCategories(template.allowedCategories);
    setBlockedCategories(template.blockedCategories);
    setBlockedKeywords(template.blockedKeywords.join(", "));
    setAllowedKeywords(template.allowedKeywords.join(", "));
    setAutoApproveLimit(template.autoApproveLimit);
    setManualReviewLimit(template.manualReviewLimit);
    setAllowNewMerchant(template.allowNewMerchant);
    setQuietHoursStart(template.quietHoursStart ?? "");
    setQuietHoursEnd(template.quietHoursEnd ?? "");
    setEventCategories(template.eventCategories);
    setCategoryAutoApproveRules(
      stringifyCategoryRules(template.categoryAutoApproveRules)
    );

    const defaultWindow = getDefaultTemplateWindow(
      template.key,
      validFrom,
      validUntil
    );
    setEventWindowStart(defaultWindow.eventWindowStart);
    setEventWindowEnd(defaultWindow.eventWindowEnd);
  }

  useEffect(() => {
    if (selectedTemplate) {
      applyTemplate(selectedTemplate);
    }
  }, [selectedTemplate]);

  const toggleCategory = (key: string, type: "allowed" | "blocked" | "event") => {
    if (type === "allowed") {
      setAllowedCategories((previous) =>
        previous.includes(key)
          ? previous.filter((category) => category !== key)
          : [...previous, key]
      );
      setBlockedCategories((previous) => previous.filter((category) => category !== key));
      return;
    }

    if (type === "blocked") {
      setBlockedCategories((previous) =>
        previous.includes(key)
          ? previous.filter((category) => category !== key)
          : [...previous, key]
      );
      setAllowedCategories((previous) => previous.filter((category) => category !== key));
      return;
    }

    setEventCategories((previous) =>
      previous.includes(key)
        ? previous.filter((category) => category !== key)
        : [...previous, key]
    );
  };

  const handleSubmit = async () => {
    if (!orgId || !name || !validUntil) {
      alert("필수 항목을 모두 입력하세요.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          totalAmount,
          validFrom,
          validUntil,
          organizationId: orgId,
          issuerOrganizationId: "org-issuer",
          policy: {
            templateKey,
            allowedCategories,
            blockedCategories,
            blockedKeywords: blockedKeywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            allowedKeywords: allowedKeywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            categoryAutoApproveRules: parseCategoryRules(categoryAutoApproveRules),
            eventCategories,
            autoApproveLimit,
            manualReviewLimit,
            allowNewMerchant,
            quietHoursStart: quietHoursStart === "" ? null : Number(quietHoursStart),
            quietHoursEnd: quietHoursEnd === "" ? null : Number(quietHoursEnd),
            eventWindowStart: eventWindowStart || null,
            eventWindowEnd: eventWindowEnd || null,
          },
        }),
      });

      if (response.ok) {
        router.push("/admin");
      } else {
        const error = await response.json();
        alert(`오류: ${error.error || "예산 발행 실패"}`);
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-[1200px] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">예산 발행</h1>
          <p className="text-sm text-gray-500">
            템플릿을 기반으로 정책을 빠르게 구성하고 추가 룰을 함께 설정합니다.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <Card className="border-[#E5E7EB] shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
              <CardContent className="p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">기본 정보</h2>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-700">대상 조직</Label>
                    <select
                      value={orgId}
                      onChange={(event) => setOrgId(event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                    >
                      {orgs.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-700">예산 이름</Label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="예: 5월 오픈 세미나 운영 예산"
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label className="text-sm text-gray-700">총 금액</Label>
                      <Input
                        type="number"
                        value={totalAmount}
                        onChange={(event) => setTotalAmount(Number(event.target.value))}
                        className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700">유효 시작일</Label>
                      <Input
                        type="date"
                        value={validFrom}
                        onChange={(event) => {
                          setValidFrom(event.target.value);
                          if (templateKey === "event") {
                            const next = getDefaultTemplateWindow(
                              templateKey,
                              event.target.value,
                              validUntil
                            );
                            setEventWindowStart(next.eventWindowStart);
                          }
                        }}
                        className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700">만료일</Label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(event) => {
                          setValidUntil(event.target.value);
                          if (templateKey === "event") {
                            const next = getDefaultTemplateWindow(
                              templateKey,
                              validFrom,
                              event.target.value
                            );
                            setEventWindowStart(next.eventWindowStart);
                            setEventWindowEnd(next.eventWindowEnd);
                          }
                        }}
                        className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5E7EB] shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
              <CardContent className="p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">정책 템플릿</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {POLICY_TEMPLATES.map((template) => {
                    const active = template.key === templateKey;
                    return (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => setTemplateKey(template.key)}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? "border-[#00857A] bg-[#E8F7F4]"
                            : "border-[#E5E7EB] bg-white hover:border-[#00857A]/50"
                        }`}
                      >
                        <div className="mb-1 font-semibold text-gray-900">
                          {template.label}
                        </div>
                        <div className="text-sm leading-6 text-gray-500">
                          {template.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-[#E5E7EB] shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
              <CardContent className="p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">집행 정책</h2>

                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm text-gray-700">자동승인 한도</Label>
                    <Input
                      type="number"
                      value={autoApproveLimit}
                      onChange={(event) => setAutoApproveLimit(Number(event.target.value))}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">수동검토 한도</Label>
                    <Input
                      type="number"
                      value={manualReviewLimit}
                      onChange={(event) => setManualReviewLimit(Number(event.target.value))}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <Label className="mb-2 block text-sm text-gray-700">
                    카테고리 설정
                  </Label>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {ALL_CATEGORIES.map((category) => {
                      const isAllowed = allowedCategories.includes(category.key);
                      const isBlocked = blockedCategories.includes(category.key);
                      const isEvent = eventCategories.includes(category.key);

                      return (
                        <div
                          key={category.key}
                          className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-3"
                        >
                          <div className="mb-2 text-xs font-medium text-gray-600">
                            {category.label}
                          </div>
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleCategory(category.key, "allowed")}
                              className={`w-full rounded-xl px-2 py-1 text-[11px] ${
                                isAllowed
                                  ? "bg-green-600 text-white"
                                  : "bg-white text-gray-500"
                              }`}
                            >
                              허용
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategory(category.key, "blocked")}
                              className={`w-full rounded-xl px-2 py-1 text-[11px] ${
                                isBlocked
                                  ? "bg-red-600 text-white"
                                  : "bg-white text-gray-500"
                              }`}
                            >
                              금지
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategory(category.key, "event")}
                              className={`w-full rounded-xl px-2 py-1 text-[11px] ${
                                isEvent
                                  ? "bg-[#00857A] text-white"
                                  : "bg-white text-gray-500"
                              }`}
                            >
                              행사 기간
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm text-gray-700">금지 키워드</Label>
                    <Input
                      value={blockedKeywords}
                      onChange={(event) => setBlockedKeywords(event.target.value)}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">허용 키워드</Label>
                    <Input
                      value={allowedKeywords}
                      onChange={(event) => setAllowedKeywords(event.target.value)}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">
                      카테고리별 자동승인 규칙
                    </Label>
                    <Input
                      value={categoryAutoApproveRules}
                      onChange={(event) =>
                        setCategoryAutoApproveRules(event.target.value)
                      }
                      placeholder="FOOD:30000, PRINT:100000"
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm text-gray-700">제한 시작 시각</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={quietHoursStart}
                        onChange={(event) =>
                          setQuietHoursStart(
                            event.target.value === "" ? "" : Number(event.target.value)
                          )
                        }
                        className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700">제한 종료 시각</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={quietHoursEnd}
                        onChange={(event) =>
                          setQuietHoursEnd(
                            event.target.value === "" ? "" : Number(event.target.value)
                          )
                        }
                        className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">행사 적용 시작일</Label>
                    <Input
                      type="date"
                      value={eventWindowStart}
                      onChange={(event) => setEventWindowStart(event.target.value)}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-700">행사 적용 종료일</Label>
                    <Input
                      type="date"
                      value={eventWindowEnd}
                      onChange={(event) => setEventWindowEnd(event.target.value)}
                      className="mt-1 h-11 rounded-xl border-[#D1D5DB]"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] p-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={allowNewMerchant}
                      onChange={(event) => setAllowNewMerchant(event.target.checked)}
                      className="rounded"
                    />
                    신규 가맹점 허용
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    허용하지 않으면 신규 가맹점은 자동 등록 후 보류됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5E7EB] shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
              <CardContent className="p-5">
                <h2 className="mb-3 text-lg font-semibold text-gray-900">템플릿 요약</h2>
                <Textarea
                  value={selectedTemplate?.description || ""}
                  readOnly
                  className="min-h-24 border-[#E5E7EB] bg-[#F8F9FB] text-gray-600"
                />
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="h-11 w-full cursor-pointer rounded-xl bg-[#00857A] text-white hover:bg-[#006B5D]"
            >
              {loading ? "발행 중..." : "예산 발행하기"}
            </Button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
