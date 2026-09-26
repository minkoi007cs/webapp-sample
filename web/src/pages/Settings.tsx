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
            message.success('Đã lưu hồ sơ cá nhân');
        },
        onError: () => {
            message.error('Không thể lưu hồ sơ cá nhân. Vui lòng thử lại.');
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
            message.success('Đã cập nhật tên gia đình');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Không thể cập nhật tên gia đình');
        },
    });

    const deleteFamilyMutation = useMutation({
        mutationFn: () => familyApi.delete(),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['family-profile'] });
            queryClient.invalidateQueries({ queryKey: ['admin-families'] });
            await refreshSession();
            message.success('Đã xóa gia đình thành công');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Không thể xóa gia đình');
        },
    });

    const deactivateFamilyMutation = useMutation({
        mutationFn: () => familyApi.deactivate(),
        onSuccess: async (res) => {
            queryClient.invalidateQueries({ queryKey: ['family-profile'] });
            queryClient.invalidateQueries({ queryKey: ['admin-families'] });
            await refreshSession();
            message.success(res.data.message);
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Không thể tạm ngưng gia đình');
        },
    });

    const leaveFamilyMutation = useMutation({
        mutationFn: () => familyApi.leave(),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['family-profile'] });
            await refreshSession();
            message.success('Bạn đã rời khỏi gia đình');
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Không thể rời khỏi gia đình');
        },
    });

    const profileTab = (
        <div className="space-y-6">
            <Card title={<div className="flex items-center gap-2"><User size={18} /><span>Hồ sơ cá nhân</span></div>} className="shadow-sm border-slate-100 rounded-2xl overflow-hidden">
                <Form form={form} layout="vertical" onFinish={(v) => updateProfileMutation.mutate(v)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                            <Input placeholder="Nhập họ tên" />
                        </Form.Item>
                        <Form.Item label="Email" name="email">
                            <Input disabled />
                        </Form.Item>
                    </div>
                    <Form.Item label="Tên gọi khác cho AI" name="otherNames" extra="Phân tách bằng dấu phẩy, ví dụ: Bố, Mẹ, Bin">
                        <Input placeholder="Tên gọi khác để AI dễ nhận diện" />
                    </Form.Item>
                    <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 md:col-span-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Vai trò hiện tại</p>
                            <p className="mt-1 font-semibold text-slate-800">
                                {systemRole === 'APP_ADMIN' && role !== 'APP_ADMIN'
                                    ? `${role === 'FAMILY_ADMIN' ? 'Quản trị gia đình' : 'Thành viên'} + APP_ADMIN`
                                    : role === 'FAMILY_ADMIN' ? 'Quản trị gia đình'
                                    : role === 'MEMBER' ? 'Thành viên'
                                    : 'Quản trị ứng dụng'}
                            </p>
                            <p className="mt-1 text-xs text-slate-700">
                                {role === 'FAMILY_ADMIN' || role === 'MEMBER' ? getFamilyRoleDescription(role) : APP_ADMIN_DESCRIPTION}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Gia đình đang chọn</p>
                            <p className="mt-1 font-semibold text-slate-800">{activeFamilyName || 'Không áp dụng'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Số gia đình tham gia</p>
                            <p className="mt-1 font-semibold text-slate-800">{memberships.length}</p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<Save size={18} />}
                        title="Lưu thay đổi"
                        aria-label="Lưu thay đổi"
                        loading={updateProfileMutation.isPending}
                    />
                </Form>
            </Card>

            <Card title={<div className="flex items-center gap-2"><Shield size={18} /><span>Bảo mật</span></div>} className="shadow-sm border-slate-100 rounded-2xl overflow-hidden">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 mb-4">Bạn đang sử dụng đăng nhập qua Google. Mọi thông tin bảo mật được quản lý bởi tài khoản Google của bạn.</p>
                    <Button disabled icon={<Lock size={18} />} title="Thay đổi mật khẩu (Google)" aria-label="Thay đổi mật khẩu" />
                </div>
            </Card>
        </div>
    );

    const familyTab = canViewFamily ? (
        <div className="space-y-6">
            <Card title={<div className="flex items-center gap-2"><Building2 size={18} /><span>Thông tin gia đình</span></div>} className="shadow-sm border-slate-100 rounded-2xl overflow-hidden">
                <Form form={familyForm} layout="vertical" onFinish={(values) => updateFamilyMutation.mutate(values)}>
                    <Form.Item label="Tên gia đình" name="familyName" rules={[{ required: true, message: 'Vui lòng nhập tên gia đình' }]}>
                        <Input placeholder="Nhập tên gia đình" disabled={!canUpdateFamily} />
                    </Form.Item>
                    <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Gia đình đang chọn</p>
                            <p className="mt-1 font-semibold text-slate-800">{activeFamilyName || family?.name || 'Chưa có tên'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Trạng thái</p>
                            <p className="mt-1 font-semibold text-slate-800">{family?.status === 'INACTIVE' ? 'Ngưng hoạt động' : 'Đang hoạt động'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Số thành viên</p>
                            <p className="mt-1 font-semibold text-slate-800">{family?.members?.length ?? 0}</p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<Save size={18} />}
                        title="Lưu tên gia đình"
                        aria-label="Lưu tên gia đình"
                        loading={updateFamilyMutation.isPending}
                        disabled={!canUpdateFamily}
                    />
                </Form>
            </Card>

            {(role === 'FAMILY_ADMIN' || systemRole === 'APP_ADMIN') && family?.status !== 'INACTIVE' && (
                <Card
                    title={<div className="flex items-center gap-2 text-amber-600 font-semibold"><span>Tạm ngưng hoạt động gia đình</span></div>}
                    className="shadow-sm border-amber-100 bg-amber-50/20 rounded-2xl overflow-hidden"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-slate-800">Tạm ngưng thay vì xóa hẳn</p>
                            <p className="text-xs text-slate-700 mt-0.5">
                                Mọi thành viên (kể cả bạn) sẽ không truy cập được gia đình này cho đến khi quản trị viên hệ thống mở lại. Dữ liệu vẫn được giữ nguyên, không mất gì.
                            </p>
                        </div>
                        <Button
                            className="!border-amber-500 !text-amber-600"
                            loading={deactivateFamilyMutation.isPending}
                            onClick={() => {
                                Modal.confirm({
                                    title: `Tạm ngưng hoạt động gia đình "${family?.name || activeFamilyName}"?`,
                                    content: 'Không ai (kể cả bạn) truy cập được gia đình này cho đến khi quản trị viên hệ thống mở lại. Bạn có thể liên hệ quản trị viên bất cứ lúc nào để mở lại.',
                                    okText: 'Tạm ngưng',
                                    cancelText: 'Hủy',
                                    onOk: () => deactivateFamilyMutation.mutate(),
                                });
                            }}
                        >
                            Tạm ngưng gia đình
                        </Button>
                    </div>
                </Card>
            )}

            {(role === 'FAMILY_ADMIN' || systemRole === 'APP_ADMIN') && (
                <Card
                    title={<div className="flex items-center gap-2 text-rose-600 font-semibold"><span>Vùng nguy hiểm: Xóa không gian gia đình</span></div>}
                    className="shadow-sm border-rose-100 bg-rose-50/20 rounded-2xl overflow-hidden"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-slate-800">Xóa vĩnh viễn gia đình này</p>
                            <p className="text-xs text-slate-700 mt-0.5">
                                {(family?.members?.length ?? 0) > 1
                                    ? `Gia đình đang có ${family?.members?.length} thành viên. Bạn phải gỡ hết các thành viên khác trước khi có thể xóa gia đình.`
                                    : 'Xóa toàn bộ dữ liệu, danh mục thu chi, và hồ sơ định cư F4 gắn với gia đình này. Hành động không thể hoàn tác.'}
                            </p>
                        </div>
                        <Button
                            danger
                            type="primary"
                            disabled={(family?.members?.length ?? 0) > 1}
                            loading={deleteFamilyMutation.isPending}
                            onClick={() => {
                                Modal.confirm({
                                    title: `Xác nhận xóa vĩnh viễn gia đình "${family?.name || activeFamilyName}"?`,
                                    content: 'Toàn bộ dữ liệu thu chi, hồ sơ định cư, và phân quyền của gia đình này sẽ bị xóa hoàn toàn.',
                                    okText: 'Xóa vĩnh viễn',
                                    okType: 'danger',
                                    cancelText: 'Hủy',
                                    onOk: () => deleteFamilyMutation.mutate(),
                                });
                            }}
                        >
                            Xóa gia đình
                        </Button>
                    </div>
                </Card>
            )}

            <Card
                title={<div className="flex items-center gap-2 text-slate-600 font-semibold"><span>Rời khỏi gia đình</span></div>}
                className="shadow-sm border-slate-100 rounded-2xl overflow-hidden"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="font-semibold text-slate-800">Rời khỏi gia đình này</p>
                        <p className="text-xs text-slate-700 mt-0.5">
                            Bạn sẽ mất quyền truy cập vào dữ liệu của gia đình này. Nếu bạn là Quản trị viên duy nhất, hãy chuyển quyền cho người khác trước.
                        </p>
                    </div>
                    <Button
                        danger
                        loading={leaveFamilyMutation.isPending}
                        onClick={() => {
                            Modal.confirm({
                                title: `Rời khỏi gia đình "${family?.name || activeFamilyName}"?`,
                                content: 'Bạn có thể được mời lại sau nếu cần.',
                                okText: 'Rời khỏi',
                                okType: 'danger',
                                cancelText: 'Hủy',
                                onOk: () => leaveFamilyMutation.mutate(),
                            });
                        }}
                    >
                        Rời khỏi gia đình
                    </Button>
                </div>
            </Card>
        </div>
    ) : (
        <p className="text-sm text-slate-600 p-4">Bạn chưa tham gia gia đình nào.</p>
    );

    const appearanceTab = (
        <div className="space-y-6">
            <Card title={<div className="flex items-center gap-2"><Palette size={18} /><span>Giao diện</span></div>} className="shadow-sm border-slate-100 rounded-2xl overflow-hidden">
                <div className="rounded-2xl border border-[rgba(232,206,238,0.78)] bg-[linear-gradient(135deg,rgba(255,248,252,0.96),rgba(244,247,255,0.96))] p-4 shadow-[0_14px_30px_rgba(211,188,227,0.12)] dark-mode-preview-panel">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-800">Chế độ tối</p>
                            <p className="mt-1 text-sm text-slate-700">Chuyển đổi giữa giao diện sáng và tối để dùng thoải mái hơn vào buổi tối hoặc môi trường ít sáng.</p>
                        </div>
                        <Switch
                            checked={themeMode === 'dark'}
                            onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={`rounded-2xl border p-3 shadow-sm transition-all ${themeMode === 'light' ? 'border-[#f4d4bf] ring-2 ring-[#ffd8ca]' : 'border-[rgba(243,212,191,0.78)] bg-white/85'}`}>
                            <div className="mb-2 flex items-center gap-2 text-[#b9745f]">
                                <SunMedium size={16} />
                                <span className="text-xs font-semibold">Sáng hiện tại</span>
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 rounded-full bg-[#ffe6dc]" />
                                <div className="h-3 w-4/5 rounded-full bg-[#edf7ff]" />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="h-10 rounded-xl bg-[#fff3ec]" />
                                    <div className="h-10 rounded-xl bg-[#eef9f2]" />
                                    <div className="h-10 rounded-xl bg-[#fff7dd]" />
                                </div>
                            </div>
                        </div>

                        <div className={`rounded-2xl border bg-[linear-gradient(180deg,#293042,#1d2230)] p-3 shadow-sm transition-all ${themeMode === 'dark' ? 'border-[#7280aa] ring-2 ring-[#5f6e98]' : 'border-[rgba(110,118,148,0.32)]'}`}>
                            <div className="mb-2 flex items-center gap-2 text-[#d8def6]">
                                <MoonStar size={16} />
                                <span className="text-xs font-semibold">Bản tối dự kiến</span>
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 rounded-full bg-[#44506b]" />
                                <div className="h-3 w-4/5 rounded-full bg-[#353f56]" />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="h-10 rounded-xl bg-[#31394d]" />
                                    <div className="h-10 rounded-xl bg-[#273445]" />
                                    <div className="h-10 rounded-xl bg-[#3a2f4f]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-700">
                        <Sparkles size={14} className="text-[#9b7fd4]" />
                        <span>Giao diện đang áp dụng ngay cho các bề mặt chính, bảng, biểu mẫu và popup.</span>
                    </div>
                </div>
            </Card>

            <Card title={<div className="flex items-center gap-2"><Bell size={18} /><span>Thông báo</span></div>} className="shadow-sm border-slate-100 rounded-2xl overflow-hidden">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-800">Thông báo qua Email</p>
                            <p className="text-sm text-slate-700">Nhận thông báo về các thay đổi trong gia đình qua email</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                    <Divider className="my-2" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-800">Cảnh báo bảo hành</p>
                            <p className="text-sm text-slate-700">Thông báo khi tài sản sắp hết hạn bảo hành</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            </Card>
        </div>
    );

    const tabItems = [
        { key: 'profile', label: 'Hồ sơ cá nhân', children: profileTab },
        { key: 'family', label: 'Gia đình', children: familyTab },
        ...(canViewMembers ? [{ key: 'members', label: 'Thành viên', children: <MemberList /> }] : []),
        ...(canViewCategories ? [{ key: 'categories', label: 'Danh mục', children: <CategoryList /> }] : []),
        { key: 'appearance', label: 'Giao diện', children: appearanceTab },
    ];

    return (
        <div className="space-y-4 max-w-5xl animate-in fade-in duration-500">
            <header>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-display">Thiết lập</h1>
            </header>

            <Tabs items={tabItems} className="settings-tabs" />
        </div>
    );
};
