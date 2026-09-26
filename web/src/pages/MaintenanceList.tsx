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
  maintenance: 'Maintenance',
  operation: 'Operation',
  liability: 'Liability',
};

const statusLabels: Record<MaintenanceStatus, string> = {
  open: 'Pending',
  completed: 'Recorded',
  skipped: 'Skipped',
};

const getAmountLabel = (type: AssetMaintenanceType) =>
  type === 'operation' ? 'Income' : 'Cost';

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
      message.error(error?.response?.data?.message || 'Failed to create record');
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
      message.error(error?.response?.data?.message || 'Failed to update record');
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
      message.error(error?.response?.data?.message || 'Failed to record transaction');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.remove(id),
    onSuccess: () => {
      invalidateRelated();
      message.success('Record deleted successfully');
      setIsModalOpen(false);
      setEditingRow(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Failed to delete record');
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
      message.warning('Please select a scheduled date');
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
        message.success('Created and recorded transaction');
      } else {
        message.success('New record created');
      }

      invalidateRelated();
      closeModal();
      return;
    }

    if (editingRow.status === 'completed') {
      message.warning('This record is already completed.');
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
      message.success('Completed and transaction recorded');
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
      message.success('Record updated successfully');
    }

    invalidateRelated();
    closeModal();
  };

  const columns = [
    {
      title: 'Asset',
      key: 'asset',
      render: (_: unknown, row: AssetMaintenance) => row.asset?.name || row.assetId,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: AssetMaintenanceType) => {
        const color = type === 'operation' ? 'green' : type === 'liability' ? 'red' : 'orange';
        return <Tag color={color}>{typeLabels[type]}</Tag>;
      },
    },
    {
      title: 'Scheduled Date',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: MaintenanceStatus) => {
        const color = status === 'completed' ? 'green' : status === 'skipped' ? 'default' : 'blue';
        return <Tag color={color}>{statusLabels[status]}</Tag>;
      },
    },
    {
      title: 'Value',
      dataIndex: 'cost',
      key: 'cost',
      render: (cost: number | null, row: AssetMaintenance) => (
        cost != null ? formatVndAmount(cost) : (row.status === 'completed' ? '$0' : '—')
      ),
    },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string | null) => content || '—',
    },
    {
      title: 'Delete',
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
              title: 'Delete this record?',
              content: 'This action cannot be undone.',
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
          <h1 className="text-xl lg:text-2xl font-bold text-foreground font-sans flex items-center gap-2">
            <Wrench className="text-amber-600 dark:text-amber-400" size={24} />
            Asset Maintenance & Operations
          </h1>
          <p className="text-sm text-muted-foreground">Track scheduled maintenance, operational revenue, and asset liabilities</p>
        </div>
        <Button type="primary" icon={<Plus size={18} />} onClick={openCreate}>
          Add Record
        </Button>
      </div>

      <div className="glass-card p-4 lg:p-6 overflow-hidden">
        <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          <Select
            allowClear
            placeholder="Filter by asset"
            className="w-full sm:w-56"
            options={assetOptions}
            value={filters.assetId}
            onChange={(value) => setFilters({ ...filters, assetId: value || undefined })}
          />
          <Select
            allowClear
            placeholder="Record type"
            className="w-full sm:w-44"
            options={[
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'operation', label: 'Operation' },
              { value: 'liability', label: 'Liability' },
            ]}
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value || undefined })}
          />
          <Select
            allowClear
            placeholder="Status"
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
            className: 'cursor-pointer hover:bg-muted/40 transition-colors',
          })}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          scroll={{ x: 860 }}
          size={window.innerWidth < 768 ? 'small' : 'middle'}
        />
      </div>

      <Modal
        title={editingRow ? 'Edit Record' : 'Create New Record'}
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
                  title: 'Delete this record?',
                  content: 'This action cannot be undone.',
                  onOk: () => deleteMutation.mutate(editingRow.id),
                });
              }}
            >
              Delete
            </Button>
          ) : null,
          <Button key="cancel" onClick={closeModal}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => form.submit()}
            loading={createMutation.isPending || updateMutation.isPending || completeMutation.isPending}
          >
            {watchedStatus === 'completed' ? 'Save and Record' : 'Save'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={submitForm} className="mt-4">
          <Form.Item label="Operation Type" name="type" rules={[{ required: true }]}>
            <Radio.Group className="w-full">
              <Radio.Button value="maintenance" className="w-1/3 text-center">Maintenance</Radio.Button>
              <Radio.Button value="operation" className="w-1/3 text-center">Operation</Radio.Button>
              <Radio.Button value="liability" className="w-1/3 text-center">Liability</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="assetId" label="Asset" rules={[{ required: true }]} className="col-span-2">
              <Select
                disabled={Boolean(editingRow)}
                showSearch
                optionFilterProp="label"
                options={assetOptions}
                placeholder="Select asset"
              />
            </Form.Item>

            <Form.Item name="scheduledDate" label="Scheduled Date" rules={[{ required: true }]}>
              <DatePicker className="w-full" format="YYYY-MM-DD" />
            </Form.Item>

            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select
                disabled={editingRow?.status === 'completed'}
                options={[
                  { value: 'open', label: statusLabels.open },
                  { value: 'completed', label: statusLabels.completed },
                  { value: 'skipped', label: statusLabels.skipped },
                ]}
              />
            </Form.Item>

            <Form.Item name="reminderDaysBefore" label="Remind in advance (days)">
              <InputNumber min={0} max={365} className="w-full" />
            </Form.Item>

            {watchedStatus === 'completed' ? (
              <Form.Item
                name="amount"
                label={`${getAmountLabel(watchedType)} Amount`}
                rules={[{ required: true, message: `Enter ${getAmountLabel(watchedType).toLowerCase()} amount` }]}
              >
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            ) : (
              <div />
            )}

            <Form.Item name="content" label="Notes & Details" className="col-span-2" rules={[{ required: true }]}>
              <Input.TextArea
                rows={3}
                placeholder={watchedType === 'operation'
                  ? 'e.g., Vehicle rental revenue, storage lease...'
                  : watchedType === 'liability'
                    ? 'e.g., Loan interest payment, asset liability settlement...'
                    : 'e.g., Oil change, hardware repair, routine servicing...'}
              />
            </Form.Item>

            {watchedStatus === 'completed' ? (
              <Form.Item
                name="categoryId"
                label={watchedType === 'operation' ? 'Income Category' : 'Expense Category'}
                className="col-span-2"
                rules={[{ required: true, message: 'Select financial category' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={categoryOptions}
                  placeholder={watchedType === 'operation' ? 'Select income category' : 'Select expense category'}
                />
              </Form.Item>
            ) : null}
          </div>
        </Form>
      </Modal>
    </div>
  );
};
