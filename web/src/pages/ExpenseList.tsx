import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Tag, message, Switch, Row, Col, Divider, Radio, Space, Spin } from 'antd';
import { Plus, Download, Copy, Wallet, PlusCircle, X, Check, Trash2, FilterX } from 'lucide-react';
import { expenseApi } from '../api/expense';
import type { Expense } from '../api/expense';
import { assetApi } from '../api/asset';
import {
  buildCategoryPathLabel,
  categoryApi,
  expenseEntryTypeLabels,
  type ExpenseEntryType,
} from '../api/category';
import { userApi } from '../api/user';
import { asArray, asPaginatedList } from '../api/client';
import dayjs from 'dayjs';
import { renderDateBadge, renderMoneyBadge } from '../utils/display';
import { formatVndAmount } from '../utils/currency';
import {
  confirmDuplicateWarning,
  findDuplicateExpense,
  getAssetLabel,
  getCategoryLabel,
} from '../utils/duplicates';

const EXPENSE_PAGE_SIZE = 20;

export const ExpenseList = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<any>({});
  const [transactionType, setTransactionType] = useState<ExpenseEntryType>('EXPENSE');
  const isTransfer = Form.useWatch('isTransfer', form) as boolean | undefined;

  const [newCategoryName, setNewCategoryName] = useState('');
  const inputRef = useRef<any>(null);

  const {
    data: expenseInfinite,
    isPending: expensesLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['expenses', 'infinite', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      expenseApi
        .findAll({ ...filters, page: pageParam, pageSize: EXPENSE_PAGE_SIZE })
        .then((res) => asPaginatedList(res.data)),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const expenses = useMemo(
    () => expenseInfinite?.pages.flatMap((p) => p.items) ?? [],
    [expenseInfinite],
  );

  const onExpenseTableScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const { data: assets } = useQuery({
    queryKey: ['assets', 'brief'],
    queryFn: () => assetApi.findAll().then((res) => asArray(res.data)),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.findAll().then((res) => res.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.findAll().then((res) => asArray(res.data)),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Expense>) => expenseApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      message.success('Giao dịch đã được ghi nhận');
      setIsModalOpen(false);
      setCopyMode(false);
      form.resetFields();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Expense>) => expenseApi.update(editingExpense!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      message.success('Đã cập nhật giao dịch');
      setIsModalOpen(false);
      setCopyMode(false);
      setEditingExpense(null);
      form.resetFields();
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => categoryApi.create({
      name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      message.success('Đã thêm danh mục mới');
      setNewCategoryName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      message.success('Đã xóa bản ghi');
    },
  });

  const handleExport = async () => {
    try {
      const response = await expenseApi.export(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions-${dayjs().format('YYYY-MM-DD')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      message.error('Lỗi khi xuất dữ liệu');
    }
  };

  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategoryName(event.target.value);
  };

  const addItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    if (newCategoryName) {
      addCategoryMutation.mutate(newCategoryName);
    }
  };

  const resolveTransactionType = (expense?: Expense | null) => expense?.entryType || 'EXPENSE';

  const categorySelectOptions = useMemo(() => {
    return (categories ?? [])
      .map((category) => ({
        value: category.id,
        label: buildCategoryPathLabel(categories ?? [], category.id),
      }));
  }, [categories]);

  const categoryFilterOptions = useMemo(() => {
    return (categories ?? [])
      .map((category) => ({
        value: category.id,
        label: buildCategoryPathLabel(categories ?? [], category.id),
      }));
  }, [categories]);

  useEffect(() => {
    if (isModalOpen && !editingExpense && !copyMode) {
      form.setFieldValue('categoryId', undefined);
      form.setFieldValue('isTransfer', false);
    }
  }, [isModalOpen, editingExpense, copyMode, form]);

  const handleEdit = (expense: Expense) => {
    setCopyMode(false);
    setTransactionType(resolveTransactionType(expense));
    setEditingExpense(expense);
    form.setFieldsValue({
      ...expense,
      expenseDate: dayjs(expense.expenseDate),
      isTransfer: Boolean(expense.isTransfer),
    });
    setIsModalOpen(true);
  };

  const openExpenseCopyModal = (record: Expense, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingExpense(null);
    setCopyMode(true);
    setTransactionType(resolveTransactionType(record));
    form.setFieldsValue({
      amount: record.amount,
      categoryId: record.categoryId || record.category?.id,
      assetId: record.assetId,
      note: record.note,
      isTransfer: Boolean(record.isTransfer),
      expenseDate: record.expenseDate ? dayjs(record.expenseDate) : dayjs(),
    });
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      render: (date: string) => renderDateBadge(date),
      sorter: (a: Expense, b: Expense) => dayjs(a.expenseDate).valueOf() - dayjs(b.expenseDate).valueOf(),
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number, record: Expense) => {
        const isIncome = record.entryType === 'INCOME' && !record.isTransfer;
        return renderMoneyBadge(val, { forceSign: isIncome ? 'plus' : 'minus' });
      },
      sorter: (a: Expense, b: Expense) => Number(a.amount || 0) - Number(b.amount || 0),
    },
    {
      title: 'Danh mục',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (name: string, record: Expense) => (
        <Space size={4} wrap>
          <Tag color={record.entryType === 'INCOME' ? 'green' : 'orange'}>{name}</Tag>
          {record.isTransfer ? <Tag color="blue">Chuyển nội bộ</Tag> : null}
        </Space>
      ),
      sorter: (a: Expense, b: Expense) => (a.category?.name || '').localeCompare(b.category?.name || ''),
    },
    {
      title: 'Loại giao dịch',
      dataIndex: 'entryType',
      key: 'entryType',
      render: (entryType: ExpenseEntryType) => (
        <Tag color={entryType === 'INCOME' ? 'green' : 'orange'}>
          {expenseEntryTypeLabels[entryType]}
        </Tag>
      ),
      sorter: (a: Expense, b: Expense) => (a.entryType || '').localeCompare(b.entryType || ''),
    },
    {
      title: 'Tài sản',
      dataIndex: ['asset', 'name'],
      key: 'asset',
      render: (name: string) => name || '-',
      sorter: (a: Expense, b: Expense) => (a.asset?.name || '').localeCompare(b.asset?.name || ''),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: Expense) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            type="text"
            icon={<Copy size={16} />}
            title="Sao chép"
            aria-label="Sao chép"
            onClick={(e) => openExpenseCopyModal(record, e)}
          />
        </Space>
      ),
    },
  ];

  const confirmDuplicateExpense = async (
    data: Partial<Expense> & { categoryId?: string },
    options?: { ignoreEditingExpense?: boolean },
  ) => {
    const dayStr = dayjs(data.expenseDate).format('YYYY-MM-DD');
    const dupRes = await expenseApi.findAll({
      amount: data.amount,
      categoryId: data.categoryId,
      assetId: data.assetId || undefined,
      startDate: dayStr,
      endDate: dayStr,
      page: 1,
      pageSize: 200,
    });
    const candidates = asArray(dupRes.data);
    const duplicate = findDuplicateExpense(candidates, {
      id: options?.ignoreEditingExpense ? undefined : editingExpense?.id,
      amount: data.amount,
      categoryId: data.categoryId,
      expenseDate: data.expenseDate,
      assetId: data.assetId,
    });

    if (!duplicate) return true;

    return confirmDuplicateWarning({
      title: 'Phát hiện giao dịch trùng',
      summary: 'Đã có giao dịch cùng số tiền, danh mục, ngày thực hiện và tài sản. Bạn vẫn có thể tiếp tục nếu đây là bản ghi hợp lệ.',
      detailLines: [
        `Số tiền: ${formatVndAmount(data.amount)}`,
        `Danh mục: ${getCategoryLabel(categories ?? [], data.categoryId)}`,
        `Ngày: ${dayjs(data.expenseDate).format('DD/MM/YYYY')}`,
        `Tài sản: ${getAssetLabel(assets ?? [], data.assetId)}`,
      ],
    });
  };

  const buildExpensePayload = (values: any) => ({
    ...values,
    // Theo ngày lịch người dùng chọn; tránh toISOString() làm lệch ngày khi sang UTC.
    expenseDate: values.expenseDate ? dayjs(values.expenseDate).format('YYYY-MM-DD') : undefined,
    entryType: transactionType,
    isTransfer: Boolean(values.isTransfer),
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 font-display">
            Quản lý tài chính
          </h1>
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
              setEditingExpense(null);
              setCopyMode(false);
              setTransactionType('EXPENSE');
              form.resetFields();
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none"
            title="Ghi nhận giao dịch"
            aria-label="Ghi nhận giao dịch"
          />
        </div>
      </div>

      <div className="glass-card p-4 lg:p-6 overflow-hidden">
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select
            placeholder="Loại giao dịch"
            allowClear
            value={filters.direction}
            onChange={(val) => setFilters({
              ...filters,
              direction: val,
              categoryId: undefined,
            })}
            options={[
              { value: 'EXPENSE', label: 'Chi phí' },
              { value: 'INCOME', label: 'Thu nhập' },
            ]}
          />
          <Select
            placeholder="Danh mục"
            allowClear
            value={filters.categoryId}
            onChange={(val) => setFilters({ ...filters, categoryId: val })}
            options={categoryFilterOptions}
          />
          <Select
            placeholder="Tài sản liên quan"
            allowClear
            value={filters.assetId}
            onChange={(val) => setFilters({ ...filters, assetId: val })}
            options={assets?.map((asset) => ({ value: asset.id, label: asset.name }))}
          />
          <Select
            placeholder="Người ghi nhận"
            allowClear
            value={filters.createdBy}
            onChange={(val) => setFilters({ ...filters, createdBy: val })}
            options={users?.map((user) => ({ value: user.id, label: user.fullName || user.email }))}
          />
          <InputNumber
            className="w-full"
            placeholder="Số tiền"
            value={filters.amount}
            onChange={(value) => setFilters({ ...filters, amount: value ?? undefined })}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value?.replace(/\$\s?|(,*)/g, '') || ''}
            addonAfter="đồng"
          />
        </div>

        <div className="mb-6 flex flex-1 flex-col sm:flex-row gap-3">
          <DatePicker.RangePicker
            className="flex-1"
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(dates) => {
              setFilters({
                ...filters,
                startDate: dates ? dates[0]?.format('YYYY-MM-DD') : undefined,
                endDate: dates ? dates[1]?.format('YYYY-MM-DD') : undefined,
              });
            }}
          />
          <Button
            icon={<FilterX size={18} />}
            onClick={() => setFilters({})}
            className="w-full sm:w-auto"
            title="Xóa bộ lọc"
            aria-label="Xóa bộ lọc"
          />
        </div>

        {isError && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">Không thể tải danh sách giao dịch. Vui lòng thử lại.</div>}
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={expenses}
            loading={expensesLoading}
            rowKey="id"
            onRow={(record) => ({
              onClick: () => handleEdit(record),
              className: 'cursor-pointer hover:bg-slate-50 transition-colors',
            })}
            pagination={false}
            onScroll={onExpenseTableScroll}
            scroll={{ x: 800, y: 'calc(100vh - 280px)' }}
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
        title={
          editingExpense
            ? 'Sửa giao dịch'
            : copyMode
              ? 'Sao chép giao dịch'
              : (transactionType === 'INCOME' ? 'Ghi nhận khoản thu' : 'Ghi nhận chi phí')
        }
        open={isModalOpen}
        forceRender
        onCancel={() => {
          setIsModalOpen(false);
          setCopyMode(false);
          setEditingExpense(null);
          setTransactionType('EXPENSE');
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={window.innerWidth < 480 ? '100%' : 500}
        style={window.innerWidth < 480 ? { top: 12 } : undefined}
        bodyStyle={window.innerWidth < 480 ? { padding: 12, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' } : undefined}
        className={transactionType === 'INCOME' ? 'rounded-2xl transaction-modal-income' : 'rounded-2xl transaction-modal-expense'}
        footer={[
          <div key="metadata" className="flex flex-col items-start text-[12px] text-slate-600 mb-4 px-4 w-full">
            {editingExpense?.createdAt && (
              <span>Tạo bởi {editingExpense.creator?.fullName || editingExpense.creator?.email || 'Hệ thống'} lúc {dayjs(editingExpense.createdAt).format('HH:mm DD/MM/YYYY')}</span>
            )}
            {editingExpense?.updatedAt && editingExpense.updatedBy && (
              <span>Cập nhật cuối bởi {editingExpense.updater?.fullName || editingExpense.updater?.email || '-'} lúc {dayjs(editingExpense.updatedAt).format('HH:mm DD/MM/YYYY')}</span>
            )}
          </div>,
          editingExpense ? (
            <Button
              key="delete"
              danger
              icon={<Trash2 size={18} />}
              title="Xóa giao dịch"
              aria-label="Xóa giao dịch"
              loading={deleteMutation.isPending}
              onClick={() => {
                Modal.confirm({
                  title: 'Xác nhận xóa',
                  content: 'Bản ghi này sẽ bị xóa vĩnh viễn',
                  onOk: () => {
                    deleteMutation.mutate(editingExpense.id, {
                      onSuccess: () => {
                        setIsModalOpen(false);
                        setEditingExpense(null);
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
            onClick={() => { setIsModalOpen(false); setCopyMode(false); setEditingExpense(null); setTransactionType('EXPENSE'); form.resetFields(); }}
          />,
          <Button
            key="submit"
            type="primary"
            icon={<Check size={18} />}
            title={editingExpense ? 'Cập nhật' : 'Ghi nhận'}
            aria-label={editingExpense ? 'Cập nhật' : 'Ghi nhận'}
            onClick={() => form.submit()}
            loading={createMutation.isPending || updateMutation.isPending}
          />,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const data = buildExpensePayload(values);
            const shouldContinue = await confirmDuplicateExpense(data);
            if (!shouldContinue) return;

            if (editingExpense) {
              updateMutation.mutate(data);
            } else {
              createMutation.mutate(data);
            }
          }}
          className="mt-4"
        >
          <Form.Item label="Loại giao dịch" className="mb-4">
            <Radio.Group
              value={transactionType}
              onChange={(e) => {
                setTransactionType(e.target.value);
                form.setFieldValue('categoryId', undefined);
              }}
              buttonStyle="solid"
              className="w-full"
            >
              <Radio.Button value="EXPENSE" className="w-1/3 text-center">Chi phí</Radio.Button>
              <Radio.Button value="INCOME" className="w-1/3 text-center">Thu nhập</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={window.innerWidth < 480 ? 8 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true }]}>
                <Select
                  size={window.innerWidth < 480 ? 'middle' : 'large'}
                  placeholder={isTransfer ? 'Chọn danh mục tài sản hoặc công nợ' : 'Chọn danh mục'}
                  options={categorySelectOptions}
                  notFoundContent={
                    isTransfer
                      ? 'Chưa có danh mục chuyển nội bộ phù hợp'
                      : transactionType === 'INCOME'
                        ? 'Chưa có danh mục thu — nhập tên phía dưới và bấm Thêm'
                        : 'Chưa có danh mục — nhập tên phía dưới và bấm Thêm'
                  }
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <Space style={{ padding: '0 8px 4px' }}>
                        <Input
                          size="middle"
                          placeholder="Thêm mới..."
                          ref={inputRef}
                          value={newCategoryName}
                          onChange={onNameChange}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        <Button
                          type="text"
                          icon={<PlusCircle size={16} />}
                          onClick={addItem}
                          loading={addCategoryMutation.isPending}
                          title="Thêm danh mục"
                          aria-label="Thêm danh mục"
                        />
                      </Space>
                    </>
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="expenseDate" label="Ngày thực hiện" initialValue={dayjs()}>
                <DatePicker className="w-full" size={window.innerWidth < 480 ? 'middle' : 'large'} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
            <InputNumber
              size={window.innerWidth < 480 ? 'middle' : 'large'}
              className={window.innerWidth < 480 ? 'w-full' : 'w-full h-12 text-lg font-bold'}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val!.replace(/\$\s?|(,*)/g, '')}
              prefix={<Wallet size={18} className="text-slate-600 mr-2" />}
              addonAfter="đồng"
            />
          </Form.Item>

          <Form.Item name="assetId" label="Tài sản liên quan (Tùy chọn)">
            <Select
              allowClear
              size={window.innerWidth < 480 ? 'middle' : 'large'}
              options={assets?.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Nhập ghi chú thêm..." />
          </Form.Item>

          <div className="bg-slate-50 p-3 rounded-xl mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-700">Chuyển khoản nội bộ</div>
              <Form.Item name="isTransfer" valuePropName="checked" className="mb-0">
                <Switch size="small" onChange={() => form.setFieldValue('categoryId', undefined)} />
              </Form.Item>
            </div>
          </div>

        </Form>
      </Modal>
    </div>
  );
};
