import { useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Divider, message, Tabs } from 'antd';
import { Building2, User, Bell, Shield, Palette, MoonStar, SunMedium, Sparkles, Save, Lock } from 'lucide-react';
import { useThemeMode } from '../components/theme/ThemeProvider';
import { useSession } from '../components/auth/SessionProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { groupApi } from '../api/group';
import { getFamilyRoleDescription, APP_ADMIN_DESCRIPTION } from '../utils/roleDescriptions';
import { MemberList } from './MemberList';
import { CategoryList } from './CategoryList';

export const Settings = () => {
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
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

  const canViewGroup = Boolean(activeFamilyId && (canAccess('FAMILY', 'view') || systemRole === 'APP_ADMIN'));
  const canUpdateGroup = Boolean(activeFamilyId && (canAccess('FAMILY', 'update') || systemRole === 'APP_ADMIN'));
  const canViewMembers = canAccess('USER', 'view');
  const canViewCategories = canAccess('CATEGORY', 'view');

  useEffect(() => {
    groupForm.setFieldsValue({
      groupName: activeFamilyName || '',
    });
  }, [groupForm, activeFamilyName]);

  const updateProfileMutation = useMutation({
    mutationFn: (values: { fullName?: string; otherNames?: string }) => authApi.updateMe(values),
    onSuccess: async () => {
      await refreshSession();
      message.success('Cập nhật thông tin cá nhân thành công');
    },
    onError: () => {
      message.error('Không thể lưu thông tin. Vui lòng thử lại.');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (values: { groupName?: string }) => {
      if (!values.groupName) throw new Error('missing-name');
      return groupApi.updateCurrent({ name: values.groupName });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      await refreshSession();
      message.success('Cập nhật tên nhóm thành công');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể cập nhật tên nhóm');
    },
  });

  const profileTab = (
    <div className="space-y-6">
      <Card title={<div className="flex items-center gap-2"><User size={18} /><span>Hồ sơ cá nhân</span></div>} className="shadow-xs border-border rounded-xl glass-card">
        <Form form={form} layout="vertical" onFinish={(v) => updateProfileMutation.mutate(v)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
              <Input placeholder="Nhập họ và tên" />
            </Form.Item>
            <Form.Item label="Email" name="email">
              <Input disabled />
            </Form.Item>
          </div>
          <Form.Item label="Tên gọi khác / Biệt danh (cho AI)" name="otherNames" extra="Các tên cách nhau bởi dấu phẩy">
            <Input placeholder="Ví dụ: Anh Ba, Khoi..." />
          </Form.Item>
          <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-xl bg-muted/40 px-4 py-3 md:col-span-3 border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Vai trò hiện tại</p>
              <p className="mt-1 font-semibold text-foreground">
                {systemRole === 'APP_ADMIN' && role !== 'APP_ADMIN'
                  ? `${role === 'FAMILY_ADMIN' ? 'Quản trị nhóm' : 'Thành viên'} + Quản trị hệ thống`
                  : role === 'FAMILY_ADMIN' ? 'Quản trị nhóm'
                  : role === 'MEMBER' ? 'Thành viên'
                  : 'Quản trị hệ thống'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {role === 'FAMILY_ADMIN' || role === 'MEMBER' ? getFamilyRoleDescription(role) : APP_ADMIN_DESCRIPTION}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3 border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Nhóm đang chọn</p>
              <p className="mt-1 font-semibold text-foreground">{activeFamilyName || 'Chưa chọn'}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3 border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Số nhóm đã tham gia</p>
              <p className="mt-1 font-semibold text-foreground">{memberships.length}</p>
            </div>
          </div>
          <Button
            type="primary"
            htmlType="submit"
            icon={<Save size={16} />}
            loading={updateProfileMutation.isPending}
          >
            Lưu thay đổi
          </Button>
        </Form>
      </Card>

      <Card title={<div className="flex items-center gap-2"><Shield size={18} /><span>Bảo mật</span></div>} className="shadow-xs border-border rounded-xl glass-card">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">Đăng nhập được xác thực an toàn qua Google OAuth.</p>
          <Button disabled icon={<Lock size={16} />}>
            Quản lý bởi Google
          </Button>
        </div>
      </Card>
    </div>
  );

  const groupTab = canViewGroup ? (
    <div className="space-y-6">
      <Card title={<div className="flex items-center gap-2"><Building2 size={18} /><span>Thông tin Nhóm làm việc</span></div>} className="shadow-xs border-border rounded-xl glass-card">
        <Form form={groupForm} layout="vertical" onFinish={(values) => updateGroupMutation.mutate(values)}>
          <Form.Item label="Tên nhóm làm việc" name="groupName" rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}>
            <Input placeholder="Nhập tên nhóm" disabled={!canUpdateGroup} />
          </Form.Item>
          <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div className="rounded-xl bg-muted/40 px-4 py-3 border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Nhóm hiện tại</p>
              <p className="mt-1 font-semibold text-foreground">{activeFamilyName || 'Chưa đặt tên'}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3 border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Trạng thái</p>
              <p className="mt-1 font-semibold text-foreground">Đang hoạt động</p>
            </div>
          </div>
          <Button
            type="primary"
            htmlType="submit"
            icon={<Save size={16} />}
            loading={updateGroupMutation.isPending}
            disabled={!canUpdateGroup}
          >
            Lưu tên nhóm
          </Button>
        </Form>
      </Card>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground p-4">Bạn chưa tham gia nhóm nào.</p>
  );

  const appearanceTab = (
    <div className="space-y-6">
      <Card title={<div className="flex items-center gap-2"><Palette size={18} /><span>Giao diện</span></div>} className="shadow-xs border-border rounded-xl glass-card">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Chế độ tối (Dark Mode)</p>
              <p className="mt-1 text-sm text-muted-foreground">Chuyển đổi giữa giao diện sáng và tối.</p>
            </div>
            <Switch
              checked={themeMode === 'dark'}
              onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`rounded-xl border p-3 shadow-xs transition-all ${themeMode === 'light' ? 'border-primary ring-2 ring-primary/20 bg-card' : 'border-border bg-muted/30'}`}>
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <SunMedium size={16} />
                <span className="text-xs font-semibold">Giao diện sáng</span>
              </div>
            </div>

            <div className={`rounded-xl border p-3 shadow-xs transition-all ${themeMode === 'dark' ? 'border-primary ring-2 ring-primary/20 bg-card' : 'border-border bg-muted/30'}`}>
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <MoonStar size={16} />
                <span className="text-xs font-semibold">Giao diện tối</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles size={14} className="text-primary" />
            <span>Giao diện được áp dụng ngay lập tức trên toàn bộ ứng dụng.</span>
          </div>
        </div>
      </Card>

      <Card title={<div className="flex items-center gap-2"><Bell size={18} /><span>Thông báo</span></div>} className="shadow-xs border-border rounded-xl glass-card">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Thông báo qua Email</p>
              <p className="text-sm text-muted-foreground">Nhận thông báo khi có cập nhật trong nhóm</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Divider className="my-2" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Nhắc nhở sự kiện & lịch trình</p>
              <p className="text-sm text-muted-foreground">Nhận thông báo khi tới hạn sự kiện</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </Card>
    </div>
  );

  const tabItems = [
    { key: 'profile', label: 'Cá nhân', children: profileTab },
    { key: 'group', label: 'Nhóm làm việc', children: groupTab },
    ...(canViewMembers ? [{ key: 'members', label: 'Thành viên', children: <MemberList /> }] : []),
    ...(canViewCategories ? [{ key: 'categories', label: 'Phân loại', children: <CategoryList /> }] : []),
    { key: 'appearance', label: 'Giao diện & Cài đặt', children: appearanceTab },
  ];

  return (
    <div className="space-y-4 max-w-5xl animate-in fade-in duration-300">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Cài Đặt</h1>
      </header>

      <Tabs items={tabItems} className="settings-tabs" />
    </div>
  );
};
