import api, { type PaginatedList } from './client';

export interface Asset {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: { id?: string; name: string };
  purchasePrice: number;
  currentValue: number;
  /** Total linked expenses (EXPENSE) - computed by API */
  linkedExpenseTotal?: number;
  /** Total linked income (INCOME) - computed by API */
  linkedIncomeTotal?: number;
  status: string;
  purchaseDate?: string;
  warrantyExpiredAt?: string;
  ownerId?: string;
  owner?: { fullName: string; email: string };
  usedById?: string;
  usedBy?: { fullName: string; email: string };
  createdBy?: string;
  creator?: { fullName: string; email: string };
  updatedBy?: string;
  updater?: { fullName: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

export const assetApi = {
  findAll: (params?: any) => api.get<Asset[] | PaginatedList<Asset>>('/assets', { params }),
  findOne: (id: string) => api.get<Asset>(`/assets/${id}`),
  create: (data: Partial<Asset>) => api.post<Asset>('/assets', data),
  update: (id: string, data: Partial<Asset>) => api.put<Asset>(`/assets/${id}`, data),
  delete: (id: string) => api.delete(`/assets/${id}`),
  export: (params?: any) => api.get('/assets/export', { params, responseType: 'blob' }),
};
