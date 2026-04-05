export const CATEGORY_LABELS = {
  FOOD: "식비",
  SUPPLIES: "운영물품",
  PRINT: "인쇄·출력",
  VENUE: "공간·대관",
  TRANSPORT: "교통",
  DESIGN: "디자인",
  ALCOHOL: "주류",
  TOBACCO: "담배",
  GAME: "게임",
  OTHER: "기타",
} as const;

export type BudgetCategory = keyof typeof CATEGORY_LABELS;

export const ALL_BUDGET_CATEGORIES = Object.keys(CATEGORY_LABELS) as BudgetCategory[];

export function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category as BudgetCategory] ?? category;
}

export function formatCategoryList(categories: string[], empty = "설정 없음") {
  if (categories.length === 0) {
    return empty;
  }

  return categories.map(getCategoryLabel).join(", ");
}
