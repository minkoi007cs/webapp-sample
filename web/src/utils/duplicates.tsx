import { Modal } from 'antd';
import dayjs from 'dayjs';
import type { Asset } from '../api/asset';
import type { Category } from '../api/category';
import type { Expense } from '../api/expense';

type ExpenseCandidate = {
    id?: string;
    amount?: number | string | null;
    categoryId?: string;
    expenseDate?: string | null;
    assetId?: string | null;
};

type AssetCandidate = {
    id?: string;
    name?: string | null;
    categoryId?: string | null;
};

const normalizeText = (value: string | null | undefined) => (
    value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
);

const normalizeId = (value: string | null | undefined) => value?.trim() || '';

const normalizeNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isSameDate = (left: string | null | undefined, right: string | null | undefined) => {
    if (!left || !right) return false;

    const leftDate = dayjs(left);
    const rightDate = dayjs(right);

    return leftDate.isValid() && rightDate.isValid() && leftDate.isSame(rightDate, 'day');
};

export const findDuplicateExpense = (expenses: Expense[], candidate: ExpenseCandidate) => {
    const amount = normalizeNumber(candidate.amount);
    const categoryId = normalizeId(candidate.categoryId);
    const assetId = normalizeId(candidate.assetId);
    const expenseDate = candidate.expenseDate ?? undefined;

    if (amount === null || !categoryId || !expenseDate) return null;

    return expenses.find((expense) => {
        if (candidate.id && expense.id === candidate.id) return false;

        const expenseAmount = normalizeNumber(expense.amount);
        const expenseCategoryId = normalizeId(expense.categoryId || expense.category?.id);
        const expenseAssetId = normalizeId(expense.assetId);

        return expenseAmount === amount
            && expenseCategoryId === categoryId
            && expenseAssetId === assetId
            && isSameDate(expense.expenseDate, expenseDate);
    }) ?? null;
};

export const findDuplicateAsset = (assets: Asset[], candidate: AssetCandidate) => {
    const name = normalizeText(candidate.name);
    const categoryId = normalizeId(candidate.categoryId);

    if (!name || !categoryId) return null;

    return assets.find((asset) => {
        if (candidate.id && asset.id === candidate.id) return false;

        return normalizeText(asset.name) === name
            && normalizeId(asset.categoryId || asset.category?.id) === categoryId;
    }) ?? null;
};

type DuplicateWarningOptions = {
    title: string;
    summary: string;
    detailLines: string[];
    okText?: string;
};

export const confirmDuplicateWarning = ({
    title,
    summary,
    detailLines,
    okText = 'Vẫn tiếp tục',
}: DuplicateWarningOptions) => new Promise<boolean>((resolve) => {
    Modal.confirm({
        title,
        content: (
            <div className="space-y-2 text-sm text-slate-600">
                <p>{summary}</p>
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-slate-700">
                    {detailLines.map((line) => (
                        <div key={line}>{line}</div>
                    ))}
                </div>
            </div>
        ),
        okText,
        cancelText: 'Quay lại kiểm tra',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
    });
});

export const getCategoryLabel = (categories: Category[], categoryId?: string | null) => (
    categories.find((category) => category.id === categoryId)?.name || 'Không rõ danh mục'
);

export const getAssetLabel = (assets: Asset[], assetId?: string | null) => (
    assets.find((asset) => asset.id === assetId)?.name || 'Không gắn tài sản'
);
