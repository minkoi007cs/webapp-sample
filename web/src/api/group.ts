import api from './client';
import type { SessionResponse } from './auth';

export interface Group {
  id: string;
  name: string;
  code?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export const groupApi = {
  getCurrent: () => api.get<Group>('/groups/current'),
  updateCurrent: (data: { name: string }) => api.patch<Group>('/groups/current', data),
  listUserGroups: () => api.get<Group[]>('/groups'),
  switchGroup: (groupId: string) => api.post<SessionResponse>('/auth/switch-family', { familyId: groupId }),
  createGroup: (name?: string) => api.post<SessionResponse>('/auth/create-family', { name }),
};
