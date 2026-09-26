import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DatePicker, Radio, Tag } from 'antd';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
    Package, Receipt, AlertTriangle, Wallet, PiggyBank, Wrench,
    CalendarDays, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    PlaneTakeoff, ChevronRight,
} from 'lucide-react';
import api from '../api/client';
import { cn } from '../utils/cn';
import { NaturalInputBox } from '../components/NaturalInputBox';
import { useSession } from '../components/auth/SessionProvider';
import { formatVndAmount } from '../utils/currency';
import { getDateBadgeClassName, getMoneyBadgeClassName } from '../utils/display';
import dayjs from 'dayjs';

type EntryTypeFilter = 'INCOME' | 'EXPENSE';
type PeriodMode = 'month' | 'year' | 'custom';

interface CategoryBreakdownRow {
    categoryId: string;
    categoryName: string;
    parentName: string | null;
    entryType: EntryTypeFilter;
    amount: number;
    count: number;
}

const PIE_COLORS = ['#f58a7a', '#f3b665', '#7cb7ef', '#7fc7aa', '#f5a6c1', '#b8a5ff', '#fac57a', '#7fb3ee'];

const formatCompactVnd = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} tỷ`;
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} tr`;
    if (abs >= 1_000) return `${Math.round(val / 1_000)}k`;
    return `${val}`;
};

const formatPercentDelta = (current: number, previous: number) => {
    if (!previous) return null;
    return Math.round(((current - previous) / Math.abs(previous)) * 100);
};

const eventTypeMeta: Record<string, { label: string; color: string }> = {
    PAYMENT: { label: 'Thanh toán', color: 'orange' },
    MAINTENANCE: { label: 'Bảo dưỡng', color: 'blue' },
    REMINDER: { label: 'Nhắc nhở', color: 'purple' },
    EVENT: { label: 'Sự kiện', color: 'green' },
};

export const Dashboard = () => {
    const { systemRole, canAccess } = useSession();
    const canViewDashboard = canAccess('DASHBOARD', 'view');

    const [breakdownEntryType, setBreakdownEntryType] = useState<EntryTypeFilter>('EXPENSE');
    const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
    const [selectedMonth, setSelectedMonth] = useState<any>(dayjs());
    const [selectedYear, setSelectedYear] = useState<any>(dayjs());
    const [breakdownDateRange, setBreakdownDateRange] = useState<[any, any] | null>(null);

    const expenseFilterParams = useMemo(() => {
        if (periodMode === 'month' && selectedMonth) {
            return {
                startDate: dayjs(selectedMonth).startOf('month').format('YYYY-MM-DD'),
                endDate: dayjs(selectedMonth).endOf('month').format('YYYY-MM-DD'),
            };
        }
        if (periodMode === 'year' && selectedYear) {
            return {
                startDate: dayjs(selectedYear).startOf('year').format('YYYY-MM-DD'),
                endDate: dayjs(selectedYear).endOf('year').format('YYYY-MM-DD'),
            };
        }
        if (periodMode === 'custom') {
            const startDate = breakdownDateRange?.[0] ? dayjs(breakdownDateRange[0]).format('YYYY-MM-DD') : undefined;
            const endDate = breakdownDateRange?.[1] ? dayjs(breakdownDateRange[1]).format('YYYY-MM-DD') : undefined;
            return { startDate, endDate };
        }
        return {};
    }, [periodMode, selectedMonth, selectedYear, breakdownDateRange]);

    const periodLabel = useMemo(() => {
        if (periodMode === 'month' && selectedMonth) return `Tháng ${dayjs(selectedMonth).format('MM/YYYY')}`;
        if (periodMode === 'year' && selectedYear) return `Năm ${dayjs(selectedYear).format('YYYY')}`;
        if (periodMode === 'custom' && breakdownDateRange?.[0] && breakdownDateRange?.[1]) {
            return `${dayjs(breakdownDateRange[0]).format('DD/MM/YYYY')} – ${dayjs(breakdownDateRange[1]).format('DD/MM/YYYY')}`;
        }
        return 'Tháng này';
    }, [periodMode, selectedMonth, selectedYear, breakdownDateRange]);

    const { data: stats, isLoading, isError } = useQuery({
        queryKey: ['dashboard-stats', expenseFilterParams],
        enabled: canViewDashboard,
        queryFn: async () => {
            const { data } = await api.get('/dashboard/stats', { params: expenseFilterParams });
            return data;
        },
    });

    const categoryBreakdown: CategoryBreakdownRow[] = stats?.categoryBreakdown || [];

    // Per-entry-type breakdown (for the pie + ranked list)
    const filteredBreakdown = useMemo(
        () => categoryBreakdown.filter((row) => row.entryType === breakdownEntryType),
        [categoryBreakdown, breakdownEntryType],
    );

    // Pivot per category: { categoryId, name, income, expense, liability, net }
    const pivotedBreakdown = useMemo(() => {
        const map = new Map<string, {
            categoryId: string;
            name: string;
            parentName: string | null;
            income: number;
            expense: number;
        }>();
        for (const row of categoryBreakdown) {
            const key = row.categoryId;
            if (!map.has(key)) {
                map.set(key, {
                    categoryId: row.categoryId,
                    name: row.categoryName,
                    parentName: row.parentName,
                    income: 0,
                    expense: 0,
                });
            }
            const entry = map.get(key)!;
            if (row.entryType === 'INCOME') entry.income += row.amount;
            else if (row.entryType === 'EXPENSE') entry.expense += row.amount;
        }
        return Array.from(map.values())
            .map((row) => ({ ...row, net: row.income - row.expense }))
            .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
    }, [categoryBreakdown]);

    if (!canViewDashboard) {
        return (
            <div className="glass-card p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-slate-900 font-display">Tổng quan hệ thống</h1>
                <p className="mt-2 text-sm text-slate-600">
                    {systemRole === 'APP_ADMIN'
                        ? 'Tài khoản quản trị ứng dụng chưa tham gia gia đình nào. Hãy chấp nhận lời mời hoặc được thêm vào gia đình để xem tổng quan.'
                        : 'Bạn không có quyền xem tổng quan. Vui lòng liên hệ quản trị viên gia đình.'}
                </p>
            </div>
        );
    }

    if (isLoading) return <div className="p-8 text-center text-slate-700 font-medium">Đang tải dữ liệu...</div>;
    if (isError) return <div className="p-8 text-center text-red-500 font-medium">Không thể tải dữ liệu tổng quan cho gia đình đang chọn.</div>;

    const incomeDelta = formatPercentDelta(stats?.monthlyIncome || 0, stats?.prevMonthIncome || 0);
    const expensesDelta = formatPercentDelta(stats?.monthlyExpenses || 0, stats?.prevMonthExpenses || 0);

    const trendData = (stats?.monthlyTrend || []).map((row: any) => ({
        ...row,
        monthLabel: dayjs(row.month + '-01').format('MM/YY'),
    }));

    const breakdownTotal = filteredBreakdown.reduce((sum, row) => sum + row.amount, 0);

    const entryTypeLabels: Record<EntryTypeFilter, string> = {
        INCOME: 'Thu nhập',
        EXPENSE: 'Chi tiêu',
    };

    const entryTypeColors: Record<EntryTypeFilter, string> = {
        INCOME: 'text-emerald-600',
        EXPENSE: 'text-rose-600',
    };

    return (
        <div className="space-y-4 lg:space-y-5 animate-in fade-in duration-700">
            <header>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-display">Tổng quan gia đình</h1>
                <p className="text-slate-700 mt-1 text-sm lg:text-base">
                    {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </header>

            {/* Go US F4 Portal Banner */}
            <Link
                to="/gous"
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1e293b] via-[#1e3a8a] to-[#2563eb] p-4 lg:p-5 text-white shadow-md hover:shadow-lg transition-all border border-blue-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 block"
            >
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300 shrink-0 border border-white/15 group-hover:scale-105 transition-transform">
                        <PlaneTakeoff size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/30">
                                Định cư Mỹ F4
                            </span>
                            <span className="text-xs text-blue-200 hidden sm:inline">
                                • Luật sư & Chuyên viên đồng hành
                            </span>
                        </div>
                        <h2 className="text-base lg:text-lg font-bold text-white mt-0.5 tracking-tight">
                            Cổng Quản Lý Định Cư Hoa Kỳ (/gous)
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                            Kiểm soát tiến trình 11 bước NVC, giấy tờ, tính tuổi CSPA cho con, lịch phỏng vấn & dự toán chi phí.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 group-hover:text-amber-200 shrink-0 bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 backdrop-blur-sm self-start sm:self-auto">
                    <span>Vào Cổng Định Cư Mỹ</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
            </Link>

            <NaturalInputBox />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <KpiCard
                    label="Tài sản ròng"
                    primary={formatVndAmount(stats?.netWorth || 0)}
                    secondary={`${stats?.totalAssetCount || 0} tài sản đang theo dõi`}
                    icon={Wallet}
                    accent="blue"
                />
                <KpiCard
                    label="Thu nhập tháng này"
                    primary={formatVndAmount(stats?.monthlyIncome || 0)}
                    secondary={incomeDelta !== null
                        ? <DeltaText pct={incomeDelta} positiveIsGood />
                        : 'Chưa có dữ liệu tháng trước'}
                    icon={ArrowDownRight}
                    accent="green"
                />
                <KpiCard
                    label="Chi tiêu tháng này"
                    primary={formatVndAmount(stats?.monthlyExpenses || 0)}
                    secondary={expensesDelta !== null
                        ? <DeltaText pct={expensesDelta} positiveIsGood={false} />
                        : 'Chưa có dữ liệu tháng trước'}
                    icon={ArrowUpRight}
                    accent="red"
                />
                <KpiCard
                    label="Số dư tháng này"
                    primary={formatVndAmount(stats?.monthlyNet || 0)}
                    secondary={`Tỷ lệ tiết kiệm ${stats?.savingsRate || 0}%`}
                    icon={PiggyBank}
                    accent={(stats?.monthlyNet || 0) >= 0 ? 'mint' : 'amber'}
                />
            </div>

            {/* 6-month trend */}
            <div className="glass-card p-4 lg:p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h2 className="font-bold text-lg lg:text-xl text-[#4a3a34] font-display">Thu chi 6 tháng gần đây</h2>
                    <span className="text-xs text-[#5c4437]">Cột: thu nhập / chi tiêu • Đường: số dư</span>
                </div>
                <div className="h-[260px] lg:h-[300px]">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0e3d8" />
                                <XAxis dataKey="monthLabel" tick={{ fontSize: 13 }} />
                                <YAxis tickFormatter={(val) => formatCompactVnd(val)} tick={{ fontSize: 13 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '14px', border: '1px solid #f4d6c7' }}
                                    formatter={(val: any) => formatVndAmount(val || 0)}
                                />
                                <Legend />
                                <Bar dataKey="income" name="Thu nhập" fill="#7fc7aa" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="expenses" name="Chi tiêu" fill="#f58a7a" radius={[8, 8, 0, 0]} />
                                <Line type="monotone" dataKey="net" name="Số dư" stroke="#5f87c2" strokeWidth={2.5} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={Receipt} message="Chưa có dữ liệu thu chi" />
                    )}
                </div>
            </div>

            {/* Category breakdown — flexible by entryType */}
            <div className="glass-card p-4 lg:p-5">
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <h2 className="font-bold text-lg lg:text-xl text-[#4a3a34] font-display">Phân tích thu chi theo danh mục</h2>
                            <p className="text-xs text-[#5c4437] mt-0.5">
                                Đang xem: <span className="font-semibold text-[#4a3a34]">{periodLabel}</span>
                            </p>
                        </div>
                        <Radio.Group
                            value={breakdownEntryType}
                            onChange={(e) => setBreakdownEntryType(e.target.value)}
                            buttonStyle="solid"
                            size="small"
                        >
                            <Radio.Button value="INCOME">Thu</Radio.Button>
                            <Radio.Button value="EXPENSE">Chi</Radio.Button>
                        </Radio.Group>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <Radio.Group
                            value={periodMode}
                            onChange={(e) => setPeriodMode(e.target.value)}
                            size="small"
                        >
                            <Radio.Button value="month">Tháng</Radio.Button>
                            <Radio.Button value="year">Năm</Radio.Button>
                            <Radio.Button value="custom">Tùy chọn</Radio.Button>
                        </Radio.Group>
                        {periodMode === 'month' && (
                            <DatePicker
                                picker="month"
                                size="small"
                                value={selectedMonth}
                                onChange={(val) => setSelectedMonth(val)}
                                format="MM/YYYY"
                                placeholder="Chọn tháng"
                                allowClear={false}
                            />
                        )}
                        {periodMode === 'year' && (
                            <DatePicker
                                picker="year"
                                size="small"
                                value={selectedYear}
                                onChange={(val) => setSelectedYear(val)}
                                format="YYYY"
                                placeholder="Chọn năm"
                                allowClear={false}
                            />
                        )}
                        {periodMode === 'custom' && (
                            <DatePicker.RangePicker
                                size="small"
                                value={breakdownDateRange as any}
                                onChange={(val) => setBreakdownDateRange(val as any)}
                                placeholder={['Từ', 'Đến']}
                            />
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    {/* Pie chart */}
                    <div className="h-[260px]">
                        {filteredBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={filteredBreakdown}
                                        dataKey="amount"
                                        nameKey="categoryName"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={54}
                                        outerRadius={88}
                                        paddingAngle={4}
                                        label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {filteredBreakdown.map((_: any, index: number) => (
                                            <Cell key={`bd-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="stroke-white stroke-2" />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: any) => formatVndAmount(val || 0)} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState icon={Receipt} message={`Chưa có dữ liệu ${entryTypeLabels[breakdownEntryType].toLowerCase()}`} />
                        )}
                    </div>

                    {/* Ranked list */}
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {filteredBreakdown.length > 0 ? (
                            <>
                                <div className="flex justify-between items-center text-xs text-[#5c4437] px-1 pb-1 border-b border-[rgba(242,214,197,0.7)]">
                                    <span>Tổng cộng</span>
                                    <span className={cn('font-bold', entryTypeColors[breakdownEntryType])}>
                                        {formatVndAmount(breakdownTotal)}
                                    </span>
                                </div>
                                {filteredBreakdown.map((row, idx) => {
                                    const pct = breakdownTotal > 0 ? (row.amount / breakdownTotal) * 100 : 0;
                                    return (
                                        <div key={row.categoryId} className="p-2.5 rounded-xl bg-white/85 border border-[rgba(242,214,197,0.6)]">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                                    />
                                                    <p className="font-semibold text-[#4a3a34] text-sm truncate">
                                                        {row.parentName ? `${row.parentName} / ` : ''}{row.categoryName}
                                                    </p>
                                                </div>
                                                <span className={cn('text-sm font-bold whitespace-nowrap', entryTypeColors[breakdownEntryType])}>
                                                    {formatVndAmount(row.amount)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 text-[13px] text-[#5c4437]">
                                                <div className="flex-1 h-1.5 rounded-full bg-[#f3e6db] overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                                    />
                                                </div>
                                                <span className="shrink-0">{pct.toFixed(1)}% • {row.count} giao dịch</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                                Chưa có giao dịch trong khoảng này
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary table — all entry types per category */}
                {pivotedBreakdown.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[rgba(242,214,197,0.7)]">
                        <h3 className="font-bold text-sm text-[#4a3a34] mb-3">Tổng hợp các danh mục</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-[#5c4437] border-b border-[rgba(242,214,197,0.7)]">
                                        <th className="text-left py-2 px-2 font-semibold">Danh mục</th>
                                        <th className="text-right py-2 px-2 font-semibold text-emerald-600">Thu</th>
                                        <th className="text-right py-2 px-2 font-semibold text-rose-600">Chi</th>
                                        <th className="text-right py-2 px-2 font-semibold">Số dư</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivotedBreakdown.map((row) => (
                                        <tr key={row.categoryId} className="border-b border-[rgba(242,214,197,0.4)] hover:bg-white/60 transition-colors">
                                            <td className="py-2 px-2 text-[#4a3a34]">
                                                <div className="font-medium">{row.name}</div>
                                                {row.parentName && (
                                                    <div className="text-[13px] text-[#5c4437]">{row.parentName}</div>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-right text-emerald-600">
                                                {row.income > 0 ? formatVndAmount(row.income) : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-right text-rose-600">
                                                {row.expense > 0 ? formatVndAmount(row.expense) : '—'}
                                            </td>
                                            <td className={cn('py-2 px-2 text-right font-bold', row.net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                                {formatVndAmount(row.net)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Asset distribution */}
            <div className="glass-card p-4 lg:p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-lg lg:text-xl text-[#4a3a34] font-display">Phân bổ tài sản</h2>
                    <span className="text-xs text-[#5c4437]">{formatVndAmount(stats?.totalAssetValue || 0)}</span>
                </div>
                <div className="h-[260px]">
                    {stats?.assetsByCategory?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.assetsByCategory}
                                    dataKey="value"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={54}
                                    outerRadius={88}
                                    paddingAngle={4}
                                    label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {stats.assetsByCategory.map((_: any, index: number) => (
                                        <Cell key={`ac-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="stroke-white stroke-2" />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: any) => formatVndAmount(val || 0)} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={Package} message="Chưa có dữ liệu tài sản" />
                    )}
                </div>
            </div>

            {/* Top expenses & expiring warranty */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-[#4a3a34] font-display">Giao dịch lớn nhất tháng</h2>
                    {stats?.topExpenses?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.topExpenses.map((exp: any) => (
                                <div key={exp.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/85 border border-[rgba(242,214,197,0.7)]">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[#4a3a34] text-sm truncate">
                                            {exp.note?.trim() || exp.category?.name || 'Giao dịch'}
                                        </p>
                                        <p className="text-xs text-[#5c4437] truncate">
                                            {exp.category?.name || '—'} • {dayjs(exp.expenseDate).format('DD/MM/YYYY')}
                                        </p>
                                    </div>
                                    <span className={getMoneyBadgeClassName(exp.amount, 'text-sm font-bold whitespace-nowrap')}>
                                        {formatVndAmount(exp.amount || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Receipt} message="Chưa có giao dịch tháng này" compact />
                    )}
                </div>

                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-[#4a3a34] font-display">Bảo hành sắp hết hạn</h2>
                    {stats?.expiringAssets?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.expiringAssets.map((asset: any) => (
                                <div key={asset.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/85 border border-[rgba(242,214,197,0.7)] hover:border-[#f1c49c] transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-[#fff3cf] flex items-center justify-center text-[#c58c2e] shrink-0">
                                            <AlertTriangle size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#4a3a34] text-sm truncate">{asset.name}</p>
                                            <p className="text-xs text-[#5c4437]">
                                                Hết hạn:
                                                <span className={getDateBadgeClassName(asset.warrantyExpiredAt, 'ml-1')}>
                                                    {asset.warrantyExpiredAt ? new Date(asset.warrantyExpiredAt).toLocaleDateString('vi-VN') : '—'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Package} message="Tất cả tài sản còn bảo hành" compact />
                    )}
                </div>
            </div>

            {/* Maintenance & events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-[#4a3a34] font-display">Bảo dưỡng sắp tới</h2>
                    {stats?.upcomingMaintenance?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.upcomingMaintenance.map((asset: any) => (
                                <div key={asset.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/85 border border-[rgba(242,214,197,0.7)]">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-[#dff1ff] flex items-center justify-center text-[#5f87c2] shrink-0">
                                            <Wrench size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#4a3a34] text-sm truncate">{asset.name}</p>
                                            <p className="text-xs text-[#5c4437]">
                                                Bảo dưỡng:
                                                <span className={getDateBadgeClassName(asset.nextMaintenanceDate, 'ml-1')}>
                                                    {new Date(asset.nextMaintenanceDate).toLocaleDateString('vi-VN')}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Wrench} message="Chưa có lịch bảo dưỡng" compact />
                    )}
                </div>

                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-[#4a3a34] font-display">Sự kiện 7 ngày tới</h2>
                    {stats?.upcomingEvents?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.upcomingEvents.map((event: any) => {
                                const meta = eventTypeMeta[event.type] || eventTypeMeta.EVENT;
                                return (
                                    <div key={event.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/85 border border-[rgba(242,214,197,0.7)]">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-[#eef9f4] flex items-center justify-center text-[#6fb3a2] shrink-0">
                                                <CalendarDays size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-[#4a3a34] text-sm truncate">{event.title}</p>
                                                <p className="text-xs text-[#5c4437] truncate">
                                                    {dayjs(event.startDate).format('HH:mm DD/MM')}
                                                    {event.location ? ` • ${event.location}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <Tag color={meta.color} className="shrink-0">{meta.label}</Tag>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState icon={CalendarDays} message="Không có sự kiện sắp tới" compact />
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
    accent: 'blue' | 'green' | 'red' | 'mint' | 'amber';
}

const KpiCard = ({ label, primary, secondary, icon: Icon, accent }: KpiCardProps) => {
    const colors: Record<string, { color: string; bg: string }> = {
        blue: { color: 'text-[#5f87c2]', bg: 'bg-[#edf6ff]' },
        green: { color: 'text-[#6fb3a2]', bg: 'bg-[#eef9f4]' },
        red: { color: 'text-[#d56f63]', bg: 'bg-[#fff0ea]' },
        mint: { color: 'text-[#7fc7aa]', bg: 'bg-[#eaf7f0]' },
        amber: { color: 'text-[#c58c2e]', bg: 'bg-[#fff8df]' },
    };
    const c = colors[accent];
    return (
        <div className="glass-card p-3.5 lg:p-4 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-start gap-3">
                <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0', c.bg, c.color)}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs lg:text-sm font-semibold text-[#5c4437] truncate">{label}</p>
                    <p className="text-base lg:text-xl font-bold text-[#473934] tracking-tight truncate">{primary}</p>
                    <div className="text-[13px] lg:text-xs text-[#5c4437] mt-0.5 truncate">{secondary}</div>
                </div>
            </div>
        </div>
    );
};

const DeltaText = ({ pct, positiveIsGood }: { pct: number; positiveIsGood: boolean }) => {
    if (pct === 0) {
        return <span className="text-slate-700">Bằng tháng trước</span>;
    }
    const isPositive = pct > 0;
    const isGood = positiveIsGood ? isPositive : !isPositive;
    const Arrow = isPositive ? TrendingUp : TrendingDown;
    return (
        <span className={cn('inline-flex items-center gap-1 font-medium', isGood ? 'text-emerald-600' : 'text-rose-600')}>
            <Arrow size={12} />
            {Math.abs(pct)}% so với tháng trước
        </span>
    );
};

const EmptyState = ({ icon: Icon, message, compact }: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    message: string;
    compact?: boolean;
}) => (
    <div className={cn('flex flex-col items-center justify-center text-slate-600', compact ? 'h-[180px]' : 'h-full')}>
        <Icon size={compact ? 36 : 48} className="mb-2 opacity-25" />
        <p className="text-sm">{message}</p>
    </div>
);
