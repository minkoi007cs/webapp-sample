type CurrencyValue = number | string | null | undefined;

type FormatVndOptions = {
    fallback?: string;
    forceSign?: 'plus' | 'minus';
};

const wholeNumberFormatter = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
});

const vndUnits = [
    { value: 1_000_000_000, label: 'tỉ' },
    { value: 1_000_000, label: 'triệu' },
    { value: 1_000, label: 'nghìn' },
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
        return `${sign}${wholeNumberFormatter.format(absAmount)} đồng`;
    }

    let unitIndex = vndUnits.findIndex((unit) => absAmount >= unit.value);
    let unit = vndUnits[unitIndex];
    let scaledAmount = roundToDisplayPrecision(absAmount / unit.value);

    if (scaledAmount >= 1_000 && unitIndex > 0) {
        unitIndex -= 1;
        unit = vndUnits[unitIndex];
        scaledAmount = roundToDisplayPrecision(absAmount / unit.value);
    }

    return `${sign}${compactNumberFormatter.format(scaledAmount)} ${unit.label} đồng`;
};
