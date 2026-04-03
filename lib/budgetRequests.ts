import { getPolicyTemplate, recommendPolicyTemplate } from "@/lib/policyTemplates";

export const REQUEST_CATEGORIES = [
  "FOOD",
  "SUPPLIES",
  "PRINT",
  "VENUE",
  "TRANSPORT",
  "DESIGN",
  "OTHER",
] as const;

export function parseRequestedCategories(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function normalizeRequestedCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(normalized)];
}

export function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
}

export function getRecommendedTemplateForRequest(categories: string[]) {
  return recommendPolicyTemplate(categories);
}

export function getTemplatePreview(templateKey: string | null | undefined, categories: string[]) {
  return getPolicyTemplate(templateKey) || recommendPolicyTemplate(categories);
}

export function getRequestStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "검토 대기";
    case "APPROVED":
      return "발행 완료";
    case "REJECTED":
      return "반려";
    default:
      return status;
  }
}
