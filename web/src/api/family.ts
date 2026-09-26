import api from './client';

export interface FamilyProfile {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  members: Array<{
    id: string;
    email: string;
    fullName: string | null;
    role: 'FAMILY_ADMIN' | 'MEMBER';
  }>;
}

export const familyApi = {
  findOne: () => api.get<FamilyProfile>('/family'),
  update: (data: { name?: string }) => api.patch<FamilyProfile>('/family', data),
  delete: () => api.delete<{ success: boolean; message: string }>('/family'),
  deactivate: () => api.patch<{ success: boolean; message: string }>('/family/deactivate'),
  leave: () => api.delete<{ success: boolean; message: string }>('/family/membership'),
};
