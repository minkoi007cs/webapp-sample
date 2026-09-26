import api from './client';
import type { SystemRole } from './auth';

export type FamilyMembershipRole = 'FAMILY_ADMIN' | 'MEMBER';

export interface AdminFamilyMember {
  id: string;
  email: string;
  fullName: string | null;
  systemRole: SystemRole;
  role: FamilyMembershipRole;
}

export interface AdminFamily {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  members: AdminFamilyMember[];
}

export interface AdminUserMembership {
  familyId: string;
  familyName: string;
  status: string;
  role: FamilyMembershipRole;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  lastActiveFamilyId: string | null;
  memberships: AdminUserMembership[];
}

export interface AdminStats {
  totalFamilies: number;
  totalUsers: number;
  totalMemberships: number;
}

export const adminApi = {
  getFamilies: () => api.get<AdminFamily[]>('/admin/families'),
  getUsers: () => api.get<AdminUser[]>('/admin/users'),
  getStats: () => api.get<AdminStats>('/admin/stats'),
  createFamily: (data: { name: string; adminUserId: string }) =>
    api.post<AdminFamily[]>('/admin/families', data),
  addFamilyMember: (familyId: string, data: { userId: string; role: 'FAMILY_ADMIN' | 'MEMBER' }) =>
    api.post<AdminFamily[]>(`/admin/families/${familyId}/members`, data),
  updateFamilyStatus: (familyId: string, status: 'ACTIVE' | 'INACTIVE') =>
    api.post(`/admin/families/${familyId}/status`, { status }),
  updateFamilyProfile: (familyId: string, data: { name?: string }) =>
    api.patch(`/admin/families/${familyId}`, data),
  deleteFamily: (familyId: string) =>
    api.delete<AdminFamily[]>(`/admin/families/${familyId}`),
  removeFamilyMember: (familyId: string, userId: string) =>
    api.delete<AdminFamily[]>(`/admin/families/${familyId}/members/${userId}`),
  updateFamilyMemberRole: (familyId: string, userId: string, role: 'FAMILY_ADMIN' | 'MEMBER') =>
    api.post(`/admin/families/${familyId}/members/${userId}/role`, { role }),
  updateSystemRole: (userId: string, systemRole: SystemRole) =>
    api.post(`/admin/users/${userId}/system-role`, { systemRole }),
};
