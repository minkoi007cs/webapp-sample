import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Table,
  Tag,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2, Wrench } from 'lucide-react';
import {
  maintenanceApi,
  type AssetMaintenance,
  type AssetMaintenanceType,
  type MaintenanceStatus,
} from '../api/maintenance';
import { assetApi } from '../api/asset';
import { buildCategoryPathLabel, categoryApi } from '../api/category';
import { asArray } from '../api/client';
import { formatVndAmount } from '../utils/currency';

const typeLabels: Record<AssetMaintenanceType, string> = {
  maintenance: 'Bảo trì',
  operation: 'Khai thác',
  liability: 'Nợ',
};

const statusLabels: Record<MaintenanceStatus, string> = {
  open: 'Đang chờ',
  completed: 'Đã ghi nhận',
  skipped: 'Đã bỏ qua',
};

const getAmountLabel = (type: AssetMaintenanceType) =>
  type === 'operation' ? 'Thu nhập' : 'Chi phí';

export const MaintenanceList = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AssetMaintenance | null>(null);
  const [filters, setFilters] = useState<{ assetId?: string; status?: MaintenanceStatus; type?: AssetMaintenanceType }>({});
  const [form] = Form.useForm();

  const watchedType = (Form.useWatch('type', form) as AssetMaintenanceType | undefined) ?? 'maintenance';
  const watchedStatus = (Form.useWatch('status', form) as MaintenanceStatus | undefined) ?? 'open';

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['maintenances', filters],
    queryFn: () => maintenanceApi.findAll(filters).then((res) => res.data),
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', 'maintenance-picker'],
    queryFn: () => assetApi.findAll().then((res) => asArray(res.data)),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.findAll().then((res) => res.data),
  });

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenances'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const assetOptions = useMemo(
    () => assets.map((asset) => ({ value: asset.id, label: asset.name })),
    [assets],
  );

  const categoryOptions = useMemo(() => {
    return categories
      .map((category) => ({
        value: category.id,
        label: buildCategoryPathLabel(categories, category.id),
      }));
  }, [categories, watchedType]);

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof maintenanceApi.create>[0]) => maintenanceApi.create(payload),
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể tạo bản ghi');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof maintenanceApi.update>[1];
    }) => maintenanceApi.update(id, payload),
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể cập nhật bản ghi');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { content: string; cost: number; categoryId: string };
    }) => maintenanceApi.complete(id, payload),
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể ghi nhận giao dịch');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.remove(id),
    onSuccess: () => {
      invalidateRelated();
      message.success('Đã xóa bản ghi');
      setIsModalOpen(false);
      setEditingRow(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể xóa bản ghi');
    },
  });

  const openCreate = () => {
    setEditingRow(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'maintenance',
      status: 'open',
      scheduledDate: dayjs(),
      reminderDaysBefore: undefined,
      amount: undefined,
      categoryId: undefined,
      content: '',
    });
    setIsModalOpen(true);
  };

  const openEdit = (row: AssetMaintenance) => {
    setEditingRow(row);
    form.setFieldsValue({
      assetId: row.assetId,
      type: row.type,
      status: row.status,
      scheduledDate: dayjs(row.scheduledDate),
      reminderDaysBefore: row.reminderDaysBefore ?? undefined,
      content: row.content ?? '',
      amount: row.cost ?? undefined,
      categoryId: undefined,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRow(null);
    form.resetFields();
  };

  const submitForm = async (values: any) => {
    const scheduledDate = values.scheduledDate?.format('YYYY-MM-DD');
    if (!scheduledDate) {
      message.warning('Chọn ngày thực hiện');
      return;
    }

    const wantsCompletion = values.status === 'completed';

    if (!editingRow) {
      const createRes = await createMutation.mutateAsync({
        assetId: values.assetId,
        type: values.type,
        startDate: scheduledDate,
        reminderDaysBefore: values.reminderDaysBefore,
        content: values.content || undefined,
      });

      const createdRows = createRes.data ?? [];
      const created = createdRows[0];

      if (wantsCompletion && created) {
        await completeMutation.mutateAsync({
          id: created.id,
          payload: {
            content: values.content,
            cost: Number(values.amount),
            categoryId: values.categoryId,
          },
        });
        message.success('Đã tạo và ghi nhận giao dịch');
      } else {
        message.success('Đã tạo bản ghi mới');
      }

      invalidateRelated();
      closeModal();
      return;
    }

    if (editingRow.status === 'completed') {
      message.warning('Bản ghi đã ghi nhận xong, chỉ có thể xóa nếu cần làm lại');
      return;
    }

    if (wantsCompletion) {
      await updateMutation.mutateAsync({
        id: editingRow.id,
        payload: {
          scheduledDate,
          type: values.type,
          content: values.content,
          reminderDaysBefore: values.reminderDaysBefore ?? null,
        },
      });

      await completeMutation.mutateAsync({
        id: editingRow.id,
        payload: {
          content: values.content,
          cost: Number(values.amount),
          categoryId: values.categoryId,
        },
      });
      message.success('Đã ghi nhận hoàn tất');
    } else {
      await updateMutation.mutateAsync({
        id: editingRow.id,
        payload: {
          scheduledDate,
          type: values.type,
          status: values.status,
          content: values.content,
          reminderDaysBefore: values.reminderDaysBefore ?? null,
        },
      });
      message.success('Đã cập nhật bản ghi');
    }

    invalidateRelated();
    closeModal();
  };

  const columns = [
    {
      title: 'Tài sản',
      key: 'asset',
      render: (_: unknown, row: AssetMaintenance) => row.asset?.name || row.assetId,
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      render: (type: AssetMaintenanceType) => {
        const color = type === 'operation' ? 'green' : type === 'liability' ? 'red' : 'orange';
        return <Tag color={color}>{typeLabels[type]}</Tag>;
      },
    },
    {
      title: 'Ngày thực hiện',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: MaintenanceStatus) => {
        const color = status === 'completed' ? 'green' : status === 'skipped' ? 'default' : 'blue';
        return <Tag color={color}>{statusLabels[status]}</Tag>;
      },
    },
    {
      title: 'Giá trị',
      dataIndex: 'cost',
      key: 'cost',
      render: (cost: number | null, row: AssetMaintenance) => (
        cost != null ? formatVndAmount(cost) : (row.status === 'completed' ? '0 đồng' : '—')
      ),
    },
    {
      title: 'Nội dung',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string | null) => content || '—',
    },
    {
      title: 'Xóa',
      key: 'delete',
      width: 70,
      render: (_: unknown, row: AssetMaintenance) => (
        <Button
          type="text"
          danger
          icon={<Trash2 size={16} />}
          onClick={(event) => {
            event.stopPropagation();
            Modal.confirm({
              title: 'Xóa bản ghi này?',
              content: 'Thao tác này không hoàn tác được.',
              onOk: () => deleteMutation.mutate(row.id),
            });
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 font-display flex items-center gap-2">
            <Wrench className="text-amber-600" size={28} />
            Bảo trì khai thác và nợ
          </h1>
          <p className="text-sm text-slate-700">Theo dõi các hoạt động phát sinh chi phí hoặc thu nhập gắn với tài sản</p>
        </div>
        <Button type="primary" icon={<Plus size={18} />} onClick={openCreate}>
          Thêm bản ghi
        </Button>
      </div>

      <div className="glass-card p-4 lg:p-6 overflow-hidden">
        <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          <Select
            allowClear
            placeholder="Lọc theo tài sản"
            className="w-full sm:w-56"
            options={assetOptions}
            value={filters.assetId}
            onChange={(value) => setFilters({ ...filters, assetId: value || undefined })}
          />
          <Select
            allowClear
            placeholder="Loại bản ghi"
            className="w-full sm:w-44"
            options={[
              { value: 'maintenance', label: 'Bảo trì' },
              { value: 'operation', label: 'Khai thác' },
              { value: 'liability', label: 'Nợ' },
            ]}
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value || undefined })}
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            className="w-full sm:w-44"
            options={[
              { value: 'open', label: statusLabels.open },
              { value: 'completed', label: statusLabels.completed },
              { value: 'skipped', label: statusLabels.skipped },
            ]}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value || undefined })}
          />
        </div>

        <Table
          rowKey="id"
          loading={isPending}
          dataSource={rows}
          columns={columns}
          onRow={(row) => ({
            onClick: () => openEdit(row),
            className: 'cursor-pointer hover:bg-slate-50 transition-colors',
          })}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          scroll={{ x: 860 }}
          size={window.innerWidth < 768 ? 'small' : 'middle'}
        />
      </div>

      <Modal
        title={editingRow ? 'Cập nhật bản ghi' : 'Tạo bản ghi mới'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending || completeMutation.isPending}
        width={620}
        footer={[
          editingRow ? (
            <Button
              key="delete"
              danger
              onClick={() => {
                Modal.confirm({
                  title: 'Xóa bản ghi này?',
                  content: 'Thao tác này không hoàn tác được.',
                  onOk: () => deleteMutation.mutate(editingRow.id),
                });
              }}
            >
              Xóa
            </Button>
          ) : null,
          <Button key="cancel" onClick={closeModal}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => form.submit()}
            loading={createMutation.isPending || updateMutation.isPending || completeMutation.isPending}
          >
            {watchedStatus === 'completed' ? 'Lưu và ghi nhận' : 'Lưu'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={submitForm} className="mt-4">
          <Form.Item label="Loại nghiệp vụ" name="type" rules={[{ required: true }]}>
            <Radio.Group className="w-full">
              <Radio.Button value="maintenance" className="w-1/3 text-center">Bảo trì</Radio.Button>
              <Radio.Button value="operation" className="w-1/3 text-center">Khai thác</Radio.Button>
              <Radio.Button value="liability" className="w-1/3 text-center">Nợ</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="assetId" label="Tài sản" rules={[{ required: true }]} className="col-span-2">
              <Select
                disabled={Boolean(editingRow)}
                showSearch
                optionFilterProp="label"
                options={assetOptions}
                placeholder="Chọn tài sản"
              />
            </Form.Item>

            <Form.Item name="scheduledDate" label="Ngày thực hiện" rules={[{ required: true }]}>
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
              <Select
                disabled={editingRow?.status === 'completed'}
                options={[
                  { value: 'open', label: statusLabels.open },
                  { value: 'completed', label: statusLabels.completed },
                  { value: 'skipped', label: statusLabels.skipped },
                ]}
              />
            </Form.Item>

            <Form.Item name="reminderDaysBefore" label="Nhắc trước (ngày)">
              <InputNumber min={0} max={365} className="w-full" />
            </Form.Item>

            {watchedStatus === 'completed' ? (
              <Form.Item
                name="amount"
                label={`${getAmountLabel(watchedType)} (đồng)`}
                rules={[{ required: true, message: `Nhập ${getAmountLabel(watchedType).toLowerCase()}` }]}
              >
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            ) : (
              <div />
            )}

            <Form.Item name="content" label="Nội dung" className="col-span-2" rules={[{ required: true }]}>
              <Input.TextArea
                rows={3}
                placeholder={watchedType === 'operation'
                  ? 'Ví dụ: Cho thuê xe, khai thác nhà kho...'
                  : watchedType === 'liability'
                    ? 'Ví dụ: Trả lãi, xử lý khoản nợ liên quan tài sản...'
                    : 'Ví dụ: Thay dầu, sửa máy, vệ sinh định kỳ...'}
              />
            </Form.Item>

            {watchedStatus === 'completed' ? (
              <Form.Item
                name="categoryId"
                label={watchedType === 'operation' ? 'Danh mục thu nhập' : 'Danh mục chi phí'}
                className="col-span-2"
                rules={[{ required: true, message: 'Chọn danh mục tài chính' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={categoryOptions}
                  placeholder={watchedType === 'operation' ? 'Chọn danh mục thu nhập' : 'Chọn danh mục chi phí'}
                />
              </Form.Item>
            ) : null}
          </div>
        </Form>
      </Modal>
    </div>
  );
};
