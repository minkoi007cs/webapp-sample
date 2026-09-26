import type { ReactNode } from 'react';
import dayjs, { type ConfigType } from 'dayjs';
import { cn } from './cn';
import { formatVndAmount } from './currency';

const moneyTierStyles = {
    thousand: {
        light: 'bg-sky-50 text-sky-700 ring-sky-100',
        medium: 'bg-sky-100 text-sky-800 ring-sky-200',
        strong: 'bg-sky-100/90 text-sky-900 ring-sky-200',
    },
    million: {
        light: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        medium: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
        strong: 'bg-emerald-100/90 text-emerald-900 ring-emerald-200',
    },
    billion: {
        light: 'bg-amber-50 text-amber-700 ring-amber-100',
        medium: 'bg-amber-100 text-amber-800 ring-amber-200',
        strong: 'bg-amber-100/90 text-amber-900 ring-amber-200',
    },
    base: {
        light: 'bg-slate-100 text-slate-700 ring-slate-200',
        medium: 'bg-slate-100 text-slate-800 ring-slate-200',
        strong: 'bg-slate-200/80 text-slate-900 ring-slate-300',
    },
} as const;

const dateWindowStyles = {
    past: 'bg-rose-50 text-rose-700 ring-rose-100',
    current: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    future: 'bg-violet-50 text-violet-700 ring-violet-100',
    empty: 'bg-slate-100 text-slate-600 ring-slate-200',
} as const;

const baseBadgeClassName = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap';

type MoneyDisplayOptions = {
    className?: string;
    forceSign?: 'plus' | 'minus';
};

type DateDisplayOptions = {
    className?: string;
    emptyLabel?: ReactNode;
    format?: string;
};

const toNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getMoneyTier = (absAmount: number) => {
    if (absAmount >= 1_000_000_000) return 'billion';
    if (absAmount >= 1_000_000) return 'million';
    if (absAmount >= 1_000) return 'thousand';
    return 'base';
};

const getMoneyTierStrength = (absAmount: number, tier: ReturnType<typeof getMoneyTier>) => {
    const denominator = tier === 'billion'
        ? 1_000_000_000
        : tier === 'million'
            ? 1_000_000
            : tier === 'thousand'
                ? 1_000
                : 100;

    const scaled = absAmount / denominator;
    if (scaled >= 100) return 'strong';
    if (scaled >= 10) return 'medium';
    return 'light';
};

export const getMoneyBadgeClassName = (value: number | string | null | undefined, className?: string) => {
    const amount = toNumber(value);
    const tier = amount === null ? 'base' : getMoneyTier(Math.abs(amount));
    const strength = amount === null ? 'light' : getMoneyTierStrength(Math.abs(amount), tier);

    return cn(baseBadgeClassName, moneyTierStyles[tier][strength], className);
};

export const renderMoneyBadge = (
    value: number | string | null | undefined,
    options: MoneyDisplayOptions = {},
) => (
    <span className={getMoneyBadgeClassName(value, options.className)}>
        {formatVndAmount(value, { forceSign: options.forceSign })}
    </span>
);

const getDateWindow = (value: ConfigType | null | undefined) => {
    if (!value) return 'empty';

    const date = dayjs(value);
    if (!date.isValid()) return 'empty';

    const today = dayjs().startOf('day');
    const threeMonthsLater = today.add(3, 'month').endOf('day');

    if (date.isBefore(today)) return 'past';
    if (date.isAfter(threeMonthsLater)) return 'future';
    return 'current';
};

export const getDateBadgeClassName = (value: ConfigType | null | undefined, className?: string) => {
    const windowKey = getDateWindow(value);
    return cn(baseBadgeClassName, dateWindowStyles[windowKey], className);
};

export const renderDateBadge = (
    value: ConfigType | null | undefined,
    options: DateDisplayOptions = {},
) => {
    const date = value ? dayjs(value) : null;
    const label = date?.isValid()
        ? date.format(options.format ?? 'DD/MM/YYYY')
        : options.emptyLabel ?? '-';

    return (
        <span className={getDateBadgeClassName(value, options.className)}>
            {label}
        </span>
    );
};
