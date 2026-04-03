import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  APPROVED: {
    label: "승인",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  NOTIFIED: {
    label: "승인(알림)",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PENDING: {
    label: "보류",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DECLINED: {
    label: "거절",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  REJECTED: {
    label: "반려",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  ACTIVE: {
    label: "활성",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  EXPIRED: {
    label: "만료",
    className: "bg-gray-100 text-gray-600 border-gray-300",
  },
  RECALLED: {
    label: "환수",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  SUBMITTED: {
    label: "제출",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  REVIEWED: {
    label: "검토완료",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ANCHORED: {
    label: "앵커 완료",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  FAILED: {
    label: "앵커 실패",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium px-2 py-0.5 ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}
