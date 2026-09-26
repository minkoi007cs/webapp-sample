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
    if (abs >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${Math.round(val / 1_000)}k`;
    return `$${val}`;
};

const formatPercentDelta = (current: number, previous: number) => {
    if (!previous) return null;
    return Math.round(((current - previous) / Math.abs(previous)) * 100);
};

const eventTypeMeta: Record<string, { label: string; color: string }> = {
    PAYMENT: { label: 'Payment', color: 'orange' },
    MAINTENANCE: { label: 'Maintenance', color: 'blue' },
    REMINDER: { label: 'Reminder', color: 'purple' },
    EVENT: { label: 'Event', color: 'green' },
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
        if (periodMode === 'month' && selectedMonth) return `Month of ${dayjs(selectedMonth).format('MMMM YYYY')}`;
        if (periodMode === 'year' && selectedYear) return `Year of ${dayjs(selectedYear).format('YYYY')}`;
        if (periodMode === 'custom' && breakdownDateRange?.[0] && breakdownDateRange?.[1]) {
            return `${dayjs(breakdownDateRange[0]).format('YYYY-MM-DD')} – ${dayjs(breakdownDateRange[1]).format('YYYY-MM-DD')}`;
        }
        return 'This Month';
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
                <h1 className="text-2xl font-bold text-foreground font-sans">System Overview</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {systemRole === 'APP_ADMIN'
                        ? 'App administrator account is not part of any family workspace yet. Accept an invite or create a workspace to view dashboard.'
                        : 'You do not have permission to view the dashboard. Please contact your workspace administrator.'}
                </p>
            </div>
        );
    }

    if (isLoading) return <div className="p-8 text-center text-muted-foreground font-medium">Loading dashboard data...</div>;
    if (isError) return <div className="p-8 text-center text-destructive font-medium">Could not load dashboard data for the selected workspace.</div>;

    const incomeDelta = formatPercentDelta(stats?.monthlyIncome || 0, stats?.prevMonthIncome || 0);
    const expensesDelta = formatPercentDelta(stats?.monthlyExpenses || 0, stats?.prevMonthExpenses || 0);

    const trendData = (stats?.monthlyTrend || []).map((row: any) => ({
        ...row,
        monthLabel: dayjs(row.month + '-01').format('MMM YY'),
    }));

    const breakdownTotal = filteredBreakdown.reduce((sum, row) => sum + row.amount, 0);

    const entryTypeLabels: Record<EntryTypeFilter, string> = {
        INCOME: 'Income',
        EXPENSE: 'Expenses',
    };

    const entryTypeColors: Record<EntryTypeFilter, string> = {
        INCOME: 'text-emerald-600',
        EXPENSE: 'text-rose-600',
    };

    return (
        <div className="space-y-4 lg:space-y-5 animate-in fade-in duration-500">
            <header>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight font-sans">Family Dashboard</h1>
                <p className="text-muted-foreground mt-1 text-sm lg:text-base">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </header>

            {/* Go US F4 Portal Banner */}
            <Link
                to="/gous"
                className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-4 lg:p-5 text-white shadow-sm hover:shadow-md transition-all border border-zinc-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 block"
            >
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-primary-foreground shrink-0 border border-white/15 group-hover:scale-105 transition-transform">
                        <PlaneTakeoff size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/20">
                                US Immigration
                            </span>
                            <span className="text-xs text-zinc-400 hidden sm:inline">
                                • Case Management & Tracking
                            </span>
                        </div>
                        <h2 className="text-base lg:text-lg font-bold text-white mt-0.5 tracking-tight">
                            US Immigration Portal (/gous)
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                            Track 11-step NVC progress, documents, CSPA age calculation, interview schedules & estimated costs.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-white group-hover:text-zinc-200 shrink-0 bg-white/10 px-3.5 py-2 rounded-lg border border-white/15 backdrop-blur-sm self-start sm:self-auto">
                    <span>Open Portal</span>
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
            </Link>

            <NaturalInputBox />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <KpiCard
                    label="Net Worth"
                    primary={formatVndAmount(stats?.netWorth || 0)}
                    secondary={`${stats?.totalAssetCount || 0} tracked assets`}
                    icon={Wallet}
                    accent="blue"
                />
                <KpiCard
                    label="Monthly Income"
                    primary={formatVndAmount(stats?.monthlyIncome || 0)}
                    secondary={incomeDelta !== null
                        ? <DeltaText pct={incomeDelta} positiveIsGood />
                        : 'No prior month data'}
                    icon={ArrowDownRight}
                    accent="green"
                />
                <KpiCard
                    label="Monthly Expenses"
                    primary={formatVndAmount(stats?.monthlyExpenses || 0)}
                    secondary={expensesDelta !== null
                        ? <DeltaText pct={expensesDelta} positiveIsGood={false} />
                        : 'No prior month data'}
                    icon={ArrowUpRight}
                    accent="red"
                />
                <KpiCard
                    label="Monthly Net"
                    primary={formatVndAmount(stats?.monthlyNet || 0)}
                    secondary={`Savings rate ${stats?.savingsRate || 0}%`}
                    icon={PiggyBank}
                    accent={(stats?.monthlyNet || 0) >= 0 ? 'mint' : 'amber'}
                />
            </div>

            {/* 6-month trend */}
            <div className="glass-card p-4 lg:p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h2 className="font-bold text-lg lg:text-xl text-foreground font-sans">Cash Flow (Last 6 Months)</h2>
                    <span className="text-xs text-muted-foreground">Bars: Income / Expenses • Line: Net Balance</span>
                </div>
                <div className="h-[260px] lg:h-[300px]">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="monthLabel" tick={{ fontSize: 13 }} />
                                <YAxis tickFormatter={(val) => formatCompactVnd(val)} tick={{ fontSize: 13 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                                    formatter={(val: any) => formatVndAmount(val || 0)}
                                />
                                <Legend />
                                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                                <Line type="monotone" dataKey="net" name="Net" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={Receipt} message="No cash flow data available" />
                    )}
                </div>
            </div>

            {/* Category breakdown — flexible by entryType */}
            <div className="glass-card p-4 lg:p-5">
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <h2 className="font-bold text-lg lg:text-xl text-foreground font-sans">Category Breakdown</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Viewing: <span className="font-semibold text-foreground">{periodLabel}</span>
                            </p>
                        </div>
                        <Radio.Group
                            value={breakdownEntryType}
                            onChange={(e) => setBreakdownEntryType(e.target.value)}
                            buttonStyle="solid"
                            size="small"
                        >
                            <Radio.Button value="INCOME">Income</Radio.Button>
                            <Radio.Button value="EXPENSE">Expenses</Radio.Button>
                        </Radio.Group>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <Radio.Group
                            value={periodMode}
                            onChange={(e) => setPeriodMode(e.target.value)}
                            size="small"
                        >
                            <Radio.Button value="month">Month</Radio.Button>
                            <Radio.Button value="year">Year</Radio.Button>
                            <Radio.Button value="custom">Custom</Radio.Button>
                        </Radio.Group>
                        {periodMode === 'month' && (
                            <DatePicker
                                picker="month"
                                size="small"
                                value={selectedMonth}
                                onChange={(val) => setSelectedMonth(val)}
                                format="MM/YYYY"
                                placeholder="Select month"
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
                                placeholder="Select year"
                                allowClear={false}
                            />
                        )}
                        {periodMode === 'custom' && (
                            <DatePicker.RangePicker
                                size="small"
                                value={breakdownDateRange as any}
                                onChange={(val) => setBreakdownDateRange(val as any)}
                                placeholder={['Start', 'End']}
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
                                             <Cell key={`bd-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="stroke-background stroke-2" />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: any) => formatVndAmount(val || 0)} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState icon={Receipt} message={`No ${entryTypeLabels[breakdownEntryType].toLowerCase()} data`} />
                        )}
                    </div>

                    {/* Ranked list */}
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {filteredBreakdown.length > 0 ? (
                            <>
                                <div className="flex justify-between items-center text-xs text-muted-foreground px-1 pb-1 border-b border-border">
                                    <span>Total</span>
                                    <span className={cn('font-bold', entryTypeColors[breakdownEntryType])}>
                                        {formatVndAmount(breakdownTotal)}
                                    </span>
                                </div>
                                {filteredBreakdown.map((row, idx) => {
                                    const pct = breakdownTotal > 0 ? (row.amount / breakdownTotal) * 100 : 0;
                                    return (
                                        <div key={row.categoryId} className="p-2.5 rounded-xl bg-card border border-border">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                                    />
                                                    <p className="font-semibold text-foreground text-sm truncate">
                                                        {row.parentName ? `${row.parentName} / ` : ''}{row.categoryName}
                                                    </p>
                                                </div>
                                                <span className={cn('text-sm font-bold whitespace-nowrap', entryTypeColors[breakdownEntryType])}>
                                                    {formatVndAmount(row.amount)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                                    />
                                                </div>
                                                <span className="shrink-0">{pct.toFixed(1)}% • {row.count} transactions</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                No transactions found for this period
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary table — all entry types per category */}
                {pivotedBreakdown.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-border">
                        <h3 className="font-bold text-sm text-foreground mb-3">All Categories Summary</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-muted-foreground border-b border-border">
                                        <th className="text-left py-2 px-2 font-semibold">Category</th>
                                        <th className="text-right py-2 px-2 font-semibold text-emerald-600">Income</th>
                                        <th className="text-right py-2 px-2 font-semibold text-rose-600">Expenses</th>
                                        <th className="text-right py-2 px-2 font-semibold">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivotedBreakdown.map((row) => (
                                        <tr key={row.categoryId} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                                            <td className="py-2 px-2 text-foreground">
                                                <div className="font-medium">{row.name}</div>
                                                {row.parentName && (
                                                    <div className="text-xs text-muted-foreground">{row.parentName}</div>
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
                    <h2 className="font-bold text-lg lg:text-xl text-foreground font-sans">Asset Allocation</h2>
                    <span className="text-xs text-muted-foreground font-medium">{formatVndAmount(stats?.totalAssetValue || 0)}</span>
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
                                        <Cell key={`ac-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="stroke-background stroke-2" />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: any) => formatVndAmount(val || 0)} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={Package} message="No asset data available" />
                    )}
                </div>
            </div>

            {/* Top expenses & expiring warranty */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-foreground font-sans">Top Expenses (This Month)</h2>
                    {stats?.topExpenses?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.topExpenses.map((exp: any) => (
                                <div key={exp.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-foreground text-sm truncate">
                                            {exp.note?.trim() || exp.category?.name || 'Transaction'}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {exp.category?.name || '—'} • {dayjs(exp.expenseDate).format('YYYY-MM-DD')}
                                        </p>
                                    </div>
                                    <span className={getMoneyBadgeClassName(exp.amount, 'text-sm font-bold whitespace-nowrap')}>
                                        {formatVndAmount(exp.amount || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Receipt} message="No transactions this month" compact />
                    )}
                </div>

                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-foreground font-sans">Expiring Warranties</h2>
                    {stats?.expiringAssets?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.expiringAssets.map((asset: any) => (
                                <div key={asset.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border hover:border-border/80 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0 border border-amber-500/20">
                                            <AlertTriangle size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground text-sm truncate">{asset.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Expires:
                                                <span className={getDateBadgeClassName(asset.warrantyExpiredAt, 'ml-1')}>
                                                    {asset.warrantyExpiredAt ? dayjs(asset.warrantyExpiredAt).format('YYYY-MM-DD') : '—'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Package} message="All asset warranties are in good standing" compact />
                    )}
                </div>
            </div>

            {/* Maintenance & events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-foreground font-sans">Upcoming Maintenance</h2>
                    {stats?.upcomingMaintenance?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.upcomingMaintenance.map((asset: any) => (
                                <div key={asset.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0 border border-blue-500/20">
                                            <Wrench size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground text-sm truncate">{asset.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Service Date:
                                                <span className={getDateBadgeClassName(asset.nextMaintenanceDate, 'ml-1')}>
                                                    {dayjs(asset.nextMaintenanceDate).format('YYYY-MM-DD')}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Wrench} message="No upcoming maintenance scheduled" compact />
                    )}
                </div>

                <div className="glass-card p-4 lg:p-5">
                    <h2 className="font-bold text-lg lg:text-xl mb-3 text-foreground font-sans">Events in Next 7 Days</h2>
                    {stats?.upcomingEvents?.length > 0 ? (
                        <div className="space-y-2.5">
                            {stats.upcomingEvents.map((event: any) => {
                                const meta = eventTypeMeta[event.type] || eventTypeMeta.EVENT;
                                return (
                                    <div key={event.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-500/20">
                                                <CalendarDays size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-foreground text-sm truncate">{event.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {dayjs(event.startDate).format('MMM DD, HH:mm')}
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
                        <EmptyState icon={CalendarDays} message="No upcoming events" compact />
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
        blue: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        green: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        red: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
        mint: { color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
        amber: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    };
    const c = colors[accent];
    return (
        <div className="glass-card p-3.5 lg:p-4 transition-all hover:shadow-md">
            <div className="flex items-start gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', c.bg, c.color)}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs lg:text-sm font-semibold text-muted-foreground truncate">{label}</p>
                    <p className="text-base lg:text-xl font-bold text-foreground tracking-tight truncate">{primary}</p>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</div>
                </div>
            </div>
        </div>
    );
};

const DeltaText = ({ pct, positiveIsGood }: { pct: number; positiveIsGood: boolean }) => {
    if (pct === 0) {
        return <span className="text-muted-foreground">Same as last month</span>;
    }
    const isPositive = pct > 0;
    const isGood = positiveIsGood ? isPositive : !isPositive;
    const Arrow = isPositive ? TrendingUp : TrendingDown;
    return (
        <span className={cn('inline-flex items-center gap-1 font-medium', isGood ? 'text-emerald-600' : 'text-rose-600')}>
            <Arrow size={12} />
            {Math.abs(pct)}% vs last month
        </span>
    );
};

const EmptyState = ({ icon: Icon, message, compact }: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    message: string;
    compact?: boolean;
}) => (
    <div className={cn('flex flex-col items-center justify-center text-muted-foreground', compact ? 'h-[180px]' : 'h-full')}>
        <Icon size={compact ? 36 : 48} className="mb-2 opacity-30" />
        <p className="text-sm">{message}</p>
    </div>
);
