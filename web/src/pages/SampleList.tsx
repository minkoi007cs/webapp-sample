import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Space, Card } from 'antd';
import { Plus, Edit2, Trash2, Search, Package } from 'lucide-react';
import { sampleApi, type Sample, type CreateSampleDto, type SampleStatus } from '../api/sample';
import { categoryApi } from '../api/category';
import { useSession } from '../components/auth/SessionProvider';
import dayjs from 'dayjs';

const statusConfig: Record<SampleStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Có sẵn', color: 'green' },
  IN_USE: { label: 'Đang sử dụng', color: 'blue' },
  MAINTENANCE: { label: 'Bảo quản', color: 'orange' },
  ARCHIVED: { label: 'Lưu trữ', color: 'default' },
  DISPOSED: { label: 'Đã hủy', color: 'red' },
};

export const SampleList = () => {
  const queryClient = useQueryClient();
  const { canAccess } = useSession();
  const canEdit = canAccess('SAMPLE', 'update') || canAccess('SAMPLE', 'create') || canAccess('ASSET', 'update') || canAccess('ASSET', 'create');
  const canDelete = canAccess('SAMPLE', 'delete') || canAccess('ASSET', 'delete');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: samplesData, isLoading } = useQuery({
    queryKey: ['samples', search, statusFilter, categoryFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (search) params.search = search;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.categoryId = categoryFilter;
      const res = await sampleApi.findAll(params);
      return Array.isArray(res.data) ? res.data : (res.data as any).data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoryApi.findAll();
      return res.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateSampleDto) => sampleApi.create(data),
    onSuccess: () => {
      message.success('Tạo mẫu mới thành công');
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Không thể tạo mẫu');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSampleDto> }) =>
      sampleApi.update(id, data),
    onSuccess: () => {
      message.success('Cập nhật mẫu thành công');
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsModalOpen(false);
      setEditingSample(null);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Không thể cập nhật mẫu');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sampleApi.delete(id),
    onSuccess: () => {
      message.success('Đã xóa mẫu thành công');
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Không thể xóa mẫu');
    },
  });

  const handleOpenCreate = () => {
    setEditingSample(null);
    form.resetFields();
    form.setFieldsValue({ status: 'AVAILABLE' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sample: Sample) => {
    setEditingSample(sample);
    form.setFieldsValue({
      name: sample.name,
      code: sample.code,
      type: sample.type,
      status: sample.status,
      categoryId: sample.categoryId,
      description: sample.description,
      imageUrl: sample.imageUrl,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingSample) {
      await updateMutation.mutateAsync({ id: editingSample.id, data: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = [
    {
      title: 'Mẫu (Sample)',
      key: 'name',
      render: (_: any, record: Sample) => (
        <div className="flex items-center gap-3">
          {record.imageUrl ? (
            <img
              src={record.imageUrl}
              alt={record.name}
              className="w-10 h-10 rounded-lg object-cover border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
              <Package size={20} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-foreground text-sm truncate">{record.name}</div>
            {record.code && (
              <span className="text-xs text-muted-foreground font-mono">Mã: {record.code}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Phân loại',
      key: 'category',
      render: (_: any, record: Sample) => (
        <span className="text-sm text-foreground">
          {record.category?.name || <span className="text-muted-foreground italic">Chưa phân loại</span>}
        </span>
      ),
    },
    {
      title: 'Loại mẫu',
      dataIndex: 'type',
      key: 'type',
      render: (type?: string) => type || <span className="text-muted-foreground">—</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: SampleStatus) => {
        const conf = statusConfig[status] || { label: status, color: 'default' };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc?: string) => (
        <span className="text-xs text-muted-foreground">{desc || '—'}</span>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: any, record: Sample) => (
        <Space size="small">
          {canEdit && (
            <Button
              type="text"
              size="small"
              icon={<Edit2 size={15} />}
              onClick={() => handleOpenEdit(record)}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Xác nhận xóa mẫu"
              description="Bạn có chắc chắn muốn xóa mẫu này không?"
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger size="small" icon={<Trash2 size={15} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Danh sách Mẫu (Samples)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý và theo dõi toàn bộ danh mục mẫu trong nhóm
          </p>
        </div>
        {canEdit && (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5"
          >
            Thêm Mẫu Mới
          </Button>
        )}
      </div>

      <Card className="shadow-xs border-border" bodyStyle={{ padding: '16px' }}>
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <Input
              placeholder="Tìm theo tên hoặc mã..."
              prefix={<Search size={16} className="text-muted-foreground" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              className="w-full sm:w-64"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-36"
              options={[
                { label: 'Tất cả trạng thái', value: 'ALL' },
                { label: 'Có sẵn', value: 'AVAILABLE' },
                { label: 'Đang sử dụng', value: 'IN_USE' },
                { label: 'Bảo quản', value: 'MAINTENANCE' },
                { label: 'Lưu trữ', value: 'ARCHIVED' },
                { label: 'Đã hủy', value: 'DISPOSED' },
              ]}
            />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-44"
              options={[
                { label: 'Tất cả phân loại', value: 'ALL' },
                ...categories.map((c) => ({ label: c.name, value: c.id })),
              ]}
            />
          </div>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={samplesData || []}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: 'Chưa có mẫu nào trong nhóm' }}
        />
      </Card>

      <Modal
        title={editingSample ? 'Chỉnh sửa Mẫu' : 'Thêm Mẫu Mới'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingSample(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Form.Item
            name="name"
            label="Tên mẫu"
            rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}
          >
            <Input placeholder="Ví dụ: Mẫu vải A-102" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="code" label="Mã mẫu">
              <Input placeholder="Ví dụ: SMP-001" />
            </Form.Item>
            <Form.Item name="type" label="Loại mẫu">
              <Input placeholder="Ví dụ: Vải sợi, Phụ kiện..." />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="categoryId" label="Danh mục / Phân loại">
              <Select
                placeholder="Chọn phân loại"
                allowClear
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" initialValue="AVAILABLE">
              <Select
                options={[
                  { label: 'Có sẵn', value: 'AVAILABLE' },
                  { label: 'Đang sử dụng', value: 'IN_USE' },
                  { label: 'Bảo quản', value: 'MAINTENANCE' },
                  { label: 'Lưu trữ', value: 'ARCHIVED' },
                  { label: 'Đã hủy', value: 'DISPOSED' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item name="imageUrl" label="Link hình ảnh">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="description" label="Ghi chú / Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả chi tiết về mẫu..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-5">
            <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingSample ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
