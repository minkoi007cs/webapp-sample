export type FamilyRoleCode = 'FAMILY_ADMIN' | 'MEMBER' | null | undefined;

export const getFamilyRoleDescription = (role: FamilyRoleCode): string => {
    if (role === 'FAMILY_ADMIN') {
        return 'Full permissions: invite/manage members, manage categories, assets, finances, calendar, and documents.';
    }
    return 'Member permissions: view workspace information and member list; full control over assets, finances, calendar, and documents.';
};

export const APP_ADMIN_DESCRIPTION =
    'System Administrator: manage all workspaces and users across the platform.';

