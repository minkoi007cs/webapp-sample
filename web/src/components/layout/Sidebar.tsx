import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Select, Modal, Form, Input, Button, Tooltip } from 'antd';
import {
    LayoutDashboard,
    Package,
    Receipt,
    Settings,
    LogOut,
    X,
    CalendarDays,
    ShieldCheck,
    Wrench,
    Plus,
    Users,
    FolderArchive,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useSession } from '../auth/SessionProvider';
import { getFamilyRoleDescription, APP_ADMIN_DESCRIPTION } from '../../utils/roleDescriptions';

const navigation = [
    { name: 'Tổng quan', href: '/', icon: LayoutDashboard, moduleKey: 'DASHBOARD' as const },
    { name: 'Quản lý tài sản', href: '/assets', icon: Package, moduleKey: 'ASSET' as const },
    { name: 'Bảo trì khai thác và nợ', href: '/maintenance', icon: Wrench, moduleKey: 'ASSET' as const },
    { name: 'Quản lý tài chính', href: '/expenses', icon: Receipt, moduleKey: 'TRANSACTION' as const },
    { name: 'Kho tài liệu', href: '/documents', icon: FolderArchive, moduleKey: 'DOCUMENT' as const },
    { name: 'Lịch gia đình', href: '/calendar', icon: CalendarDays, moduleKey: 'CALENDAR' as const },
    { name: 'Quản trị hệ thống', href: '/admin', icon: ShieldCheck, moduleKey: 'ADMIN' as const },
    { name: 'Thiết lập', href: '/settings', icon: Settings, moduleKey: null },
];

interface SidebarProps {
    onClose?: () => void;
}

export const Sidebar = ({ onClose }: SidebarProps) => {
    const navigate = useNavigate();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [form] = Form.useForm();
    const {
        activeFamilyId,
        activeFamilyName,
        memberships,
        role,
        systemRole,
        canAccess,
        switchFamily,
        isSwitchingFamily,
        createFamily,
        isCreatingFamily,
    } = useSession();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
        onClose?.();
    };

    const handleCreateFamily = async (values: { name: string }) => {
        await createFamily(values.name);
        setIsCreateModalOpen(false);
        form.resetFields();
    };

    const visibleNavigation = navigation.filter((item) => item.moduleKey === null || canAccess(item.moduleKey, 'view'));

    const roleLabel = systemRole === 'APP_ADMIN'
        ? `Quản trị ứng dụng${role && role !== 'APP_ADMIN' ? ` · ${role === 'FAMILY_ADMIN' ? 'Quản trị gia đình' : 'Thành viên'}` : ''}`
        : role === 'FAMILY_ADMIN'
            ? 'Quản trị gia đình'
            : 'Thành viên';

    const roleTooltip = systemRole === 'APP_ADMIN' && role !== 'FAMILY_ADMIN' && role !== 'MEMBER'
        ? APP_ADMIN_DESCRIPTION
        : getFamilyRoleDescription(role === 'FAMILY_ADMIN' || role === 'MEMBER' ? role : null);

    return (
        <aside className="w-64 h-screen flex flex-col p-3 relative bg-card text-card-foreground border-r border-border shadow-xs">
            <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                aria-label="Đóng thanh bên"
            >
                <X size={18} />
            </button>

            <Link
                to="/"
                onClick={() => onClose?.()}
                className="mb-3 flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors shadow-xs"
            >
                <img
                    src="/logo.svg"
                    alt=""
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-md shrink-0"
                />
                <div className="min-w-0">
                    <h1 className="font-semibold text-sm text-foreground tracking-tight truncate">Tài sản Gia đình</h1>
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
                        title="Tạo gia đình mới"
                    >
                        <Plus size={12} />
                        <span>Tạo mới</span>
                    </button>
                </div>
                {memberships.length > 0 ? (
                    <Select
                        value={activeFamilyId ?? undefined}
                        size="small"
                        className="w-full"
                        placeholder="Chọn gia đình"
                        loading={isSwitchingFamily}
                        onChange={(value) => switchFamily(value)}
                        options={memberships.map((membership) => {
                            const isInactive = membership.familyStatus === 'INACTIVE';
                            return {
                                value: membership.familyId,
                                disabled: isInactive,
                                label: `${membership.familyName} · ${membership.role === 'FAMILY_ADMIN' ? 'Quản trị' : 'Thành viên'}${isInactive ? ' · Tạm ngưng' : ''}`,
                            };
                        })}
                    />
                ) : (
                    <div className="mt-1">
                        <p className="text-xs text-muted-foreground">{activeFamilyName || 'Chưa có gia đình'}</p>
                        <Button
                            type="dashed"
                            size="small"
                            icon={<Plus size={12} />}
                            className="mt-1.5 w-full text-xs"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Tạo gia đình đầu tiên
                        </Button>
                    </div>
                )}
            </div>

            <Modal
                title={
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Users size={16} className="text-primary" />
                        <span>Tạo Không Gian Gia Đình Mới</span>
                    </div>
                }
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                footer={null}
                centered
                destroyOnClose
            >
                <p className="text-xs text-muted-foreground mb-4">
                    Tạo một gia đình mới để quản lý độc lập tài sản, chi tiêu và hồ sơ riêng biệt. Bạn sẽ là Quản trị viên của gia đình này.
                </p>
                <Form form={form} layout="vertical" onFinish={handleCreateFamily}>
                    <Form.Item
                        name="name"
                        label="Tên gia đình"
                        rules={[{ required: true, message: 'Vui lòng nhập tên gia đình' }]}
                    >
                        <Input placeholder="Ví dụ: Gia đình Nguyễn Văn A" />
                    </Form.Item>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isCreatingFamily}
                        >
                            Tạo gia đình
                        </Button>
                    </div>
                </Form>
            </Modal>

            <nav className="flex-1 space-y-1 overflow-y-auto pr-0.5">
                {visibleNavigation.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={() => onClose?.()}
                        className={({ isActive }) => cn(
                            "group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            isActive
                                ? "bg-secondary text-secondary-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                        )}
                    >
                        <item.icon size={16} className="shrink-0" />
                        <span className="truncate">{item.name}</span>
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
