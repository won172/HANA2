"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function IssueBudgetPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState(500000);
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validUntil, setValidUntil] = useState("");
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
  const [allowNewMerchant, setAllowNewMerchant] = useState(false);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => {
        const clubs = data.filter((o: Organization) => o.type === "CLUB");
        setOrgs(clubs);
        if (clubs.length > 0) setOrgId(clubs[0].id);
      });
  }, []);

  const toggleCategory = (key: string, type: "allowed" | "blocked") => {
    if (type === "allowed") {
      setAllowedCategories((prev) =>
        prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
      );
      // Remove from blocked if adding to allowed
      if (!allowedCategories.includes(key)) {
        setBlockedCategories((prev) => prev.filter((c) => c !== key));
      }
    } else {
      setBlockedCategories((prev) =>
        prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
      );
      // Remove from allowed if adding to blocked
      if (!blockedCategories.includes(key)) {
        setAllowedCategories((prev) => prev.filter((c) => c !== key));
      }
    }
  };

  const handleSubmit = async () => {
    if (!orgId || !name || !validUntil) {
      alert("필수 항목을 모두 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/budgets", {
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
            allowedCategories,
            blockedCategories,
            blockedKeywords: blockedKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
            autoApproveLimit,
            manualReviewLimit,
            allowNewMerchant,
          },
        }),
      });

      if (res.ok) {
        alert("예산이 발행되었습니다!");
        router.push("/admin");
      } else {
        const err = await res.json();
        alert(`오류: ${err.error || "예산 발행 실패"}`);
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">예산 발행</h1>
          <p className="text-sm text-gray-500">새로운 목적형 예산을 발행합니다</p>
        </div>

        {/* 기본 정보 */}
        <Card className="border-gray-200 mb-6">
          <CardContent className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4">📋 기본 정보</h2>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-700">대상 조직</Label>
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm text-gray-700">예산 이름</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 2024 봄 행사 예산"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-700">총 금액 (원)</Label>
                  <Input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-700">유효 시작일</Label>
                  <Input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-700">만료일</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 집행 정책 */}
        <Card className="border-gray-200 mb-6">
          <CardContent className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4">🛡️ 집행 정책</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="text-sm text-gray-700">
                  자동승인 한도 (원)
                </Label>
                <Input
                  type="number"
                  value={autoApproveLimit}
                  onChange={(e) => setAutoApproveLimit(Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-[11px] text-blue-500 mt-1">
                  이하: 즉시 승인 (Level A)
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-700">
                  수동검토 한도 (원)
                </Label>
                <Input
                  type="number"
                  value={manualReviewLimit}
                  onChange={(e) => setManualReviewLimit(Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-[11px] text-amber-500 mt-1">
                  초과: 검토 필요 (Level C)
                </p>
              </div>
            </div>

            {/* Category Toggles */}
            <div className="mb-6">
              <Label className="text-sm text-gray-700 mb-2 block">
                카테고리 설정
              </Label>
              <div className="grid grid-cols-5 gap-3">
                {ALL_CATEGORIES.map((cat) => {
                  const isAllowed = allowedCategories.includes(cat.key);
                  const isBlocked = blockedCategories.includes(cat.key);
                  return (
                    <div key={cat.key} className="text-center">
                      <div className="text-xs text-gray-600 mb-1">
                        {cat.label}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleCategory(cat.key, "allowed")}
                          className={`flex-1 text-[11px] py-1 rounded transition-colors cursor-pointer ${
                            isAllowed
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          허용
                        </button>
                        <button
                          onClick={() => toggleCategory(cat.key, "blocked")}
                          className={`flex-1 text-[11px] py-1 rounded transition-colors cursor-pointer ${
                            isBlocked
                              ? "bg-red-500 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          금지
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blocked Keywords */}
            <div className="mb-4">
              <Label className="text-sm text-gray-700">
                금지 키워드 (쉼표 구분)
              </Label>
              <Input
                value={blockedKeywords}
                onChange={(e) => setBlockedKeywords(e.target.value)}
                placeholder="술, 담배, 주류, 게임"
                className="mt-1"
              />
            </div>

            {/* Allow New Merchant */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allowNewMerchant"
                checked={allowNewMerchant}
                onChange={(e) => setAllowNewMerchant(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="allowNewMerchant" className="text-sm text-gray-700">
                신규 가맹점 허용 (미체크 시 Level C 검토)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-5 text-base cursor-pointer"
        >
          {loading ? "발행 중..." : "💰 예산 발행하기"}
        </Button>
      </div>
    </SidebarLayout>
  );
}
