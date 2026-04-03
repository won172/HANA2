"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

const ROLES = [
  {
    section: "관리자",
    icon: "🏛️",
    description: "예산 발행, 정책 설정, 보류 거래 검토",
    users: [
      { id: "user-admin", name: "김관리자", path: "/admin" },
    ],
  },
  {
    section: "동아리 / 학생회",
    icon: "👥",
    description: "예산 현황, 거래 내역 확인",
    users: [
      { id: "user-club1", name: "이동아리", path: "/club?org=org-stats" },
      { id: "user-club2", name: "박동아리", path: "/club?org=org-data" },
    ],
  },
  {
    section: "승인자",
    icon: "✅",
    description: "보류 거래 검토 및 승인/반려",
    users: [
      { id: "user-approver", name: "최승인자", path: "/admin/pending" },
    ],
  },
  {
    section: "POS 단말기",
    icon: "🖥️",
    description: "Mock 결제 요청 입력",
    users: [
      { id: "user-pos", name: "POS단말기", path: "/pos" },
    ],
  },
];

export default function LoginPage() {
  const router = useRouter();

  const handleSelect = (userId: string, path: string) => {
    document.cookie = `userId=${userId}; path=/; max-age=86400`;
    router.push(path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 text-white text-2xl mb-4 shadow-lg">
            ₩
          </div>
          <h1 className="text-2xl font-bold text-gray-900">예산 집행 플랫폼</h1>
          <p className="text-sm text-gray-500 mt-1">
            목적형 예금토큰 기반 학생회·동아리 예산 관리
          </p>
          <div className="inline-block mt-3 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
            <span className="text-xs text-amber-700">
              ⓘ 데모 모드 — 역할을 선택하여 진입하세요
            </span>
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map((role) => (
            <Card
              key={role.section}
              className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{role.icon}</span>
                  <h3 className="font-semibold text-gray-900">{role.section}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">{role.description}</p>
                <div className="space-y-2">
                  {role.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelect(user.id, user.path)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 text-sm font-medium text-gray-700 transition-all cursor-pointer group"
                    >
                      <span>{user.name}</span>
                      <span className="text-gray-400 group-hover:text-teal-500 transition-colors">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          PoC/MVP 데모 환경 · 실제 금융망 미연결
        </p>
      </div>
    </div>
  );
}
