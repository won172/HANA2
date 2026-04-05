import Link from "next/link";
import SidebarLayout from "@/components/SidebarLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/categoryLabels";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 10;
const STATUS_FILTERS = [
  "ALL",
  "APPROVED",
  "NOTIFIED",
  "PENDING",
  "DECLINED",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type RiskFilter = "ALL" | "HIGH";
type TransactionQueryState = {
  page?: number;
  status?: StatusFilter;
  q?: string;
  risk?: RiskFilter;
  organizationId?: string;
  merchantName?: string;
};

function fmt(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function fmtDateTime(value: Date) {
  return value.toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

function parseStatus(value: string | undefined): StatusFilter {
  if (value && STATUS_FILTERS.includes(value as StatusFilter)) {
    return value as StatusFilter;
  }

  return "ALL";
}

function parseRisk(value: string | undefined): RiskFilter {
  return value === "HIGH" ? "HIGH" : "ALL";
}

function buildTransactionsHref({
  page = 1,
  status = "ALL",
  q = "",
  risk = "ALL",
  organizationId = "",
  merchantName = "",
}: TransactionQueryState) {
  const params = new URLSearchParams();

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (q.trim()) {
    params.set("q", q.trim());
  }

  if (risk === "HIGH") {
    params.set("risk", "HIGH");
  }

  if (organizationId) {
    params.set("organizationId", organizationId);
  }

  if (merchantName) {
    params.set("merchantName", merchantName);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/admin/transactions?${queryString}` : "/admin/transactions";
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

function humanizeReviewReason(reason: string | null) {
  if (!reason) {
    return "-";
  }

  return reason
    .replace("정책 조건 충족 — 자동 승인", "정책 기준 충족")
    .replace("관리자 수동 승인", "관리자 직접 승인")
    .replace("승인 처리 후 관리자 알림", "승인되지만 관리자 확인 필요");
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    risk?: string;
    organizationId?: string;
    merchantName?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const status = parseStatus(resolvedSearchParams.status);
  const searchQuery = resolvedSearchParams.q?.trim() || "";
  const riskFilter = parseRisk(resolvedSearchParams.risk);
  const organizationFilter = resolvedSearchParams.organizationId?.trim() || "";
  const merchantFilter = resolvedSearchParams.merchantName?.trim() || "";
  const requestedPage = parsePage(resolvedSearchParams.page);
  const baseWhere = {
    ...(organizationFilter ? { organizationId: organizationFilter } : {}),
    ...(merchantFilter ? { merchantName: merchantFilter } : {}),
    ...(riskFilter === "HIGH" ? { aiRiskLevel: "HIGH" } : {}),
    ...(searchQuery
      ? {
        OR: [
          { merchantName: { contains: searchQuery, mode: "insensitive" as const } },
          { itemDescription: { contains: searchQuery, mode: "insensitive" as const } },
          { requestedCategory: { contains: searchQuery, mode: "insensitive" as const } },
          {
            budget: {
              name: { contains: searchQuery, mode: "insensitive" as const },
            },
          },
          {
            organization: {
              name: { contains: searchQuery, mode: "insensitive" as const },
            },
          },
        ],
      }
      : {}),
  };
  const where = {
    ...baseWhere,
    ...(status === "ALL" ? {} : { status }),
  };

  const [
    totalCount,
    approvedCount,
    notifiedCount,
    pendingCount,
    declinedCount,
    organizations,
    merchants,
  ] =
    await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...baseWhere, status: "APPROVED" } }),
      prisma.transaction.count({ where: { ...baseWhere, status: "NOTIFIED" } }),
      prisma.transaction.count({ where: { ...baseWhere, status: "PENDING" } }),
      prisma.transaction.count({ where: { ...baseWhere, status: "DECLINED" } }),
      prisma.organization.findMany({
        where: { budgets: { some: {} } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.transaction.findMany({
        distinct: ["merchantName"],
        select: { merchantName: true },
        orderBy: { merchantName: "asc" },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      budget: {
        select: {
          id: true,
          name: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const startRow = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRow = totalCount === 0 ? 0 : startRow + transactions.length - 1;
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const currentQuery: TransactionQueryState = {
    status,
    q: searchQuery,
    risk: riskFilter,
    organizationId: organizationFilter,
    merchantName: merchantFilter,
  };

  return (
    <SidebarLayout userName="김관리자" userRole="관리자">
      <div className="max-w-7xl p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">거래 내역</h1>
            <p className="mt-1 text-sm text-gray-500">
              상태, 검색어, 고위험 여부로 먼저 좁히고 상세 판단은 이 화면에서 이어집니다.
            </p>
          </div>
          <Link href="/admin/pending">
            <Button
              variant="outline"
              className="cursor-pointer border-[#D5E2DE] bg-white text-gray-700 hover:bg-[#F7FBFA]"
            >
              보류 거래 바로 보기
            </Button>
          </Link>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">전체 거래</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{totalCount}건</div>
              <div className="mt-1 text-[11px] text-gray-400">현재 필터 기준</div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">즉시 승인</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">
                {approvedCount}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">알림 후 승인</div>
              <div className="mt-1 text-xl font-bold text-sky-600">{notifiedCount}건</div>
            </CardContent>
          </Card>
          <Card className="border-[#D5E2DE] bg-white">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">보류 / 거절</div>
              <div className="mt-1 text-xl font-bold text-amber-600">
                {pendingCount + declinedCount}건
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                보류 {pendingCount}건 · 거절 {declinedCount}건
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-[#D5E2DE] bg-[#F7FBFA]">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => {
                const isActive = filter === status;
                const label =
                  filter === "ALL"
                    ? "전체"
                    : filter === "APPROVED"
                      ? "승인"
                      : filter === "NOTIFIED"
                        ? "알림"
                        : filter === "PENDING"
                          ? "보류"
                          : "거절";

                return (
                  <Link
                    key={filter}
                    href={buildTransactionsHref({
                      ...currentQuery,
                      page: 1,
                      status: filter,
                    })}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive
                        ? "bg-[#00857A] text-white"
                        : "bg-white text-gray-600 hover:bg-[#E8F7F4] hover:text-[#006B5D]"
                      }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <form action="/admin/transactions" className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.9fr_auto]">
              <input type="hidden" name="status" value={status === "ALL" ? "" : status} />
              {riskFilter === "HIGH" && <input type="hidden" name="risk" value="HIGH" />}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">검색</label>
                <input
                  type="text"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="가맹점, 조직, 예산, 설명, 카테고리 검색"
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">조직</label>
                <select
                  name="organizationId"
                  defaultValue={organizationFilter}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                >
                  <option value="">전체 조직</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">가맹점</label>
                <select
                  name="merchantName"
                  defaultValue={merchantFilter}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00857A]"
                >
                  <option value="">전체 가맹점</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.merchantName} value={merchant.merchantName}>
                      {merchant.merchantName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="cursor-pointer">
                  적용
                </Button>
                <Link
                  href={buildTransactionsHref({
                    ...currentQuery,
                    page: 1,
                    risk: "ALL",
                  })}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${riskFilter === "ALL"
                      ? "bg-[#00857A] text-white"
                      : "bg-white text-gray-600 hover:bg-[#E8F7F4]"
                    }`}
                >
                  전체 리스크
                </Link>
                <Link
                  href={buildTransactionsHref({
                    ...currentQuery,
                    page: 1,
                    risk: "HIGH",
                  })}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${riskFilter === "HIGH"
                      ? "bg-[#00857A] text-white"
                      : "bg-white text-gray-600 hover:bg-[#E8F7F4]"
                    }`}
                >
                  고위험만
                </Link>
                <Link
                  href="/admin/transactions"
                  className="rounded-full px-4 py-2 text-sm font-medium text-gray-500 hover:bg-white hover:text-gray-700"
                >
                  초기화
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[#D5E2DE] bg-white">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">상세 거래 목록</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {startRow} - {endRow} / {totalCount}건
                </p>
              </div>
              <div className="text-xs text-gray-500">
                {searchQuery ? `검색어: ${searchQuery}` : "검색어 없음"} ·{" "}
                {organizationFilter
                  ? `조직 필터 적용`
                  : "전체 조직"}{" "}
                · {merchantFilter ? `가맹점 필터 적용` : "전체 가맹점"} ·{" "}
                {riskFilter === "HIGH" ? "고위험만 표시" : "전체 리스크"}
              </div>
            </div>

            <div className="w-full overflow-x-hidden overflow-y-visible">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 font-medium">일시</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 font-medium">조직</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 font-medium">예산</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 font-medium">가맹점</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 font-medium">설명</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 font-medium">카테고리</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 text-right font-medium">금액</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 pr-3 text-center font-medium">상태</th>
                    <th className="sticky top-0 z-10 bg-white pb-3 font-medium">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-gray-50 align-top transition-colors hover:bg-[#F7FBFA]"
                      >
                        <td className="py-4 pr-3 whitespace-nowrap text-xs text-gray-500">
                          {fmtDateTime(transaction.createdAt)}
                        </td>
                        <td className="py-4 pr-3 break-words text-gray-700">
                          {transaction.organization.name}
                        </td>
                        <td className="py-4 pr-3 break-words text-gray-700">
                          {transaction.budget.name}
                        </td>
                        <td className="py-4 pr-3 break-words font-medium text-gray-900">
                          {transaction.merchantName}
                        </td>
                        <td className="py-4 pr-3 break-words whitespace-normal text-gray-700">
                          {transaction.itemDescription}
                        </td>
                        <td className="py-4 pr-3 break-words text-gray-500">
                          {getCategoryLabel(transaction.requestedCategory)}
                        </td>
                        <td className="py-4 pr-3 text-right font-medium text-gray-900">
                          {fmt(transaction.amount)}원
                        </td>
                        <td className="py-4 pr-3 text-center">
                          <StatusBadge status={transaction.status} />
                        </td>
                        <td className="py-4 break-words whitespace-normal text-xs leading-5 text-gray-500">
                          {humanizeReviewReason(transaction.reviewReason)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-gray-500">
                        표시할 거래가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  페이지 {currentPage} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildTransactionsHref({
                      ...currentQuery,
                      page: Math.max(1, currentPage - 1),
                    })}
                    aria-disabled={currentPage === 1}
                    className={`rounded-lg border px-3 py-2 text-sm ${currentPage === 1
                        ? "pointer-events-none border-gray-200 text-gray-300"
                        : "border-[#D5E2DE] text-gray-700 hover:bg-[#F7FBFA]"
                      }`}
                  >
                    이전
                  </Link>

                  {visiblePages.map((page) => (
                    <Link
                      key={page}
                      href={buildTransactionsHref({
                        ...currentQuery,
                        page,
                      })}
                      className={`rounded-lg px-3 py-2 text-sm ${page === currentPage
                          ? "bg-[#00857A] text-white"
                          : "border border-[#D5E2DE] text-gray-700 hover:bg-[#F7FBFA]"
                        }`}
                    >
                      {page}
                    </Link>
                  ))}

                  <Link
                    href={buildTransactionsHref({
                      ...currentQuery,
                      page: Math.min(totalPages, currentPage + 1),
                    })}
                    aria-disabled={currentPage === totalPages}
                    className={`rounded-lg border px-3 py-2 text-sm ${currentPage === totalPages
                        ? "pointer-events-none border-gray-200 text-gray-300"
                        : "border-[#D5E2DE] text-gray-700 hover:bg-[#F7FBFA]"
                      }`}
                  >
                    다음
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
