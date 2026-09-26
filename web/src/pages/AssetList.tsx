import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Space, message, Typography, Spin } from 'antd';
import { Plus, Download, Copy, Search, X, Check, Trash2 } from 'lucide-react';
import { assetApi } from '../api/asset';
import { userApi } from '../api/user';
import type { Asset } from '../api/asset';
import { buildCategoryPathLabel, categoryApi } from '../api/category';
import dayjs from 'dayjs';
import { renderMoneyBadge } from '../utils/display';
import { confirmDuplicateWarning, findDuplicateAsset, getCategoryLabel } from '../utils/duplicates';
import { cn } from '../utils/cn';
import { formatVndAmount } from '../utils/currency';
import { asArray, asPaginatedList } from '../api/client';

const ASSET_PAGE_SIZE = 20;

const SOLD_STATUS_LABEL = 'Sold / Disposed';

const getAssetRowClassName = (record: Asset) => {
    if (record.status === 'BROKEN') {
        return '[&>td]:!bg-rose-50/40 [&>td]:!text-rose-600';
    }
    if (record.status === 'SOLD' || record.status === 'LOST') {
        return '[&>td]:!bg-muted/40 [&>td]:!text-muted-foreground';
    }
    return '';
};

export const AssetList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copyMode, setCopyMode] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [form] = Form.useForm();
    const purchaseWatch = Form.useWatch('purchasePrice', form);
    const [filters, setFilters] = useState<{ search?: string; categoryId?: string; status?: string }>({});

    const {
        data: assetInfinite,
        isPending: assetsLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['assets', 'infinite', filters],
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            assetApi
                .findAll({ ...filters, page: pageParam, pageSize: ASSET_PAGE_SIZE })
                .then((res) => asPaginatedList(res.data)),
        getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    });

    const assets = useMemo(
        () => assetInfinite?.pages.flatMap((p) => p.items) ?? [],
        [assetInfinite],
    );

    const onAssetTableScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (nearBottom && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        },
        [fetchNextPage, hasNextPage, isFetchingNextPage],
    );

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: () => categoryApi.findAll().then(res => res.data),
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => userApi.findAll().then((res) => asArray(res.data)),
    });

    const assetCategoryOptions = (categories ?? [])
        .map((category) => ({
            value: category.id,
            label: buildCategoryPathLabel(categories ?? [], category.id),
        }));

    const createMutation = useMutation({
        mutationFn: (data: Partial<Asset>) => assetApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            message.success('Asset created successfully');
            setIsModalOpen(false);
            setCopyMode(false);
            form.resetFields();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: Partial<Asset>) => assetApi.update(editingAsset!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            message.success('Asset updated successfully');
            setIsModalOpen(false);
            setCopyMode(false);
            setEditingAsset(null);
            form.resetFields();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => assetApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            message.success('Asset deleted successfully');
        },
    });

    const handleExport = async () => {
        let url: string | undefined;
        try {
            const response = await assetApi.export(filters);
            url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `assets-${dayjs().format('YYYY-MM-DD')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            message.error('Failed to export asset data');
        } finally {
            if (url) window.URL.revokeObjectURL(url);
        }
    };

    const openAssetEditModal = (record: Asset) => {
        setCopyMode(false);
        setEditingAsset(record);
        form.setFieldsValue({
            name: record.name,
            description: record.description,
            categoryId: record.categoryId,
            status: record.status,
            purchasePrice: record.purchasePrice,
            purchaseDate: record.purchaseDate ? dayjs(record.purchaseDate) : null,
            warrantyExpiredAt: record.warrantyExpiredAt ? dayjs(record.warrantyExpiredAt) : null,
            ownerId: record.ownerId,
            usedById: record.usedById,
        });
        setIsModalOpen(true);
    };

    const openAssetCopyModal = (record: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAsset(null);
        setCopyMode(true);
        form.setFieldsValue({
            name: record.name,
            categoryId: record.categoryId || record.category?.id,
            status: record.status,
            purchasePrice: record.purchasePrice,
            purchaseDate: record.purchaseDate ? dayjs(record.purchaseDate) : null,
            warrantyExpiredAt: record.warrantyExpiredAt ? dayjs(record.warrantyExpiredAt) : null,
            ownerId: record.ownerId,
            usedById: record.usedById,
            description: record.description,
        });
        setIsModalOpen(true);
    };

    const columns = [
        {
            title: 'Asset Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Asset) => (
                <div>
                    <div
                        className={cn(
                            'font-medium',
                            record.status === 'BROKEN' && 'text-rose-600',
                            (record.status === 'SOLD' || record.status === 'LOST') && 'text-muted-foreground',
                            (!record.status || record.status === 'ACTIVE') && 'text-foreground',
                        )}
                    >
                        {text}
                    </div>
                    {record.description ? (
                        <div className="text-xs text-muted-foreground">
                            {record.description}
                        </div>
                    ) : null}
                </div>
            ),
            sorter: (a: Asset, b: Asset) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: 'Category',
            dataIndex: ['category', 'name'],
            key: 'category',
            sorter: (a: Asset, b: Asset) => (a.category?.name || '').localeCompare(b.category?.name || ''),
        },
        {
            title: 'Owner',
            key: 'owner',
            render: (_: unknown, record: Asset) => record.owner?.fullName || record.owner?.email || '-',
            sorter: (a: Asset, b: Asset) => (a.owner?.fullName || a.owner?.email || '').localeCompare(b.owner?.fullName || b.owner?.email || ''),
        },
        {
            title: 'User',
            key: 'usedBy',
            render: (_: unknown, record: Asset) => record.usedBy?.fullName || record.usedBy?.email || '-',
            sorter: (a: Asset, b: Asset) => (a.usedBy?.fullName || a.usedBy?.email || '').localeCompare(b.usedBy?.fullName || b.usedBy?.email || ''),
        },
        {
            title: 'Purchase Price',
            dataIndex: 'purchasePrice',
            key: 'purchasePrice',
            render: (val: number) => renderMoneyBadge(val),
            sorter: (a: Asset, b: Asset) => Number(a.purchasePrice || 0) - Number(b.purchasePrice || 0),
        },
        {
            title: 'Current Value',
            dataIndex: 'currentValue',
            key: 'currentValue',
            render: (val: number) => renderMoneyBadge(val),
            sorter: (a: Asset, b: Asset) => Number(a.currentValue || 0) - Number(b.currentValue || 0),
        },
        {
            title: 'Actions',
            key: 'action',
            render: (_: unknown, record: Asset) => (
                <Space size="middle" onClick={(e) => e.stopPropagation()}>
                    <Button
                        type="text"
                        icon={<Copy size={16} />}
                        title="Duplicate"
                        aria-label="Duplicate"
                        onClick={(e) => openAssetCopyModal(record, e)}
                    />
                </Space>
            ),
        },
    ];

    const confirmDuplicateAsset = async (
        data: Partial<Asset>,
        options?: { ignoreEditingAsset?: boolean },
    ) => {
        const nameTrim = (data.name || '').trim();
        const dupRes = await assetApi.findAll({
            search: nameTrim || undefined,
            categoryId: data.categoryId,
            page: 1,
            pageSize: 200,
        });
        const candidates = asArray(dupRes.data);
        const duplicate = findDuplicateAsset(candidates, {
            id: options?.ignoreEditingAsset ? undefined : editingAsset?.id,
            name: data.name,
            categoryId: data.categoryId,
        });

        if (!duplicate) return true;

        return confirmDuplicateWarning({
            title: 'Duplicate Asset Detected',
            summary: 'An asset with the same name and category already exists. You can still proceed if this is a distinct item.',
            detailLines: [
                `Asset: ${data.name || '-'}`,
                `Category: ${getCategoryLabel(categories ?? [], data.categoryId)}`,
            ],
        });
    };

    const buildAssetPayload = (values: Record<string, unknown>) => {
        const { currentValue: _cv, linkedExpenseTotal: _le, linkedIncomeTotal: _li, ...rest } = values as Record<string, unknown>;
        return {
            ...rest,
            purchaseDate: (values.purchaseDate as { toISOString?: () => string } | undefined)?.toISOString?.(),
            warrantyExpiredAt: (values.warrantyExpiredAt as { toISOString?: () => string } | undefined)?.toISOString?.(),
        };
    };

    const linkedChi = editingAsset?.linkedExpenseTotal ?? 0;
    const linkedThu = editingAsset?.linkedIncomeTotal ?? 0;
    const purchaseForFormula =
        purchaseWatch !== undefined && purchaseWatch !== null
            ? Number(purchaseWatch)
            : Number(editingAsset?.purchasePrice ?? 0);
    const displayedCurrentValue = purchaseForFormula + linkedChi - linkedThu;

    return (
        <div className="space-y-4 lg:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-foreground font-sans">Asset Management</h1>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                        icon={<Download size={18} />}
                        onClick={handleExport}
                        className="flex-1 sm:flex-none"
                        title="Export CSV"
                        aria-label="Export CSV"
                    />
                    <Button
                        type="primary"
                        icon={<Plus size={18} />}
                        onClick={() => {
                            setEditingAsset(null);
                            setCopyMode(false);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none"
                        title="Add Asset"
                        aria-label="Add Asset"
                    />
                </div>
            </div>

            <div className="glass-card p-4 lg:p-6 overflow-hidden">
                <div className="mb-4 flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder="Search assets..."
                        prefix={<Search size={16} className="text-muted-foreground" />}
                        className="w-full sm:max-w-xs"
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                    <Select
                        placeholder="Filter by status"
                        className="w-full sm:w-44"
                        allowClear
                        onChange={(val) => setFilters({ ...filters, status: val })}
                        options={[
                            { value: 'ACTIVE', label: 'Active' },
                            { value: 'BROKEN', label: 'Broken' },
                            { value: 'SOLD', label: SOLD_STATUS_LABEL },
                            { value: 'LOST', label: 'Lost' },
                        ]}
                    />
                </div>

                {isError && <div className="mb-3 p-3 rounded-lg bg-rose-50 text-rose-600 text-sm">Failed to load asset list. Please retry.</div>}
                <div className="overflow-x-auto">
                    <Table
                        columns={columns}
                        dataSource={assets}
                        loading={assetsLoading}
                        rowKey="id"
                        rowClassName={(record) => getAssetRowClassName(record)}
                        onRow={(record) => ({
                            onClick: () => openAssetEditModal(record),
                            style: { cursor: 'pointer' }
                        })}
                        pagination={false}
                        onScroll={onAssetTableScroll}
                        scroll={{ x: 880, y: 'calc(100vh - 280px)' }}
                        size={window.innerWidth < 768 ? 'small' : 'middle'}
                    />
                    {isFetchingNextPage ? (
                        <div className="flex justify-center py-2">
                            <Spin size="small" />
                        </div>
                    ) : null}
                </div>
            </div>

            <Modal
                title={editingAsset ? 'Edit Asset' : copyMode ? 'Duplicate Asset' : 'Add New Asset'}
                open={isModalOpen}
                forceRender
                onCancel={() => {
                    setIsModalOpen(false);
                    setCopyMode(false);
                    setEditingAsset(null);
                    form.resetFields();
                }}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                width={600}
                footer={[
                    <div key="metadata" className="flex flex-col items-start text-[12px] text-muted-foreground mb-4 px-2 sm:px-4 w-full">
                        {editingAsset?.createdAt && (
                            <span>Created by {editingAsset.creator?.fullName || editingAsset.creator?.email || 'System'} at {dayjs(editingAsset.createdAt).format('HH:mm YYYY-MM-DD')}</span>
                        )}
                        {editingAsset?.updatedAt && editingAsset.updatedBy && (
                            <span>Last updated by {editingAsset.updater?.fullName || editingAsset.updater?.email || '-'} at {dayjs(editingAsset.updatedAt).format('HH:mm YYYY-MM-DD')}</span>
                        )}
                    </div>,
                    editingAsset ? (
                        <Button
                            key="delete"
                            danger
                            icon={<Trash2 size={18} />}
                            title="Delete Asset"
                            aria-label="Delete Asset"
                            loading={deleteMutation.isPending}
                            onClick={() => {
                                Modal.confirm({
                                    title: 'Confirm Deletion',
                                    content: `Are you sure you want to delete "${editingAsset.name}"?`,
                                    onOk: () => {
                                        deleteMutation.mutate(editingAsset.id, {
                                            onSuccess: () => {
                                                setIsModalOpen(false);
                                                setEditingAsset(null);
                                                setCopyMode(false);
                                                form.resetFields();
                                            },
                                        });
                                    },
                                });
                            }}
                        />
                    ) : null,
                    <Button
                        key="cancel"
                        type="text"
                        icon={<X size={18} />}
                        title="Cancel"
                        aria-label="Cancel"
                        onClick={() => { setIsModalOpen(false); setCopyMode(false); setEditingAsset(null); form.resetFields(); }}
                    />,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<Check size={18} />}
                        title={editingAsset ? 'Update' : 'Save Asset'}
                        aria-label={editingAsset ? 'Update' : 'Save Asset'}
                        onClick={() => form.submit()}
                        loading={createMutation.isPending || updateMutation.isPending}
                    />
                ]}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={async (values) => {
                        const data = buildAssetPayload(values);
                        const shouldContinue = await confirmDuplicateAsset(data);
                        if (!shouldContinue) return;

                        if (editingAsset) {
                            updateMutation.mutate(data);
                        } else {
                            createMutation.mutate(data);
                        }
                    }}
                    className="mt-4"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Form.Item name="name" label="Asset Name" rules={[{ required: true }]} className="sm:col-span-2">
                            <Input />
                        </Form.Item>
                        <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
                            <Select options={assetCategoryOptions} />
                        </Form.Item>
                        <Form.Item name="status" label="Status" initialValue="ACTIVE">
                            <Select options={[
                                { value: 'ACTIVE', label: 'Active' },
                                { value: 'BROKEN', label: 'Broken' },
                                { value: 'SOLD', label: SOLD_STATUS_LABEL },
                            ]} />
                        </Form.Item>
                        <Form.Item name="purchasePrice" label="Purchase Price">
                            <InputNumber className="w-full" formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                        <Form.Item
                            label="Current Valuation (Auto)"
                            className="sm:col-span-2"
                            extra="Based on stored data: purchase price + total linked expenses − total linked income. Editing purchase price is an estimate until saved."
                        >
                            <Typography.Text className="text-base font-semibold text-foreground">
                                {formatVndAmount(displayedCurrentValue)}
                            </Typography.Text>
                            {editingAsset ? (
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Linked Expenses: {formatVndAmount(linkedChi)} · Linked Income: {formatVndAmount(linkedThu)}
                                </div>
                            ) : null}
                        </Form.Item>
                        <Form.Item name="purchaseDate" label="Purchase Date">
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item name="warrantyExpiredAt" label="Warranty Expiry Date">
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item name="ownerId" label="Legal Owner">
                            <Select
                                options={users?.map(u => ({ value: u.id, label: u.fullName || u.email }))}
                                allowClear
                                showSearch
                                placeholder="Select owner..."
                            />
                        </Form.Item>
                        <Form.Item name="usedById" label="Primary User">
                            <Select
                                options={users?.map(u => ({ value: u.id, label: u.fullName || u.email }))}
                                allowClear
                                showSearch
                                placeholder="Select primary user..."
                            />
                        </Form.Item>
                        <Form.Item name="description" label="Description" className="sm:col-span-2">
                            <Input.TextArea rows={3} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};
