import api, { type PaginatedList } from './client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  otherNames?: string;
  role: string;
  status: string;
  createdBy?: string;
  creator?: { fullName: string; email: string };
  updatedBy?: string;
  updater?: { fullName: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface InviteResult {
  id: string;
  email: string;
  token: string;
  familyId: string;
  roleId: string;
  status: string;
  expiresAt: string;
}

export const userApi = {
  findAll: (params?: Record<string, unknown>) => api.get<User[] | PaginatedList<User>>('/users', { params }),
  invite: (email: string, role: string, fullName?: string) =>
    api.post<InviteResult>('/users/invite', { email, role, fullName }),
  update: (id: string, data: Partial<User>) => api.patch(`/users/${id}`, data),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  remove: (id: string) => api.delete(`/users/${id}`),
};
