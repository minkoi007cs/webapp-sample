type CurrencyValue = number | string | null | undefined;

type FormatVndOptions = {
    fallback?: string;
    forceSign?: 'plus' | 'minus';
};

const wholeNumberFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

const currencyUnits = [
    { value: 1_000_000_000, label: 'B' },
    { value: 1_000_000, label: 'M' },
    { value: 1_000, label: 'k' },
] as const;

const toNumber = (value: CurrencyValue) => {
    if (value === null || value === undefined || value === '') return null;

    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? amount : null;
};

const roundToDisplayPrecision = (value: number) => (
    Math.round((value + Number.EPSILON) * 100) / 100
);

export const formatVndAmount = (value: CurrencyValue, options: FormatVndOptions = {}) => {
    const amount = toNumber(value);
    if (amount === null) return options.fallback ?? '-';

    const absAmount = Math.abs(amount);
    const sign = absAmount === 0
        ? ''
        : options.forceSign === 'plus'
            ? '+'
            : options.forceSign === 'minus'
                ? '-'
                : amount < 0
                    ? '-'
                    : '';

    if (absAmount < 1_000) {
        return `${sign}$${wholeNumberFormatter.format(absAmount)}`;
    }

    let unitIndex = currencyUnits.findIndex((unit) => absAmount >= unit.value);
    let unit = currencyUnits[unitIndex];
    let scaledAmount = roundToDisplayPrecision(absAmount / unit.value);

    if (scaledAmount >= 1_000 && unitIndex > 0) {
        unitIndex -= 1;
        unit = currencyUnits[unitIndex];
        scaledAmount = roundToDisplayPrecision(absAmount / unit.value);
    }

    return `${sign}$${compactNumberFormatter.format(scaledAmount)}${unit.label}`;
};
