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

/** Nhãn hiển thị cho trạng thái SOLD (đồng bộ filter + form) */
const SOLD_STATUS_LABEL = 'Đã bán/bỏ';

const getAssetRowClassName = (record: Asset) => {
    if (record.status === 'BROKEN') {
        return '[&>td]:!bg-slate-100 [&>td]:!text-red-600';
    }
    if (record.status === 'SOLD' || record.status === 'LOST') {
        return '[&>td]:!bg-slate-100 [&>td]:!text-slate-700';
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
            message.success('Tài sản đã được thêm');
            setIsModalOpen(false);
            setCopyMode(false);
            form.resetFields();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: Partial<Asset>) => assetApi.update(editingAsset!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            message.success('Cập nhật thành công');
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
            message.success('Đã xóa tài sản');
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
            message.error('Lỗi khi xuất dữ liệu');
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
            title: 'Tên tài sản',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Asset) => (
                <div>
                    <div
                        className={cn(
                            'font-medium',
                            record.status === 'BROKEN' && 'text-red-600',
                            (record.status === 'SOLD' || record.status === 'LOST') && 'text-slate-700',
                            (!record.status || record.status === 'ACTIVE') && 'text-slate-900',
                        )}
                    >
                        {text}
                    </div>
                    <div
                        className={cn(
                            'text-xs',
                            record.status === 'BROKEN' && 'text-red-500/90',
                            (record.status === 'SOLD' || record.status === 'LOST') && 'text-slate-600',
                            (!record.status || record.status === 'ACTIVE') && 'text-slate-700',
                        )}
                    >
                        {record.description}
                    </div>
                </div>
            ),
            sorter: (a: Asset, b: Asset) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: 'Danh mục',
            dataIndex: ['category', 'name'],
            key: 'category',
            sorter: (a: Asset, b: Asset) => (a.category?.name || '').localeCompare(b.category?.name || ''),
        },
        {
            title: 'Người đứng tên',
            key: 'owner',
            render: (_: unknown, record: Asset) => record.owner?.fullName || record.owner?.email || '-',
            sorter: (a: Asset, b: Asset) => (a.owner?.fullName || a.owner?.email || '').localeCompare(b.owner?.fullName || b.owner?.email || ''),
        },
        {
            title: 'Người sử dụng',
            key: 'usedBy',
            render: (_: unknown, record: Asset) => record.usedBy?.fullName || record.usedBy?.email || '-',
            sorter: (a: Asset, b: Asset) => (a.usedBy?.fullName || a.usedBy?.email || '').localeCompare(b.usedBy?.fullName || b.usedBy?.email || ''),
        },
        {
            title: 'Giá mua',
            dataIndex: 'purchasePrice',
            key: 'purchasePrice',
            render: (val: number) => renderMoneyBadge(val),
            sorter: (a: Asset, b: Asset) => Number(a.purchasePrice || 0) - Number(b.purchasePrice || 0),
        },
        {
            title: 'Giá trị hiện tại',
            dataIndex: 'currentValue',
            key: 'currentValue',
            render: (val: number) => renderMoneyBadge(val),
            sorter: (a: Asset, b: Asset) => Number(a.currentValue || 0) - Number(b.currentValue || 0),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: unknown, record: Asset) => (
                <Space size="middle" onClick={(e) => e.stopPropagation()}>
                    <Button
                        type="text"
                        icon={<Copy size={16} />}
                        title="Sao chép"
                        aria-label="Sao chép"
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
            title: 'Phát hiện tài sản trùng',
            summary: 'Đã có tài sản cùng tên và danh mục. Bạn vẫn có thể tiếp tục nếu đây là một tài sản khác nhưng trùng cách đặt tên.',
            detailLines: [
                `Tên tài sản: ${data.name || '-'}`,
                `Danh mục: ${getCategoryLabel(categories ?? [], data.categoryId)}`,
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
                    <h1 className="text-xl lg:text-2xl font-bold text-slate-900 font-display">Quản lý tài sản</h1>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                        icon={<Download size={18} />}
                        onClick={handleExport}
                        className="flex-1 sm:flex-none"
                        title="Xuất CSV"
                        aria-label="Xuất CSV"
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
                        title="Thêm tài sản"
                        aria-label="Thêm tài sản"
                    />
                </div>
            </div>

            <div className="glass-card p-4 lg:p-6 overflow-hidden">
                <div className="mb-4 flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder="Tìm kiếm tài sản..."
                        prefix={<Search size={16} className="text-slate-600" />}
                        className="w-full sm:max-w-xs"
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                    <Select
                        placeholder="Loại trạng thái"
                        className="w-full sm:w-40"
                        allowClear
                        onChange={(val) => setFilters({ ...filters, status: val })}
                        options={[
                            { value: 'ACTIVE', label: 'Hoạt động' },
                            { value: 'BROKEN', label: 'Hỏng' },
                            { value: 'SOLD', label: SOLD_STATUS_LABEL },
                            { value: 'LOST', label: 'Mất' },
                        ]}
                    />
                </div>

                {isError && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">Không thể tải danh sách tài sản. Vui lòng thử lại.</div>}
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
                title={editingAsset ? 'Cập nhật tài sản' : copyMode ? 'Sao chép tài sản' : 'Thêm tài sản mới'}
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
                    <div key="metadata" className="flex flex-col items-start text-[12px] text-slate-600 mb-4 px-2 sm:px-4 w-full">
                        {editingAsset?.createdAt && (
                            <span>Tạo bởi {editingAsset.creator?.fullName || editingAsset.creator?.email || 'Hệ thống'} lúc {dayjs(editingAsset.createdAt).format('HH:mm DD/MM/YYYY')}</span>
                        )}
                        {editingAsset?.updatedAt && editingAsset.updatedBy && (
                            <span>Cập nhật cuối bởi {editingAsset.updater?.fullName || editingAsset.updater?.email || '-'} lúc {dayjs(editingAsset.updatedAt).format('HH:mm DD/MM/YYYY')}</span>
                        )}
                    </div>,
                    editingAsset ? (
                        <Button
                            key="delete"
                            danger
                            icon={<Trash2 size={18} />}
                            title="Xóa tài sản"
                            aria-label="Xóa tài sản"
                            loading={deleteMutation.isPending}
                            onClick={() => {
                                Modal.confirm({
                                    title: 'Xác nhận xóa',
                                    content: `Bạn có chắc muốn xóa "${editingAsset.name}"?`,
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
                        title="Hủy"
                        aria-label="Hủy"
                        onClick={() => { setIsModalOpen(false); setCopyMode(false); setEditingAsset(null); form.resetFields(); }}
                    />,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<Check size={18} />}
                        title={editingAsset ? 'Cập nhật' : 'Thêm tài sản'}
                        aria-label={editingAsset ? 'Cập nhật' : 'Thêm tài sản'}
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
                        <Form.Item name="name" label="Tên tài sản" rules={[{ required: true }]} className="sm:col-span-2">
                            <Input />
                        </Form.Item>
                        <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true }]}>
                            <Select options={assetCategoryOptions} />
                        </Form.Item>
                        <Form.Item name="status" label="Trạng thái" initialValue="ACTIVE">
                            <Select options={[
                                { value: 'ACTIVE', label: 'Hoạt động' },
                                { value: 'BROKEN', label: 'Hỏng' },
                                { value: 'SOLD', label: SOLD_STATUS_LABEL },
                            ]} />
                        </Form.Item>
                        <Form.Item name="purchasePrice" label="Giá mua">
                            <InputNumber className="w-full" formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} addonAfter="đồng" />
                        </Form.Item>
                        <Form.Item
                            label="Giá hiện tại (tự động)"
                            className="sm:col-span-2"
                            extra="Theo dữ liệu đã lưu: giá mua + tổng chi − tổng thu của các giao dịch tài chính có gắn tài sản này (không tính chuyển nội bộ). Đổi giá mua bên trên chỉ là ước tính cho đến khi bấm Lưu."
                        >
                            <Typography.Text className="text-base font-semibold text-slate-800">
                                {formatVndAmount(displayedCurrentValue)}
                            </Typography.Text>
                            {editingAsset ? (
                                <div className="mt-1 text-xs text-slate-700">
                                    Chi đã gắn: {formatVndAmount(linkedChi)} · Thu đã gắn: {formatVndAmount(linkedThu)}
                                </div>
                            ) : null}
                        </Form.Item>
                        <Form.Item name="purchaseDate" label="Ngày mua">
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item name="warrantyExpiredAt" label="Hết hạn bảo hành">
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item name="ownerId" label="Người đứng tên">
                            <Select
                                options={users?.map(u => ({ value: u.id, label: u.fullName || u.email }))}
                                allowClear
                                showSearch
                                placeholder="Chọn người đứng tên..."
                            />
                        </Form.Item>
                        <Form.Item name="usedById" label="Người sử dụng">
                            <Select
                                options={users?.map(u => ({ value: u.id, label: u.fullName || u.email }))}
                                allowClear
                                showSearch
                                placeholder="Chọn người sử dụng..."
                            />
                        </Form.Item>
                        <Form.Item name="description" label="Mô tả" className="sm:col-span-2">
                            <Input.TextArea rows={3} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};
