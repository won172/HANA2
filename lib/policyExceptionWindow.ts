type SubmissionWindow = {
  label: string;
  startHour: number;
  endHour: number;
};

export const POLICY_EXCEPTION_SUBMISSION_WINDOWS: SubmissionWindow[] = [
  { label: "오전 운영창", startHour: 9, endHour: 11 },
  { label: "오후 운영창", startHour: 15, endHour: 17 },
];

export function getCurrentPolicyExceptionWindow(now = new Date()) {
  const hour = now.getHours();
  return (
    POLICY_EXCEPTION_SUBMISSION_WINDOWS.find(
      (window) => hour >= window.startHour && hour < window.endHour
    ) || null
  );
}

export function getNextPolicyExceptionWindow(now = new Date()) {
  const candidates = POLICY_EXCEPTION_SUBMISSION_WINDOWS.map((window) => {
    const startsAt = new Date(now);
    startsAt.setHours(window.startHour, 0, 0, 0);
    if (startsAt <= now) {
      startsAt.setDate(startsAt.getDate() + 1);
    }

    return {
      ...window,
      startsAt,
    };
  }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return candidates[0] || null;
}

export function isPolicyExceptionSubmissionOpen(now = new Date()) {
  return getCurrentPolicyExceptionWindow(now) !== null;
}

export function formatPolicyExceptionWindow(window: SubmissionWindow | null) {
  if (!window) {
    return "운영창 없음";
  }

  return `${window.label} ${String(window.startHour).padStart(2, "0")}:00-${String(
    window.endHour
  ).padStart(2, "0")}:00`;
}
