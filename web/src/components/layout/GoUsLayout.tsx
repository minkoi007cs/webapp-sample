import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Select } from 'antd';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useSession } from '../auth/SessionProvider';

export const GoUsLayout = () => {
    const navigate = useNavigate();
    const { activeGroupId, activeGroupName, memberships, switchGroup, isSwitchingGroup } = useSession();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5">
                    <Link
                        to="/"
                        title="Về trang chủ"
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">Trang chủ</span>
                    </Link>

                    <div className="flex-1" />

                    {memberships.length > 0 ? (
                        <Select
                            value={activeGroupId ?? undefined}
                            placeholder={activeGroupName ?? 'Chọn nhóm'}
                            size="small"
                            className="w-36 sm:w-52"
                            loading={isSwitchingGroup}
                            onChange={(value) => switchGroup(value)}
                            options={memberships.map((membership) => ({
                                value: membership.groupId,
                                label: membership.groupName,
                            }))}
                        />
                    ) : null}

                    <button
                        type="button"
                        onClick={handleLogout}
                        title="Đăng xuất"
                        aria-label="Đăng xuất"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
};
