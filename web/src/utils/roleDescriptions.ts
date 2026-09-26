export type GroupRoleCode = 'GROUP_ADMIN' | 'FAMILY_ADMIN' | 'MEMBER' | null | undefined;
export type FamilyRoleCode = GroupRoleCode;

export const getGroupRoleDescription = (role: GroupRoleCode): string => {
  if (role === 'GROUP_ADMIN' || role === 'FAMILY_ADMIN') {
    return 'Quyền quản trị nhóm: mời/quản lý thành viên, quản lý phân loại, mẫu (samples), lịch trình và tài liệu.';
  }
  return 'Quyền thành viên: xem thông tin nhóm và danh sách thành viên; quản lý mẫu (samples), lịch trình và tài liệu.';
};

export const getFamilyRoleDescription = getGroupRoleDescription;

export const APP_ADMIN_DESCRIPTION =
  'Quản trị viên hệ thống: toàn quyền quản lý các nhóm và tài khoản trên nền tảng.';
