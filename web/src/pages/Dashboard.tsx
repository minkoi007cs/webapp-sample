import { useQuery } from '@tanstack/react-query';
import { Tag } from 'antd';
import {
  ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  Package,
  FolderArchive,
  CalendarDays,
  Users,
  ArrowRight,
  PlaneTakeoff,
  ChevronRight,
} from 'lucide-react';
import api from '../api/client';
import { cn } from '../utils/cn';
import { useSession } from '../components/auth/SessionProvider';
import dayjs from 'dayjs';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

const eventTypeMeta: Record<string, { label: string; color: string }> = {
  PAYMENT: { label: 'Thanh toán', color: 'orange' },
  MAINTENANCE: { label: 'Bảo quản', color: 'blue' },
  REMINDER: { label: 'Nhắc nhở', color: 'purple' },
  EVENT: { label: 'Sự kiện', color: 'green' },
};

export const Dashboard = () => {
  const { systemRole, canAccess } = useSession();
  const canViewDashboard = canAccess('DASHBOARD', 'view');

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    enabled: canViewDashboard,
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats');
      return data;
    },
  });

  if (!canViewDashboard) {
    return (
      <div className="glass-card p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-foreground">Tổng quan hệ thống</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {systemRole === 'APP_ADMIN'
            ? 'Tài khoản quản trị chưa thuộc nhóm nào. Vui lòng tạo nhóm hoặc chấp nhận lời mời để xem tổng quan.'
            : 'Bạn không có quyền truy cập trang tổng quan. Vui lòng liên hệ quản trị viên nhóm.'}
        </p>
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground font-medium">Đang tải dữ liệu tổng quan...</div>;
  if (isError) return <div className="p-8 text-center text-destructive font-medium">Không thể tải dữ liệu cho nhóm hiện tại.</div>;

  const samplesByCategory = stats?.samplesByCategory || [];

  return (
    <div className="space-y-4 lg:space-y-5 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Tổng Quan Nhóm</h1>
          <p className="text-muted-foreground mt-0.5 text-xs lg:text-sm">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      {/* Go US F4 Portal Banner */}
      <Link
        to="/gous"
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-4 text-white shadow-xs hover:shadow-sm transition-all border border-zinc-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 block"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-primary-foreground shrink-0 border border-white/15 group-hover:scale-105 transition-transform">
            <PlaneTakeoff size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/20">
                US Immigration
              </span>
              <span className="text-xs text-zinc-400 hidden sm:inline">
                • Hồ sơ & Tiến độ NVC
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-0.5 tracking-tight">
              Cổng quản lý hồ sơ Di trú Mỹ (/gous)
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-white group-hover:text-zinc-200 shrink-0 bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 backdrop-blur-sm self-start sm:self-auto">
          <span>Mở Cổng</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          label="Tổng số Mẫu (Samples)"
          primary={stats?.totalSampleCount || 0}
          secondary={`${stats?.activeSampleCount || 0} mẫu đang hoạt động`}
          icon={Package}
          accent="blue"
          to="/samples"
        />
        <KpiCard
          label="Thành viên nhóm"
          primary={stats?.groupMembersCount || 0}
          secondary="Đang tham gia nhóm"
          icon={Users}
          accent="mint"
          to="/members"
        />
        <KpiCard
          label="Tài liệu lưu trữ"
          primary={stats?.totalDocumentCount || 0}
          secondary="Tệp đính kèm & hồ sơ"
          icon={FolderArchive}
          accent="amber"
          to="/documents"
        />
        <KpiCard
          label="Sự kiện sắp tới (7 ngày)"
          primary={stats?.upcomingEvents?.length || 0}
          secondary="Lịch trình & thông báo"
          icon={CalendarDays}
          accent="purple"
          to="/calendar"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {/* Sample category distribution */}
        <div className="glass-card p-4 lg:p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-bold text-base lg:text-lg text-foreground">Phân Bố Theo Phân Loại</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tỷ lệ mẫu theo từng phân loại danh mục</p>
            </div>
            <Link to="/samples" className="text-xs text-primary hover:underline flex items-center gap-1">
              Xem tất cả <ArrowRight size={12} />
            </Link>
          </div>
          <div className="h-[250px]">
            {samplesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={samplesByCategory}
                    dataKey="value"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {samplesByCategory.map((_: any, index: number) => (
                      <Cell key={`sc-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${val} mẫu`, 'Số lượng']} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Package} message="Chưa có dữ liệu mẫu phân loại" />
            )}
          </div>
        </div>

        {/* Recent Samples */}
        <div className="glass-card p-4 lg:p-5 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-bold text-base lg:text-lg text-foreground">Mẫu Mới Tạo Gần Đây</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Các mẫu được cập nhật trong nhóm</p>
            </div>
            <Link to="/samples" className="text-xs text-primary hover:underline flex items-center gap-1">
              Quản lý <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[250px] pr-1">
            {stats?.recentSamples?.length > 0 ? (
              stats.recentSamples.map((sample: any) => (
                <div key={sample.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                      <Package size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{sample.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sample.category?.name || 'Chưa phân loại'} {sample.code ? `• ${sample.code}` : ''}
                      </p>
                    </div>
                  </div>
                  <Tag color={sample.status === 'AVAILABLE' ? 'green' : 'blue'} className="shrink-0 text-[11px]">
                    {sample.status}
                  </Tag>
                </div>
              ))
            ) : (
              <EmptyState icon={Package} message="Chưa có mẫu nào" compact />
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Events & Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        <div className="glass-card p-4 lg:p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-bold text-base lg:text-lg text-foreground">Sự Kiện Lịch Trình</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Kế hoạch trong 7 ngày tới</p>
            </div>
            <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
              Xem lịch <ArrowRight size={12} />
            </Link>
          </div>
          {stats?.upcomingEvents?.length > 0 ? (
            <div className="space-y-2.5">
              {stats.upcomingEvents.map((event: any) => {
                const meta = eventTypeMeta[event.type] || eventTypeMeta.EVENT;
                return (
                  <div key={event.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-500/20">
                        <CalendarDays size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {dayjs(event.startDate).format('DD/MM/YYYY HH:mm')}
                          {event.location ? ` • ${event.location}` : ''}
                        </p>
                      </div>
                    </div>
                    <Tag color={meta.color} className="shrink-0 text-[11px]">{meta.label}</Tag>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} message="Không có sự kiện sắp tới" compact />
          )}
        </div>

        <div className="glass-card p-4 lg:p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-bold text-base lg:text-lg text-foreground">Tài Liệu Mới Lưu Trữ</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tệp đính kèm và hợp đồng gần nhất</p>
            </div>
            <Link to="/documents" className="text-xs text-primary hover:underline flex items-center gap-1">
              Tất cả tài liệu <ArrowRight size={12} />
            </Link>
          </div>
          {stats?.recentDocuments?.length > 0 ? (
            <div className="space-y-2.5">
              {stats.recentDocuments.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0 border border-amber-500/20">
                      <FolderArchive size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.fileType || 'Tài liệu'} • {dayjs(doc.createdAt).format('DD/MM/YYYY')}
                      </p>
                    </div>
                  </div>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline font-medium shrink-0"
                    >
                      Mở tệp
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FolderArchive} message="Chưa có tài liệu nào" compact />
          )}
        </div>
      </div>
    </div>
  );
};

// ===== Helper components =====

interface KpiCardProps {
  label: string;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  icon: React.ComponentType<{ size?: number }>;
  accent: 'blue' | 'green' | 'red' | 'mint' | 'amber' | 'purple';
  to?: string;
}

const KpiCard = ({ label, primary, secondary, icon: Icon, accent, to }: KpiCardProps) => {
  const colors: Record<string, { color: string; bg: string }> = {
    blue: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    green: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    red: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    mint: { color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
    amber: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    purple: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  };
  const c = colors[accent];
  const content = (
    <div className="glass-card p-3.5 lg:p-4 transition-all hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', c.bg, c.color)}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold text-foreground tracking-tight truncate mt-0.5">{primary}</p>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</div>
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : content;
};

const EmptyState = ({ icon: Icon, message, compact }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  message: string;
  compact?: boolean;
}) => (
  <div className={cn('flex flex-col items-center justify-center text-muted-foreground', compact ? 'h-[160px]' : 'h-full')}>
    <Icon size={compact ? 32 : 44} className="mb-2 opacity-30" />
    <p className="text-xs">{message}</p>
  </div>
);
