import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antTheme } from 'antd';
import { MainLayout } from './components/layout/MainLayout';
import { GoUsLayout } from './components/layout/GoUsLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { SessionProvider, useSession } from './components/auth/SessionProvider';
import { ThemeProvider, useThemeMode } from './components/theme/ThemeProvider';
import './index.css';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const SampleList = lazy(() => import('./pages/SampleList').then((module) => ({ default: module.SampleList })));
const MemberList = lazy(() => import('./pages/MemberList').then((module) => ({ default: module.MemberList })));
const CategoryList = lazy(() => import('./pages/CategoryList').then((module) => ({ default: module.CategoryList })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const LoginSuccess = lazy(() => import('./pages/LoginSuccess').then((module) => ({ default: module.LoginSuccess })));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite').then((module) => ({ default: module.AcceptInvite })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then((module) => ({ default: module.AdminPanel })));
const GoUsPortal = lazy(() => import('./pages/GoUsPortal').then((module) => ({ default: module.GoUsPortal })));
const Documents = lazy(() => import('./pages/Documents').then((module) => ({ default: module.Documents })));
const SetupGuide = lazy(() => import('./pages/SetupGuide').then((module) => ({ default: module.SetupGuide })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function AppShell() {
  const { themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#fafafa' : '#18181b',
          colorSuccess: isDark ? '#22c55e' : '#16a34a',
          colorWarning: isDark ? '#f59e0b' : '#d97706',
          colorError: isDark ? '#ef4444' : '#dc2626',
          colorInfo: isDark ? '#3b82f6' : '#2563eb',
          borderRadius: 8,
          fontFamily: "'Montserrat', system-ui, -apple-system, sans-serif",
          colorBgContainer: isDark ? '#09090b' : '#ffffff',
          colorBgElevated: isDark ? '#18181b' : '#ffffff',
          colorTextBase: isDark ? '#f4f4f5' : '#09090b',
          colorBorder: isDark ? '#27272a' : '#e4e4e7',
          colorBorderSecondary: isDark ? '#27272a' : '#f4f4f5',
          fontSize: 14,
          fontSizeSM: 12,
          fontSizeLG: 16,
          fontSizeXL: 20,
          colorTextSecondary: isDark ? '#a1a1aa' : '#71717a',
          colorTextTertiary: isDark ? '#71717a' : '#a1a1aa',
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 36,
            fontWeight: 500,
          },
          Table: {
            borderRadiusLG: 8,
            headerBg: isDark ? '#18181b' : '#f4f4f5',
          },
          Modal: {
            borderRadiusLG: 12,
          },
          Input: {
            controlHeight: 36,
            borderRadius: 6,
          },
          Select: {
            controlHeight: 36,
            borderRadius: 6,
          },
          DatePicker: {
            controlHeight: 36,
            borderRadius: 6,
          },
        },
      }}
    >
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/login-success" element={<LoginSuccess />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />

            <Route element={<AuthGuard />}>
              <Route path="/gous" element={<GoUsLayout />}>
                <Route index element={<ProtectedPage moduleKey="GOUS"><GoUsPortal /></ProtectedPage>} />
              </Route>

              <Route path="/" element={<MainLayout />}>
                <Route index element={<HomePage />} />
                <Route path="guide" element={<SetupGuide />} />
                <Route path="dashboard" element={<ProtectedPage moduleKey="DASHBOARD"><Dashboard /></ProtectedPage>} />
                <Route path="samples" element={<ProtectedPage moduleKey="ASSET"><SampleList /></ProtectedPage>} />
                <Route path="assets" element={<Navigate to="/samples" replace />} />
                <Route path="maintenance" element={<Navigate to="/samples" replace />} />
                <Route path="expenses" element={<Navigate to="/samples" replace />} />
                <Route path="documents" element={<ProtectedPage moduleKey="DOCUMENT"><Documents /></ProtectedPage>} />
                <Route path="categories" element={<ProtectedPage moduleKey="CATEGORY"><CategoryList /></ProtectedPage>} />
                <Route path="members" element={<ProtectedPage moduleKey="USER"><MemberList /></ProtectedPage>} />
                <Route path="calendar" element={<ProtectedPage moduleKey="CALENDAR"><CalendarPage /></ProtectedPage>} />
                <Route path="admin" element={<ProtectedPage moduleKey="ADMIN"><AdminPanel /></ProtectedPage>} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}

const RouteLoading = () => (
  <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm font-medium">
    Đang tải phiên làm việc...
  </div>
);

const PageFallback = () => (
  <div className="min-h-[30vh] flex items-center justify-center text-muted-foreground text-sm font-medium">
    Đang tải trang...
  </div>
);

function HomePage() {
  const { isLoading } = useSession();

  if (isLoading) {
    return <RouteLoading />;
  }

  return <SetupGuide />;
}

function ProtectedPage({
  moduleKey,
  children,
}: {
  moduleKey: Parameters<ReturnType<typeof useSession>['canAccess']>[0];
  children: React.ReactNode;
}) {
  const { isLoading, canAccess } = useSession();

  if (isLoading) {
    return <RouteLoading />;
  }

  if (!canAccess(moduleKey, 'view')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

export default App;
