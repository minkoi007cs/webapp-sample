export type FamilyRoleCode = 'FAMILY_ADMIN' | 'MEMBER' | null | undefined;

// Mirrors the actual permission matrix in SessionProvider.tsx's ROLE_PERMISSIONS
// -- kept here as plain-language copy so a non-technical user can see what
// their role actually grants, instead of discovering restrictions by hitting
// a disabled button with no explanation.
export const getFamilyRoleDescription = (role: FamilyRoleCode): string => {
    if (role === 'FAMILY_ADMIN') {
        return 'Toàn quyền trong gia đình: thêm/sửa/xóa thành viên, mời người mới, quản lý danh mục thu chi, và mọi dữ liệu tài sản, chi tiêu, lịch, hồ sơ định cư.';
    }
    return 'Có thể xem thông tin gia đình và danh sách thành viên; toàn quyền với tài sản, chi tiêu, lịch và hồ sơ định cư. Không thể mời/xóa thành viên hay sửa danh mục thu chi.';
};

export const APP_ADMIN_DESCRIPTION =
    'Quản trị viên hệ thống: quản lý toàn bộ gia đình và người dùng trên toàn hệ thống. Không truy cập dữ liệu tài sản, chi tiêu riêng tư của từng gia đình.';
