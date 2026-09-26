import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';

export const MainLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
            {/* Mobile Header */}
            <MobileHeader onMenuClick={toggleSidebar} />

            {/* Sidebar - Desktop (fixed) and Mobile (Drawer-like overlay) */}
            <div className={`
                fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-0
                transition-all duration-300 transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Backdrop for mobile */}
                {isSidebarOpen && (
                    <div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm lg:hidden"
                        onClick={closeSidebar}
                    />
                )}

                <Sidebar onClose={closeSidebar} />
            </div>

            {/* Main Content */}
            <main className="relative flex-1 w-full min-h-screen lg:min-w-0 overflow-x-hidden">
                <div className="p-4 lg:p-6 max-w-7xl mx-auto pt-18 lg:pt-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

