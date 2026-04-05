"use client";

import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { getCategoryLabel } from "@/lib/categoryLabels";
import { parseJsonResponse } from "@/lib/fetchJson";
import { Input } from "@/components/ui/input";

type Merchant = {
  id: string;
  name: string;
  category: string;
  isApproved: boolean;
  createdAt: string;
};

const CATEGORY_OPTIONS = [
  "FOOD",
  "SUPPLIES",
  "PRINT",
  "VENUE",
  "TRANSPORT",
  "DESIGN",
  "OTHER",
];

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [draftCategories, setDraftCategories] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "APPROVED" | "PENDING">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  async function fetchMerchants() {
    try {
      const response = await fetch("/api/merchants");
      const data = await parseJsonResponse<Merchant[]>(response);
      setLoadError("");
      setMerchants(data);
      setDraftCategories(
        data.reduce<Record<string, string>>((accumulator, merchant) => {
          accumulator[merchant.id] = merchant.category;
          return accumulator;
        }, {})
      );
    } catch (error) {
      setMerchants([]);
      setLoadError(
        error instanceof Error ? error.message : "가맹점 목록을 불러오지 못했습니다."
      );
    }
  }

  useEffect(() => {
    void fetchMerchants();
  }, []);

  async function updateMerchant(
    merchant: Merchant,
    updates: Partial<Pick<Merchant, "isApproved" | "category">>
  ) {
    setProcessingId(merchant.id);

    try {
      const response = await fetch(`/api/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "가맹점 상태 변경 실패");
        return;
      }

      await fetchMerchants();
    } finally {
      setProcessingId(null);
    }
  }

  const filteredMerchants = merchants.filter((merchant) => {
    const matchesQuery =
      query.trim().length === 0 ||
      merchant.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "APPROVED" ? merchant.isApproved : !merchant.isApproved);
    const matchesCategory =
      categoryFilter === "ALL" || merchant.category === categoryFilter;
    return matchesQuery && matchesStatus && matchesCategory;
  });

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-[1200px] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">가맹점 관리</h1>
          <p className="text-sm text-gray-500">
            신규 가맹점을 검토하고 승인된 가맹점을 자동 승인 우대 대상으로 관리합니다.
          </p>
        </div>

        <Card className="mb-6 border-[#E5E7EB] bg-[#E8F7F4]/60 shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">전체 가맹점</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">
                {merchants.length}개
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">승인 완료</div>
              <div className="mt-1 text-xl font-semibold text-[#006B5D]">
                {merchants.filter((merchant) => merchant.isApproved).length}개
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">검토 필요</div>
              <div className="mt-1 text-xl font-semibold text-amber-600">
                {merchants.filter((merchant) => !merchant.isApproved).length}개
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-[#D5E2DE] bg-white">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="가맹점명 검색"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | "APPROVED" | "PENDING")
              }
              className="h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
            >
              <option value="ALL">전체 상태</option>
              <option value="APPROVED">승인 완료</option>
              <option value="PENDING">검토 필요</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
            >
              <option value="ALL">전체 카테고리</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
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
          {filteredMerchants.map((merchant) => (
            <Card
              key={merchant.id}
              className="border-[#E5E7EB] shadow-[0_2px_8px_rgba(17,24,39,0.06)]"
            >
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{merchant.name}</h2>
                    <StatusBadge
                      status={merchant.isApproved ? "APPROVED" : "PENDING"}
                    />
                  </div>
	                  <div className="text-sm text-gray-500">
	                    카테고리 {getCategoryLabel(merchant.category)} · 등록일{" "}
	                    {new Date(merchant.createdAt).toLocaleDateString("ko-KR")}
	                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="w-full sm:w-44">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      카테고리
                    </label>
                    <select
                      value={draftCategories[merchant.id] ?? merchant.category}
                      onChange={(event) =>
                        setDraftCategories((previous) => ({
                          ...previous,
                          [merchant.id]: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                    >
	                      {CATEGORY_OPTIONS.map((category) => (
	                        <option key={category} value={category}>
	                          {getCategoryLabel(category)}
	                        </option>
	                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateMerchant(merchant, {
                          category: draftCategories[merchant.id] ?? merchant.category,
                        })
                      }
                      disabled={processingId === merchant.id}
                      className="cursor-pointer border-[#E5E7EB] bg-white text-gray-700 hover:bg-[#F8F9FB]"
                    >
                      분류 저장
                    </Button>
                    <Button
                      variant={merchant.isApproved ? "outline" : "default"}
                      onClick={() => {
                        if (
                          merchant.isApproved &&
                          !window.confirm(
                            `${merchant.name} 승인을 해제하면 이후 거래가 자동 우대 대상에서 빠집니다. 계속할까요?`
                          )
                        ) {
                          return;
                        }

                        void updateMerchant(merchant, {
                          isApproved: !merchant.isApproved,
                        });
                      }}
                      disabled={processingId === merchant.id}
                      className={`cursor-pointer ${
                        merchant.isApproved
                          ? "border-[#00857A]/30 bg-white text-[#00857A] hover:bg-[#E8F7F4]"
                          : "bg-[#00857A] text-white hover:bg-[#006B5D]"
                      }`}
                    >
                      {merchant.isApproved ? "승인 해제" : "가맹점 승인"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredMerchants.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-10 text-center text-sm text-gray-500">
                조건에 맞는 가맹점이 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
