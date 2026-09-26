import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useSession } from '../auth/SessionProvider';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

export const MobileHeader = ({ onMenuClick }: MobileHeaderProps) => {
    const { activeGroupName } = useSession();

    return (
        <header className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-md border-b border-border z-40 flex items-center justify-between px-4 lg:hidden">
            <Link
                to="/"
                className="flex min-w-0 items-center gap-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
                <img
                    src="/logo.svg"
                    alt=""
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-md shrink-0"
                />
                <div className="min-w-0">
                    <h1 className="font-semibold text-sm leading-tight text-foreground tracking-tight">Sample Manager</h1>
                    {activeGroupName && (
                        <p className="truncate text-xs leading-tight text-muted-foreground">{activeGroupName}</p>
                    )}
                </div>
            </Link>

            <button
                onClick={onMenuClick}
                className="p-1.5 hover:bg-accent rounded-md transition-colors text-foreground border border-border shadow-xs"
                aria-label="Mở menu"
            >
                <Menu size={20} />
            </button>
        </header>
    );
};
