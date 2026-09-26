import api, { type PaginatedList } from './client';
import type { Category } from './category';

export type SampleStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'ARCHIVED' | 'DISPOSED';

export interface Sample {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  type?: string | null;
  status: SampleStatus;
  categoryId?: string | null;
  category?: Category | null;
  imageUrl?: string | null;
  metadata?: Record<string, any> | null;
  groupId: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSampleDto {
  name: string;
  code?: string;
  description?: string;
  type?: string;
  status?: SampleStatus;
  categoryId?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSampleDto extends Partial<CreateSampleDto> {}

export const sampleApi = {
  findAll: (params?: Record<string, unknown>) =>
    api.get<Sample[] | PaginatedList<Sample>>('/samples', { params }),
  findOne: (id: string) => api.get<Sample>(`/samples/${id}`),
  create: (data: CreateSampleDto) => api.post<Sample>('/samples', data),
  update: (id: string, data: UpdateSampleDto) => api.patch<Sample>(`/samples/${id}`, data),
  delete: (id: string) => api.delete(`/samples/${id}`),
};
