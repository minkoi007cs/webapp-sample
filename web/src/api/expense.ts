import api, { type PaginatedList } from './client';
import type { Category, ExpenseEntryType } from './category';

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  entryType: ExpenseEntryType;
  categoryId?: string;
  expenseDate: string;
  isTransfer?: boolean;
  note?: string;
  assetId?: string;
  asset?: { name: string };
  category?: Category;
  createdBy?: string;
  creator?: { fullName: string; email: string };
  updatedBy?: string;
  updater?: { fullName: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

export const expenseApi = {
  findAll: (params?: any) => api.get<Expense[] | PaginatedList<Expense>>('/expenses', { params }),
  create: (data: Partial<Expense>) => api.post<Expense>('/expenses', data),
  update: (id: string, data: Partial<Expense>) => api.put<Expense>(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  export: (params?: any) => api.get('/expenses/export', { params, responseType: 'blob' }),
};
