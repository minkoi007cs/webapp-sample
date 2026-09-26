import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Select, Modal, Form, Input, Button, Tooltip } from 'antd';
import {
  Rocket,
  LayoutDashboard,
  Package,
  Settings,
  LogOut,
  X,
  CalendarDays,
  ShieldCheck,
  Plus,
  Users,
  FolderArchive,
  Tags,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useSession } from '../auth/SessionProvider';
import { getGroupRoleDescription, APP_ADMIN_DESCRIPTION } from '../../utils/roleDescriptions';

const navigation = [
  { name: 'Hướng dẫn bắt đầu', href: '/', icon: Rocket, moduleKey: null, badge: 'Start Here' },
  { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard, moduleKey: 'DASHBOARD' as const },
  { name: 'Quản lý Mẫu (Samples)', href: '/samples', icon: Package, moduleKey: 'ASSET' as const },
  { name: 'Phân loại', href: '/categories', icon: Tags, moduleKey: 'CATEGORY' as const },
  { name: 'Tài liệu', href: '/documents', icon: FolderArchive, moduleKey: 'DOCUMENT' as const },
  { name: 'Thành viên', href: '/members', icon: Users, moduleKey: 'USER' as const },
  { name: 'Lịch trình', href: '/calendar', icon: CalendarDays, moduleKey: 'CALENDAR' as const },
  { name: 'Quản trị hệ thống', href: '/admin', icon: ShieldCheck, moduleKey: 'ADMIN' as const },
  { name: 'Cài đặt', href: '/settings', icon: Settings, moduleKey: null },
];

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar = ({ onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const {
    activeGroupId,
    activeGroupName,
    memberships,
    role,
    systemRole,
    canAccess,
    switchGroup,
    isSwitchingGroup,
    createGroup,
    isCreatingGroup,
  } = useSession();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    onClose?.();
  };

  const handleCreateGroup = async (values: { name: string }) => {
    await createGroup(values.name);
    setIsCreateModalOpen(false);
    form.resetFields();
  };

  const visibleNavigation = navigation.filter((item) => item.moduleKey === null || canAccess(item.moduleKey, 'view'));

  const roleLabel = systemRole === 'APP_ADMIN'
    ? `Quản trị hệ thống${role && role !== 'APP_ADMIN' ? ` · ${role === 'GROUP_ADMIN' ? 'Admin Nhóm' : 'Thành viên'}` : ''}`
    : role === 'GROUP_ADMIN'
      ? 'Quản trị Nhóm'
      : 'Thành viên';

  const roleTooltip = systemRole === 'APP_ADMIN' && role !== 'GROUP_ADMIN' && role !== 'MEMBER'
    ? APP_ADMIN_DESCRIPTION
    : getGroupRoleDescription(role === 'GROUP_ADMIN' || role === 'MEMBER' ? role : null);

  return (
    <aside className="w-64 h-screen flex flex-col p-3 relative bg-card text-card-foreground border-r border-border shadow-xs">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        aria-label="Đóng sidebar"
      >
        <X size={18} />
      </button>

      <Link
        to="/"
        onClick={() => onClose?.()}
        className="mb-3 flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors shadow-xs"
      >
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
          S
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-sm text-foreground tracking-tight truncate">Sample Manager</h1>
        </div>
      </Link>

      <div className="mb-3 rounded-lg border border-border bg-background/50 p-2.5 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <Tooltip title={roleTooltip} placement="bottomLeft">
            <p className="text-xs font-medium text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help truncate">{roleLabel}</p>
          </Tooltip>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium transition-colors"
            title="Tạo nhóm mới"
          >
            <Plus size={12} />
            <span>Tạo nhóm</span>
          </button>
        </div>
        {memberships.length > 0 ? (
          <Select
            value={activeGroupId ?? undefined}
            size="small"
            className="w-full"
            placeholder="Chọn nhóm làm việc"
            loading={isSwitchingGroup}
            onChange={(value) => switchGroup(value)}
            options={memberships.map((membership) => {
              const isInactive = membership.groupStatus === 'INACTIVE' || membership.familyStatus === 'INACTIVE';
              return {
                value: membership.groupId,
                disabled: isInactive,
                label: `${membership.groupName} · ${membership.role === 'GROUP_ADMIN' ? 'Admin' : 'Member'}${isInactive ? ' · Vô hiệu' : ''}`,
              };
            })}
          />
        ) : (
          <div className="mt-1">
            <p className="text-xs text-muted-foreground">{activeGroupName || 'Chưa chọn nhóm'}</p>
            <Button
              type="dashed"
              size="small"
              icon={<Plus size={12} />}
              className="mt-1.5 w-full text-xs"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Tạo Nhóm Đầu Tiên
            </Button>
          </div>
        )}
      </div>

      <Modal
        title={
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users size={16} className="text-primary" />
            <span>Tạo Nhóm Mới (Group)</span>
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <p className="text-xs text-muted-foreground mb-4">
          Tạo nhóm làm việc mới để quản lý danh mục mẫu, tài liệu và thành viên độc lập.
        </p>
        <Form form={form} layout="vertical" onFinish={handleCreateGroup}>
          <Form.Item
            name="name"
            label="Tên nhóm làm việc"
            rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}
          >
            <Input placeholder="Ví dụ: Nhóm Thiết Kế Mẫu A" />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isCreatingGroup}
            >
              Tạo Nhóm
            </Button>
          </div>
        </Form>
      </Modal>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-0.5">
        {visibleNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            onClick={() => onClose?.()}
            className={({ isActive }) => cn(
              "group flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <item.icon size={16} className="shrink-0" />
              <span className="truncate">{item.name}</span>
            </div>
            {'badge' in item && item.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        title="Đăng xuất"
        aria-label="Đăng xuất"
        className="mt-auto flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
      >
        <LogOut size={16} className="shrink-0" />
        <span>Đăng xuất</span>
      </button>
    </aside>
  );
};
