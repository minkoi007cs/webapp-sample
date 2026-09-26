import { useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Divider, message, Tabs, Modal } from 'antd';
import { Building2, User, Bell, Shield, Palette, MoonStar, SunMedium, Sparkles, Save, Lock } from 'lucide-react';
import { useThemeMode } from '../components/theme/ThemeProvider';
import { useSession } from '../components/auth/SessionProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { adminApi } from '../api/admin';
import { familyApi } from '../api/family';
import { getFamilyRoleDescription, APP_ADMIN_DESCRIPTION } from '../utils/roleDescriptions';
import { MemberList } from './MemberList';
import { CategoryList } from './CategoryList';

export const Settings = () => {
    const [form] = Form.useForm();
    const [familyForm] = Form.useForm();
    const { themeMode, setThemeMode } = useThemeMode();
    const queryClient = useQueryClient();
    const { user, role, systemRole, activeFamilyId, activeFamilyName, memberships, refreshSession, canAccess } = useSession();

    useEffect(() => {
        form.setFieldsValue({
            fullName: user?.fullName || '',
            email: user?.email || '',
            otherNames: user?.otherNames || '',
        });
    }, [form, user]);

    const canViewFamily = Boolean(activeFamilyId && (canAccess('FAMILY', 'view') || systemRole === 'APP_ADMIN'));
    const canUpdateFamily = Boolean(activeFamilyId && (canAccess('FAMILY', 'update') || systemRole === 'APP_ADMIN'));
    const canViewMembers = canAccess('USER', 'view');
    const canViewCategories = canAccess('CATEGORY', 'view');

    const { data: family } = useQuery({
        queryKey: ['family-profile', activeFamilyId],
        enabled: canViewFamily,
        queryFn: () => familyApi.findOne().then((res) => res.data),
    });

    useEffect(() => {
        familyForm.setFieldsValue({
            familyName: family?.name || activeFamilyName || '',
        });
    }, [familyForm, family?.name, activeFamilyName]);

    const updateProfileMutation = useMutation({
        mutationFn: (values: { fullName?: string; otherNames?: string }) => authApi.updateMe(values),
        onSuccess: async () => {
            await refreshSession();
            message.success('Personal profile saved');
        },
        onError: () => {
            message.error('Failed to save profile. Please retry.');
        },
    });

    const updateFamilyMutation = useMutation({
        mutationFn: (values: { familyName?: string }) => {
            if (!activeFamilyId) throw new Error('missing-family');
            if (systemRole === 'APP_ADMIN') {
                return adminApi.updateFamilyProfile(activeFamilyId, { name: values.familyName });
            }
            return familyApi.update({ name: values.familyName });
        },
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['family-profile', activeFamilyId] });
            queryClient.invalidateQueries({ queryKey: ['admin-families'] });
            await refreshSession();
            message.success('Family name updated');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Failed to update family name');
        },
    });

    const deleteFamilyMutation = useMutation({
        mutationFn: () => familyApi.delete(),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['family-profile'] });
            queryClient.invalidateQueries({ queryKey: ['admin-families'] });
            await refreshSession();
            message.success('Family workspace deleted successfully');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Failed to delete workspace');
        },
    });

    const deactivateFamilyMutation = useMutation({
        mutationFn: () => familyApi.deactivate(),
        onSuccess: async (res) => {
            queryClient.invalidateQueries({ queryKey: ['family-profile'] });
            queryClient.invalidateQueries({ queryKey: ['admin-families'] });
            await refreshSession();
            message.success(res.data.message || 'Workspace deactivated');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Failed to deactivate workspace');
        },
    });

    const leaveFamilyMutation = useMutation({
        mutationFn: () => familyApi.leave(),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['family-profile'] });
            await refreshSession();
            message.success('You have left the workspace');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Failed to leave workspace');
        },
    });

    const profileTab = (
        <div className="space-y-6">
            <Card title={<div className="flex items-center gap-2"><User size={18} /><span>Profile</span></div>} className="shadow-sm border-border rounded-2xl overflow-hidden glass-card">
                <Form form={form} layout="vertical" onFinish={(v) => updateProfileMutation.mutate(v)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <Form.Item label="Full Name" name="fullName" rules={[{ required: true, message: 'Please enter your full name' }]}>
                            <Input placeholder="Enter full name" />
                        </Form.Item>
                        <Form.Item label="Email" name="email">
                            <Input disabled />
                        </Form.Item>
                    </div>
                    <Form.Item label="Alternative Names / Nicknames (for AI)" name="otherNames" extra="Comma-separated names, e.g., Dad, Mom, Mike">
                        <Input placeholder="Nicknames for AI recognition" />
                    </Form.Item>
                    <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-3">
                        <div className="rounded-2xl bg-muted/40 px-4 py-3 md:col-span-3 border border-border">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Role</p>
                            <p className="mt-1 font-semibold text-foreground">
                                {systemRole === 'APP_ADMIN' && role !== 'APP_ADMIN'
                                    ? `${role === 'FAMILY_ADMIN' ? 'Workspace Admin' : 'Member'} + System Admin`
                                    : role === 'FAMILY_ADMIN' ? 'Workspace Admin'
                                    : role === 'MEMBER' ? 'Member'
                                    : 'System Admin'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {role === 'FAMILY_ADMIN' || role === 'MEMBER' ? getFamilyRoleDescription(role) : APP_ADMIN_DESCRIPTION}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-muted/40 px-4 py-3 border border-border">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Active Workspace</p>
                            <p className="mt-1 font-semibold text-foreground">{activeFamilyName || 'None'}</p>
                        </div>
                        <div className="rounded-2xl bg-muted/40 px-4 py-3 border border-border">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspaces Joined</p>
                            <p className="mt-1 font-semibold text-foreground">{memberships.length}</p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<Save size={18} />}
                        title="Save Changes"
                        aria-label="Save Changes"
                        loading={updateProfileMutation.isPending}
                    >
                        Save Changes
                    </Button>
                </Form>
            </Card>

            <Card title={<div className="flex items-center gap-2"><Shield size={18} /><span>Security</span></div>} className="shadow-sm border-border rounded-2xl overflow-hidden glass-card">
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">You are logged in via Google OAuth. Account security and authentication are handled securely by Google.</p>
                    <Button disabled icon={<Lock size={18} />} title="Change Password (Google)" aria-label="Change Password">
                        Managed by Google
                    </Button>
                </div>
            </Card>
        </div>
    );

    const familyTab = canViewFamily ? (
        <div className="space-y-6">
            <Card title={<div className="flex items-center gap-2"><Building2 size={18} /><span>Workspace Information</span></div>} className="shadow-sm border-border rounded-2xl overflow-hidden glass-card">
                <Form form={familyForm} layout="vertical" onFinish={(values) => updateFamilyMutation.mutate(values)}>
                    <Form.Item label="Workspace Name" name="familyName" rules={[{ required: true, message: 'Please enter workspace name' }]}>
                        <Input placeholder="Enter workspace name" disabled={!canUpdateFamily} />
                    </Form.Item>
                    <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-3">
                        <div className="rounded-2xl bg-muted/40 px-4 py-3 border border-border">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Workspace</p>
                            <p className="mt-1 font-semibold text-foreground">{activeFamilyName || family?.name || 'Untitled'}</p>
                        </div>
                        <div className="rounded-2xl bg-muted/40 px-4 py-3 border border-border">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                            <p className="mt-1 font-semibold text-foreground">{family?.status === 'INACTIVE' ? 'Inactive' : 'Active'}</p>
                        </div>
                        <div className="rounded-2xl bg-muted/40 px-4 py-3 border border-border">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Members</p>
                            <p className="mt-1 font-semibold text-foreground">{family?.members?.length ?? 0}</p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<Save size={18} />}
                        title="Save Workspace Name"
                        aria-label="Save Workspace Name"
                        loading={updateFamilyMutation.isPending}
                        disabled={!canUpdateFamily}
                    >
                        Save Workspace Name
                    </Button>
                </Form>
            </Card>

            {(role === 'FAMILY_ADMIN' || systemRole === 'APP_ADMIN') && family?.status !== 'INACTIVE' && (
                <Card
                    title={<div className="flex items-center gap-2 text-amber-600 font-semibold"><span>Deactivate Workspace</span></div>}
                    className="shadow-sm border-amber-500/20 bg-amber-500/5 rounded-2xl overflow-hidden"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-foreground">Suspend workspace access</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                All members will lose access until reactivated by a system administrator. All data is preserved.
                            </p>
                        </div>
                        <Button
                            className="!border-amber-500 !text-amber-600"
                            loading={deactivateFamilyMutation.isPending}
                            onClick={() => {
                                Modal.confirm({
                                    title: `Deactivate workspace "${family?.name || activeFamilyName}"?`,
                                    content: 'Members will not have access until reactivated. You can request reactivation at any time.',
                                    okText: 'Deactivate',
                                    cancelText: 'Cancel',
                                    onOk: () => deactivateFamilyMutation.mutate(),
                                });
                            }}
                        >
                            Deactivate
                        </Button>
                    </div>
                </Card>
            )}

            {(role === 'FAMILY_ADMIN' || systemRole === 'APP_ADMIN') && (
                <Card
                    title={<div className="flex items-center gap-2 text-rose-600 font-semibold"><span>Danger Zone: Delete Workspace</span></div>}
                    className="shadow-sm border-rose-500/20 bg-rose-500/5 rounded-2xl overflow-hidden"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-foreground">Permanently delete this workspace</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {(family?.members?.length ?? 0) > 1
                                    ? `Workspace has ${family?.members?.length} members. You must remove other members before deleting.`
                                    : 'Deletes all transactions, assets, documents, and associated records. This action is irreversible.'}
                            </p>
                        </div>
                        <Button
                            danger
                            type="primary"
                            disabled={(family?.members?.length ?? 0) > 1}
                            loading={deleteFamilyMutation.isPending}
                            onClick={() => {
                                Modal.confirm({
                                    title: `Permanently delete workspace "${family?.name || activeFamilyName}"?`,
                                    content: 'All data and records will be permanently removed.',
                                    okText: 'Delete Permanently',
                                    okType: 'danger',
                                    cancelText: 'Cancel',
                                    onOk: () => deleteFamilyMutation.mutate(),
                                });
                            }}
                        >
                            Delete Workspace
                        </Button>
                    </div>
                </Card>
            )}

            <Card
                title={<div className="flex items-center gap-2 text-muted-foreground font-semibold"><span>Leave Workspace</span></div>}
                className="shadow-sm border-border rounded-2xl overflow-hidden glass-card"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="font-semibold text-foreground">Leave this workspace</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            You will lose access to data in this workspace. If you are the sole administrator, transfer admin rights first.
                        </p>
                    </div>
                    <Button
                        danger
                        loading={leaveFamilyMutation.isPending}
                        onClick={() => {
                            Modal.confirm({
                                title: `Leave workspace "${family?.name || activeFamilyName}"?`,
                                content: 'You will need a new invite to rejoin later.',
                                okText: 'Leave',
                                okType: 'danger',
                                cancelText: 'Cancel',
                                onOk: () => leaveFamilyMutation.mutate(),
                            });
                        }}
                    >
                        Leave Workspace
                    </Button>
                </div>
            </Card>
        </div>
    ) : (
        <p className="text-sm text-muted-foreground p-4">You have not joined any workspace yet.</p>
    );

    const appearanceTab = (
        <div className="space-y-6">
            <Card title={<div className="flex items-center gap-2"><Palette size={18} /><span>Appearance</span></div>} className="shadow-sm border-border rounded-2xl overflow-hidden glass-card">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="font-semibold text-foreground">Dark Mode</p>
                            <p className="mt-1 text-sm text-muted-foreground">Toggle between light and dark theme according to your preference.</p>
                        </div>
                        <Switch
                            checked={themeMode === 'dark'}
                            onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={`rounded-2xl border p-3 shadow-sm transition-all ${themeMode === 'light' ? 'border-primary ring-2 ring-primary/20 bg-card' : 'border-border bg-muted/30'}`}>
                            <div className="mb-2 flex items-center gap-2 text-foreground">
                                <SunMedium size={16} />
                                <span className="text-xs font-semibold">Light Theme</span>
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 rounded-full bg-muted" />
                                <div className="h-3 w-4/5 rounded-full bg-muted/60" />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="h-10 rounded-xl bg-card border border-border" />
                                    <div className="h-10 rounded-xl bg-card border border-border" />
                                    <div className="h-10 rounded-xl bg-card border border-border" />
                                </div>
                            </div>
                        </div>

                        <div className={`rounded-2xl border p-3 shadow-sm transition-all ${themeMode === 'dark' ? 'border-primary ring-2 ring-primary/20 bg-card' : 'border-border bg-muted/30'}`}>
                            <div className="mb-2 flex items-center gap-2 text-foreground">
                                <MoonStar size={16} />
                                <span className="text-xs font-semibold">Dark Theme</span>
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 rounded-full bg-muted" />
                                <div className="h-3 w-4/5 rounded-full bg-muted/60" />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="h-10 rounded-xl bg-card border border-border" />
                                    <div className="h-10 rounded-xl bg-card border border-border" />
                                    <div className="h-10 rounded-xl bg-card border border-border" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles size={14} className="text-primary" />
                        <span>Theme changes are applied immediately across all views, tables, forms, and dialogs.</span>
                    </div>
                </div>
            </Card>

            <Card title={<div className="flex items-center gap-2"><Bell size={18} /><span>Notifications</span></div>} className="shadow-sm border-border rounded-2xl overflow-hidden glass-card">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-foreground">Email Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive email alerts for important workspace activities</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                    <Divider className="my-2" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-foreground">Warranty & Milestone Alerts</p>
                            <p className="text-sm text-muted-foreground">Receive notifications when asset warranties or milestones approach</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            </Card>
        </div>
    );

    const tabItems = [
        { key: 'profile', label: 'Profile', children: profileTab },
        { key: 'family', label: 'Workspace', children: familyTab },
        ...(canViewMembers ? [{ key: 'members', label: 'Members', children: <MemberList /> }] : []),
        ...(canViewCategories ? [{ key: 'categories', label: 'Categories', children: <CategoryList /> }] : []),
        { key: 'appearance', label: 'Appearance', children: appearanceTab },
    ];

    return (
        <div className="space-y-4 max-w-5xl animate-in fade-in duration-500">
            <header>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight font-sans">Settings</h1>
            </header>

            <Tabs items={tabItems} className="settings-tabs" />
        </div>
    );
};
