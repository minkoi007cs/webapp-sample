export type FamilyRoleCode = 'FAMILY_ADMIN' | 'MEMBER' | null | undefined;

export const getFamilyRoleDescription = (role: FamilyRoleCode): string => {
  if (role === 'FAMILY_ADMIN') {
    return 'Quyền quản trị nhóm: mời/quản lý thành viên, quản lý phân loại, mẫu (samples), lịch trình và tài liệu.';
  }
  return 'Quyền thành viên: xem thông tin nhóm và danh sách thành viên; quản lý mẫu (samples), lịch trình và tài liệu.';
};

export const APP_ADMIN_DESCRIPTION =
  'Quản trị viên hệ thống: toàn quyền quản lý các nhóm và tài khoản trên nền tảng.';
