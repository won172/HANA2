"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드", icon: "📊" },
  { href: "/admin/issue", label: "예산 발행", icon: "➕" },
  { href: "/admin/pending", label: "보류 검토", icon: "⏳" },
  { href: "/pos", label: "Mock POS", icon: "🖥️" },
];

export default function SidebarLayout({
  children,
  userName,
  userRole,
}: {
  children: ReactNode;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "userId=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <Link href="/login" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
              ₩
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">
                예산 집행
              </div>
              <div className="text-[10px] text-gray-400">플랫폼</div>
            </div>
          </Link>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
              👤
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{userName}</div>
              <div className="text-[11px] text-gray-500">{userRole}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors w-full rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <span>🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 overflow-auto">{children}</main>
    </div>
  );
}
