import api from './client';

export type ExpenseEntryType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  parent?: Pick<Category, 'id' | 'name'> | null;
  children?: Category[];
  isDefault?: boolean;
}

export const expenseEntryTypeLabels: Record<ExpenseEntryType, string> = {
  INCOME: 'Thu nhập',
  EXPENSE: 'Chi phí',
};

/** Danh mục lá: có cha (dùng cho chọn trên form giao dịch/tài sản). */
export const isLeafCategory = (category?: Pick<Category, 'parentId'> | null) =>
  !!category?.parentId;

export const buildCategoryPathLabel = (
  categories: Category[] = [],
  categoryId?: string | null,
): string => {
  if (!categoryId) return '';

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const labels: string[] = [];
  const visited = new Set<string>();
  let current = categoryMap.get(categoryId);

  while (current && !visited.has(current.id)) {
    labels.unshift(current.name);
    visited.add(current.id);
    current = current.parentId ? categoryMap.get(current.parentId) : undefined;
  }

  return labels.join(' / ');
};

export type CategoryDeleteUsage = {
  assetCount: number;
  expenseCount: number;
  childCategoryCount: number;
};

export const categoryApi = {
  findAll: () => api.get<Category[]>('/categories'),
  create: (data: Partial<Category>) => api.post<Category>('/categories', data),
  update: (id: string, data: Partial<Category>) => api.put<Category>(`/categories/${id}`, data),
  getUsageBeforeDelete: (id: string) =>
    api.get<CategoryDeleteUsage>(`/categories/${id}/usage`).then((res) => res.data),
  delete: (id: string, options?: { reassignTo?: string }) =>
    api.delete(`/categories/${id}`, {
      params: options?.reassignTo ? { reassignTo: options.reassignTo } : {},
    }),
};
