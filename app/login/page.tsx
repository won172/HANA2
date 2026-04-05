"use client";

import Image from "next/image";
import { ArrowRight, Building2, CreditCard, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

const ROLES = [
  {
    section: "관리자",
    icon: Building2,
    description: "신청 검토, 예산 발행, 정산 및 감사 레이어 모니터링",
    users: [{ id: "user-admin", name: "김철수", path: "/admin" }],
  },
  {
    section: "동아리 / 학생회",
    icon: Users,
    description: "예산 신청, 예외 결제 신청, 보완 제출, 종료 보고",
    users: [
      { id: "user-club1", name: "홍길동", path: "/club?org=org-stats" },
      { id: "user-club2", name: "이순신", path: "/club?org=org-data" },
    ],
  },
  {
    section: "승인자",
    icon: ShieldCheck,
    description: "보류 거래 검토",
    users: [{ id: "user-approver", name: "아무개", path: "/admin/pending" }],
  },
  {
    section: "가맹점 시뮬레이터",
    icon: CreditCard,
    description: "결제 요청 흐름을 검증하는 데모 단말",
    users: [{ id: "user-pos", name: "POS단말기", path: "/pos" }],
  },
];

function persistSelectedUser(userId: string) {
  document.cookie = `userId=${userId}; path=/; max-age=86400`;
}

export default function LoginPage() {
  const router = useRouter();

  const handleSelect = (userId: string, path: string) => {
    persistSelectedUser(userId);
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3f8f7_0%,#f8fbfa_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[#D5E2DE] bg-white shadow-[0_24px_80px_rgba(20,51,45,0.08)]">
        <section className="flex w-full flex-col justify-between bg-[#0F3B34] px-8 py-8 text-[#EEF8F5] lg:w-[42%] lg:px-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D5E2DE] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
                <Image
                  src="/hana_logo.png"
                  alt="하나은행 로고"
                  width={44}
                  height={44}
                  className="h-auto w-auto object-contain"
                />
              </div>
              <div>
                <div className="text-base font-semibold tracking-[-0.02em]">
                  Hana Campus Budget
                </div>
                <div className="mt-0.5 text-xs text-white/60">
                  하나은행 캠퍼스 운영형 예산 플랫폼
                </div>
              </div>
            </div>

            <div className="mt-16">
              <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                Sandbox
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-white">
                하나은행
                <br />
                학생회 예산 투명 집행 플랫폼
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/68">
                예산 신청부터 집행, 정산, 감사 기록까지 이어지는 운영 흐름을 검증하는 데모 환경입니다.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/8 bg-white/4 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
              Included Flow
            </div>
            <div className="grid gap-2 text-sm text-white/78">
              <div>예산 신청 → 승인 → 발행 → 집행 → 정산 → 감사 앵커</div>
              <div>AI 정책 엔진 + AI 결제 분석 + 블록체인</div>
            </div>
          </div>
        </section>

        <section className="flex w-full flex-col justify-center bg-white px-6 py-8 lg:w-[58%] lg:px-10">
          <div className="mb-8">
            <div className="text-sm font-semibold text-[#00857A]">역할 선택</div>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#14332D]">
              기능 확인을 위해 역할을 선택해주세요.
            </h2>
            <p className="mt-2 text-sm text-[#60716C]">
              테스트할 역할을 선택하면 해당 업무 흐름으로 이동합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ROLES.map((role) => {
              const Icon = role.icon;

              return (
                <Card
                  key={role.section}
                  className="border-[#D5E2DE] bg-white shadow-[0_8px_24px_rgba(20,51,45,0.05)] transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F7F4] text-[#00857A]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#14332D]">{role.section}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#60716C]">
                          {role.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {role.users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelect(user.id, user.path)}
                          className="group flex w-full items-center justify-between rounded-2xl border border-[#D5E2DE] bg-[#F7FBFA] px-4 py-3 text-sm font-medium text-[#14332D] transition-all hover:border-[#00857A]/35 hover:bg-[#E8F7F4] cursor-pointer"
                        >
                          <span>{user.name}</span>
                          <ArrowRight className="h-4 w-4 text-[#60716C] transition-transform group-hover:translate-x-0.5 group-hover:text-[#00857A]" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-[#60716C]">
            Demo only · 실제 금융망 및 계정과는 연결되지 않습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
