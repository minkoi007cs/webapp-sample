import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Select, Modal, Form, Input, Button, Tooltip } from 'antd';
import {
    Rocket,
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
    { name: 'Starter Guide', href: '/', icon: Rocket, moduleKey: null, badge: 'Start Here' },
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, moduleKey: 'DASHBOARD' as const },
    { name: 'Assets', href: '/assets', icon: Package, moduleKey: 'ASSET' as const },
    { name: 'Maintenance & Debt', href: '/maintenance', icon: Wrench, moduleKey: 'ASSET' as const },
    { name: 'Finances', href: '/expenses', icon: Receipt, moduleKey: 'TRANSACTION' as const },
    { name: 'Documents', href: '/documents', icon: FolderArchive, moduleKey: 'DOCUMENT' as const },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays, moduleKey: 'CALENDAR' as const },
    { name: 'System Admin', href: '/admin', icon: ShieldCheck, moduleKey: 'ADMIN' as const },
    { name: 'Settings', href: '/settings', icon: Settings, moduleKey: null },
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
        ? `System Admin${role && role !== 'APP_ADMIN' ? ` · ${role === 'FAMILY_ADMIN' ? 'Admin' : 'Member'}` : ''}`
        : role === 'FAMILY_ADMIN'
            ? 'Family Admin'
            : 'Member';

    const roleTooltip = systemRole === 'APP_ADMIN' && role !== 'FAMILY_ADMIN' && role !== 'MEMBER'
        ? APP_ADMIN_DESCRIPTION
        : getFamilyRoleDescription(role === 'FAMILY_ADMIN' || role === 'MEMBER' ? role : null);

    return (
        <aside className="w-64 h-screen flex flex-col p-3 relative bg-card text-card-foreground border-r border-border shadow-xs">
            <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                aria-label="Close sidebar"
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
                    <h1 className="font-semibold text-sm text-foreground tracking-tight truncate">Family Assets</h1>
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
                        title="Create new workspace"
                    >
                        <Plus size={12} />
                        <span>Create</span>
                    </button>
                </div>
                {memberships.length > 0 ? (
                    <Select
                        value={activeFamilyId ?? undefined}
                        size="small"
                        className="w-full"
                        placeholder="Select workspace"
                        loading={isSwitchingFamily}
                        onChange={(value) => switchFamily(value)}
                        options={memberships.map((membership) => {
                            const isInactive = membership.familyStatus === 'INACTIVE';
                            return {
                                value: membership.familyId,
                                disabled: isInactive,
                                label: `${membership.familyName} · ${membership.role === 'FAMILY_ADMIN' ? 'Admin' : 'Member'}${isInactive ? ' · Inactive' : ''}`,
                            };
                        })}
                    />
                ) : (
                    <div className="mt-1">
                        <p className="text-xs text-muted-foreground">{activeFamilyName || 'No workspace selected'}</p>
                        <Button
                            type="dashed"
                            size="small"
                            icon={<Plus size={12} />}
                            className="mt-1.5 w-full text-xs"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Create First Workspace
                        </Button>
                    </div>
                )}
            </div>

            <Modal
                title={
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Users size={16} className="text-primary" />
                        <span>Create New Workspace</span>
                    </div>
                }
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                footer={null}
                centered
                destroyOnClose
            >
                <p className="text-xs text-muted-foreground mb-4">
                    Create a new family space to independently manage assets, expenses, and records. You will be the Administrator.
                </p>
                <Form form={form} layout="vertical" onFinish={handleCreateFamily}>
                    <Form.Item
                        name="name"
                        label="Workspace Name"
                        rules={[{ required: true, message: 'Please enter workspace name' }]}
                    >
                        <Input placeholder="e.g. John's Family" />
                    </Form.Item>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isCreatingFamily}
                        >
                            Create Workspace
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
                title="Log out"
                aria-label="Log out"
                className="mt-auto flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
            >
                <LogOut size={16} className="shrink-0" />
                <span>Log out</span>
            </button>
        </aside>
    );
};

