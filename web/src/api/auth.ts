import api from './client';

export type SystemRole = 'USER' | 'APP_ADMIN';
export type GroupRole = 'APP_ADMIN' | 'GROUP_ADMIN' | 'MEMBER' | null;
export type FamilyRole = GroupRole;

export interface SessionMembership {
  groupId: string;
  groupName: string;
  groupStatus?: 'ACTIVE' | 'INACTIVE';
  role: Exclude<GroupRole, null>;
  // Compatibility
  familyId?: string;
  familyName?: string;
  familyStatus?: 'ACTIVE' | 'INACTIVE';
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
  otherNames?: string | null;
  systemRole: SystemRole;
  role: GroupRole;
  groupId: string | null;
  familyId?: string | null;
  memberships: SessionMembership[];
}

export interface SessionResponse {
  access_token: string;
  user: SessionUser;
}

export const authApi = {
  me: () => api.get<SessionResponse>('/auth/me'),
  updateMe: (data: { fullName?: string; otherNames?: string }) => api.patch('/auth/me', data),
  listGroups: () => api.get<Array<{ groupId: string; groupName: string; role: GroupRole; status: string }>>('/auth/groups'),
  listFamilies: () => api.get<Array<{ groupId: string; groupName: string; role: GroupRole; status: string }>>('/auth/groups'),
  switchGroup: (groupId: string) => api.post<SessionResponse>('/auth/switch-group', { groupId }),
  switchFamily: (groupId: string) => api.post<SessionResponse>('/auth/switch-group', { groupId }),
  createGroup: (name?: string) => api.post<SessionResponse>('/auth/create-group', { name }),
  createFamily: (name?: string) => api.post<SessionResponse>('/auth/create-group', { name }),
  acceptInvite: (token: string) => api.post<SessionResponse>('/auth/accept-invite', { token }),
  previewInvite: (token: string) =>
    api.get<{ email: string; groupName: string | null; familyName?: string | null; role: GroupRole; isExpired: boolean; status: string }>(`/auth/invite/${token}`),
};
