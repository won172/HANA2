"use client";

import Link from "next/link";
import Image from "next/image";
import { ComponentType, ReactNode, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  FileCheck2,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Laptop2,
  Link2,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  Store,
  X,
  WalletCards,
} from "lucide-react";

type SidebarLayoutProps = {
  children: ReactNode;
  userName: string;
  userRole: string;
  orgId?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const DEMO_USER_NAMES: Record<string, string> = {
  "user-admin": "김철수",
  "user-club1": "홍길동",
  "user-club2": "이순신",
  "user-approver": "아무개",
  "user-pos": "POS단말기",
};

function getSelectedDemoUserName() {
  if (typeof document === "undefined") {
    return null;
  }

  const matchedCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("userId="));
  const userId = matchedCookie?.split("=")[1];

  if (!userId) {
    return null;
  }

  return DEMO_USER_NAMES[userId] || null;
}

function getSidebarScrollStorageKey(userRole: string) {
  return `sidebar-scroll:${userRole}`;
}

function buildNavSections(userRole: string, orgId?: string): NavSection[] {
  const clubOrgId = orgId ? `?org=${orgId}` : "";

  if (userRole.includes("동아리")) {
    return [
      {
        title: "집행",
        items: [
          {
            href: `/club${clubOrgId}`,
            label: "예산 현황",
            icon: LayoutDashboard,
          },
        ],
      },
      {
        title: "신청",
        items: [
          {
            href: `/club/requests${clubOrgId}`,
            label: "예산 신청 내역",
            icon: FileText,
          },
          {
            href: `/club/requests/new${clubOrgId}`,
            label: "신청서 작성",
            icon: FilePlus2,
          },
        ],
      },
      {
        title: "도구",
        items: [
          {
            href: "/pos",
            label: "가맹점 시뮬레이터",
            icon: Laptop2,
            badge: "데모",
          },
        ],
      },
    ];
  }

  if (userRole.includes("가맹점") || userRole.includes("POS")) {
    return [
      {
        title: "도구",
        items: [
          {
            href: "/pos",
            label: "가맹점 시뮬레이터",
            icon: Laptop2,
            badge: "데모",
          },
        ],
      },
    ];
  }

  return [
    {
      title: "운영",
      items: [
        {
          href: "/admin",
          label: "대시보드",
          icon: LayoutDashboard,
        },
        {
          href: "/admin/requests",
          label: "신청 검토",
          icon: FileCheck2,
        },
        {
          href: "/admin/issue",
          label: "예산 발행",
          icon: WalletCards,
        },
      ],
    },
    {
      title: "통제",
      items: [
        {
          href: "/admin/pending",
          label: "보류 거래",
          icon: AlertTriangle,
        },
        {
          href: "/admin/transactions",
          label: "거래 내역",
          icon: FileText,
        },
        {
          href: "/admin/settlements",
          label: "정산 관리",
          icon: ReceiptText,
        },
        {
          href: "/admin/merchants",
          label: "가맹점 관리",
          icon: Store,
        },
      ],
    },
    {
      title: "감사",
      items: [
        {
          href: "/admin/anchors",
          label: "감사 앵커",
          icon: Link2,
        },
      ],
    },
    {
      title: "도구",
      items: [
        {
          href: "/pos",
          label: "가맹점 시뮬레이터",
          icon: Laptop2,
          badge: "데모",
        },
      ],
    },
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
  const navSections = buildNavSections(userRole, orgId);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navRef = useRef<HTMLElement | null>(null);
  const displayName =
    typeof document === "undefined" ? userName : getSelectedDemoUserName() || userName;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncSidebarState = () => {
      setIsSidebarOpen(!mediaQuery.matches);
    };

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) {
      return;
    }

    const storageKey = getSidebarScrollStorageKey(userRole);
    const savedScrollTop = window.sessionStorage.getItem(storageKey);

    if (savedScrollTop) {
      navElement.scrollTop = Number(savedScrollTop);
    }

    const handleScroll = () => {
      window.sessionStorage.setItem(storageKey, String(navElement.scrollTop));
    };

    navElement.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      handleScroll();
      navElement.removeEventListener("scroll", handleScroll);
    };
  }, [userRole, pathname]);

  const handleLogout = () => {
    document.cookie = "userId=; path=/; max-age=0";
    router.push("/login");
  };

  const handleNavClick = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-background">
      <button
        type="button"
        onClick={() => setIsSidebarOpen((prev) => !prev)}
        className={`fixed top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D5E2DE] bg-white text-[#14332D] shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition-[left,background-color] duration-200 hover:bg-[#F7FBFA] ${
          isSidebarOpen ? "left-[236px]" : "left-4"
        }`}
        aria-label={isSidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="사이드바 오버레이 닫기"
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-transform duration-200 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-[var(--sidebar-border)] px-5 py-5">
          <Link href="/login" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D5E2DE] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
              <Image
                src="/hana_logo.png"
                alt="하나은행 로고"
                width={38}
                height={38}
                className="object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[-0.02em]">
                Hana Campus Budget
              </div>
              <div className="mt-0.5 text-[11px] text-white/65">
                하나은행 캠퍼스 예산 운영
              </div>
            </div>
          </Link>
        </div>

        <div className="border-b border-[var(--sidebar-border)] px-5 py-4">
          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div suppressHydrationWarning className="truncate text-sm font-medium">
                  {displayName}
                </div>
                <div className="mt-0.5 text-[11px] text-white/65">
                  {userRole}
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav ref={navRef} className="sidebar-scrollbar flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-6">
            {navSections.map((section) => (
              <section key={section.title}>
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const basePath = item.href.split("?")[0];
                    const isActive =
                      basePath === "/admin"
                        ? pathname === "/admin"
                        : basePath === "/club"
                          ? pathname === "/club"
                          : pathname.startsWith(basePath);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleNavClick}
                        className={`group flex items-center justify-between rounded-2xl px-3 py-3 text-sm transition-all ${isActive
                            ? "bg-[var(--sidebar-accent)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                            : "text-white/75 hover:bg-white/6 hover:text-white"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive
                                ? "bg-white/12"
                                : "bg-white/5 text-white/70 group-hover:bg-white/10"
                              }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${isActive
                                ? "bg-white/12 text-white/80"
                                : "bg-white/6 text-white/55"
                              }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <div className="border-t border-[var(--sidebar-border)] px-4 py-4">
          <div className="mb-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
              Environment
            </div>
            <div className="mt-1 text-sm font-medium">Sandbox</div>
            <div className="mt-1 text-[11px] text-white/60">
              실제 금융망과 분리된 시뮬레이션 환경
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/75 transition-all hover:bg-white/8 hover:text-white"
          >
            <span className="flex items-center gap-3">
              <LogOut className="h-4 w-4" />
              로그아웃
            </span>
          </button>
        </div>
      </aside>

      <main
        className={`min-w-0 flex-1 overflow-auto transition-[padding-left] duration-200 ${
          isSidebarOpen ? "lg:pl-[280px]" : "lg:pl-0"
        }`}
      >
        <div className="min-h-screen bg-background/90">{children}</div>
      </main>
    </div>
  );
}
