import api from './client';
import type { SystemRole } from './auth';

export type GroupMembershipRole = 'GROUP_ADMIN' | 'MEMBER';
export type FamilyMembershipRole = GroupMembershipRole;

export interface AdminGroupMember {
  id: string;
  email: string;
  fullName: string | null;
  systemRole: SystemRole;
  role: GroupMembershipRole;
}
export type AdminFamilyMember = AdminGroupMember;

export interface AdminGroup {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  members: AdminGroupMember[];
}
export type AdminFamily = AdminGroup;

export interface AdminUserMembership {
  groupId: string;
  groupName: string;
  familyId?: string;
  familyName?: string;
  status: string;
  role: GroupMembershipRole;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  lastActiveGroupId: string | null;
  lastActiveFamilyId?: string | null;
  memberships: AdminUserMembership[];
}

export interface AdminStats {
  totalGroups: number;
  totalFamilies?: number;
  totalUsers: number;
  totalMemberships: number;
}

export const adminApi = {
  getGroups: () => api.get<AdminGroup[]>('/admin/groups'),
  getFamilies: () => api.get<AdminGroup[]>('/admin/groups'),
  getUsers: () => api.get<AdminUser[]>('/admin/users'),
  getStats: () => api.get<AdminStats>('/admin/stats'),
  createGroup: (data: { name: string; adminUserId: string }) =>
    api.post<AdminGroup[]>('/admin/groups', data),
  createFamily: (data: { name: string; adminUserId: string }) =>
    api.post<AdminGroup[]>('/admin/groups', data),
  addGroupMember: (groupId: string, data: { userId: string; role: 'GROUP_ADMIN' | 'MEMBER' }) =>
    api.post<AdminGroup[]>(`/admin/groups/${groupId}/members`, data),
  addFamilyMember: (groupId: string, data: { userId: string; role: 'GROUP_ADMIN' | 'MEMBER' }) =>
    api.post<AdminGroup[]>(`/admin/groups/${groupId}/members`, data),
  updateGroupStatus: (groupId: string, status: 'ACTIVE' | 'INACTIVE') =>
    api.post(`/admin/groups/${groupId}/status`, { status }),
  updateFamilyStatus: (groupId: string, status: 'ACTIVE' | 'INACTIVE') =>
    api.post(`/admin/groups/${groupId}/status`, { status }),
  updateGroupProfile: (groupId: string, data: { name?: string }) =>
    api.patch(`/admin/groups/${groupId}`, data),
  updateFamilyProfile: (groupId: string, data: { name?: string }) =>
    api.patch(`/admin/groups/${groupId}`, data),
  deleteGroup: (groupId: string) =>
    api.delete<AdminGroup[]>(`/admin/groups/${groupId}`),
  deleteFamily: (groupId: string) =>
    api.delete<AdminGroup[]>(`/admin/groups/${groupId}`),
  removeGroupMember: (groupId: string, userId: string) =>
    api.delete<AdminGroup[]>(`/admin/groups/${groupId}/members/${userId}`),
  removeFamilyMember: (groupId: string, userId: string) =>
    api.delete<AdminGroup[]>(`/admin/groups/${groupId}/members/${userId}`),
  updateGroupMemberRole: (groupId: string, userId: string, role: 'GROUP_ADMIN' | 'MEMBER') =>
    api.post(`/admin/groups/${groupId}/members/${userId}/role`, { role }),
  updateFamilyMemberRole: (groupId: string, userId: string, role: 'GROUP_ADMIN' | 'MEMBER') =>
    api.post(`/admin/groups/${groupId}/members/${userId}/role`, { role }),
  updateSystemRole: (userId: string, systemRole: SystemRole) =>
    api.post(`/admin/users/${userId}/system-role`, { systemRole }),
};
