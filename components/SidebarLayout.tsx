"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

type SidebarLayoutProps = {
  children: ReactNode;
  userName: string;
  userRole: string;
  orgId?: string;
};

function buildNavItems(userRole: string, orgId?: string) {
  const clubOrgId = orgId ? `?org=${orgId}` : "";

  if (userRole.includes("동아리")) {
    return [
      { href: `/club${clubOrgId}`, label: "예산 현황", icon: "📊" },
      { href: `/club/requests${clubOrgId}`, label: "예산 신청", icon: "📝" },
      {
        href: `/club/requests/new${clubOrgId}`,
        label: "신청서 작성",
        icon: "➕",
      },
      { href: "/pos", label: "POS 데모", icon: "🖥️" },
    ];
  }

  if (userRole.includes("가맹점") || userRole.includes("POS")) {
    return [{ href: "/pos", label: "POS 데모", icon: "🖥️" }];
  }

  return [
    { href: "/admin", label: "대시보드", icon: "📊" },
    { href: "/admin/requests", label: "신청 검토", icon: "📝" },
    { href: "/admin/issue", label: "예산 발행", icon: "➕" },
    { href: "/admin/merchants", label: "가맹점 관리", icon: "🏪" },
    { href: "/admin/anchors", label: "감사 앵커", icon: "🔗" },
    { href: "/admin/pending", label: "보류 검토", icon: "⏳" },
    { href: "/admin/settlements", label: "정산 관리", icon: "📘" },
    { href: "/pos", label: "POS 데모", icon: "🖥️" },
  ];
}

export default function SidebarLayout({
  children,
  userName,
  userRole,
  orgId,
}: SidebarLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = buildNavItems(userRole, orgId);

  const handleLogout = () => {
    document.cookie = "userId=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white">
        <div className="border-b border-gray-100 p-4">
          <Link href="/login" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F58220] text-sm font-bold text-white shadow-[0_2px_8px_rgba(17,24,39,0.06)]">
              ₩
            </div>
            <div>
              <div className="leading-tight text-sm font-bold text-gray-900">
                Dongguk Budget
              </div>
              <div className="text-[10px] text-gray-400">Student Assistant</div>
            </div>
          </Link>
        </div>

        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm">
              👤
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{userName}</div>
              <div className="text-[11px] text-gray-500">{userRole}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : item.href.startsWith("/club?")
                  ? pathname === "/club"
                  : pathname.startsWith(item.href.split("?")[0]);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-[#FFF3E8] font-medium text-[#E26F12]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <span>🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
