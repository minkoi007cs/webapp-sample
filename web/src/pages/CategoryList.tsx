import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Space, message, Select } from 'antd';
import { Plus, Copy, FolderTree, X, Check, Trash2 } from 'lucide-react';
import {
  buildCategoryPathLabel,
  categoryApi,
  type Category,
} from '../api/category';

export const CategoryList = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [usageSummary, setUsageSummary] = useState<{ assetCount: number; expenseCount: number } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string | undefined>(undefined);
  const [usageLoading, setUsageLoading] = useState(false);

  const { data: categories, isLoading, isError } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.findAll().then((res) => res.data),
  });

  const categoryTree = useMemo(() => {
    const source = categories ?? [];
    const nodeMap = new Map<string, Category & { key: string; children: Category[] }>();

    source.forEach((category) => {
      nodeMap.set(category.id, {
        ...category,
        key: category.id,
        children: [] as Category[],
      });
    });

    const roots: Array<Category & { key: string; children: Category[] }> = [];

    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Remove empty children arrays so antd doesn't render expand icon on leaves
    nodeMap.forEach((node) => {
      if ((node.children as Category[]).length === 0) {
        (node as any).children = undefined;
      }
    });

    return roots;
  }, [categories]);

  const descendantIds = useMemo(() => {
    if (!editingCategory || !categories) return new Set<string>();

    const childrenByParent = new Map<string, string[]>();
    categories.forEach((category) => {
      if (!category.parentId) return;
      const list = childrenByParent.get(category.parentId) ?? [];
      list.push(category.id);
      childrenByParent.set(category.parentId, list);
    });

    const ids = new Set<string>();
    const stack = [...(childrenByParent.get(editingCategory.id) ?? [])];

    while (stack.length) {
      const currentId = stack.pop()!;
      if (ids.has(currentId)) continue;
      ids.add(currentId);
      stack.push(...(childrenByParent.get(currentId) ?? []));
    }

    return ids;
  }, [categories, editingCategory]);

  const parentOptions = useMemo(() => {
    const excludedIds = new Set<string>(editingCategory ? [editingCategory.id, ...descendantIds] : [...descendantIds]);

    return (categories ?? [])
      .filter((category) =>
        !category.parentId
        && !excludedIds.has(category.id),
      )
      .map((category) => ({
        value: category.id,
        label: buildCategoryPathLabel(categories ?? [], category.id),
      }));
  }, [categories, descendantIds, editingCategory]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Category>) => categoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      message.success('Danh mục đã được tạo');
      setIsModalOpen(false);
      setCopyMode(false);
      setEditingCategory(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể tạo danh mục');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Category>) => categoryApi.update(editingCategory!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      message.success('Đã cập nhật danh mục');
      setIsModalOpen(false);
      setCopyMode(false);
      setEditingCategory(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể cập nhật danh mục');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      categoryApi.delete(id, reassignTo ? { reassignTo } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      message.success('Đã xóa danh mục');
      setReassignOpen(false);
      setUsageSummary(null);
      setReassignTargetId(undefined);
      setIsModalOpen(false);
      setEditingCategory(null);
      setCopyMode(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể xóa danh mục');
    },
  });

  const reassignCategoryOptions = useMemo(() => {
    if (!editingCategory || !categories) return [];
    return categories
      .filter((c) => c.id !== editingCategory.id && !descendantIds.has(c.id))
      .map((c) => ({
        value: c.id,
        label: buildCategoryPathLabel(categories, c.id),
      }));
  }, [categories, descendantIds, editingCategory]);

  const openDeleteCategoryFlow = async () => {
    if (!editingCategory) return;
    setUsageLoading(true);
    try {
      const usage = await categoryApi.getUsageBeforeDelete(editingCategory.id);
      if (usage.childCategoryCount > 0) {
        message.error(
          `Không thể xóa: danh mục còn ${usage.childCategoryCount} danh mục con. Hãy xóa hoặc gom các danh mục con trước.`,
        );
        return;
      }
      if (usage.assetCount + usage.expenseCount === 0) {
        Modal.confirm({
          title: 'Xác nhận xóa',
          content: `Bạn có chắc muốn xóa danh mục "${editingCategory.name}"?`,
          onOk: () => deleteMutation.mutateAsync({ id: editingCategory.id }),
        });
        return;
      }
      setUsageSummary({ assetCount: usage.assetCount, expenseCount: usage.expenseCount });
      setReassignTargetId(undefined);
      setReassignOpen(true);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không tải được thông tin để xóa');
    } finally {
      setUsageLoading(false);
    }
  };

  const confirmDeleteWithReassign = async () => {
    if (!editingCategory) {
      return Promise.reject();
    }
    if (reassignCategoryOptions.length === 0) {
      message.warning('Chưa có danh mục nào khác để chuyển. Hãy tạo thêm danh mục rồi thử lại.');
      return Promise.reject();
    }
    if (!reassignTargetId) {
      message.warning('Vui lòng chọn danh mục đích để chuyển tài sản và giao dịch');
      return Promise.reject();
    }
    await deleteMutation.mutateAsync({ id: editingCategory.id, reassignTo: reassignTargetId });
  };

  const openCategoryEditModal = (record: Category) => {
    setCopyMode(false);
    setEditingCategory(record);
    form.setFieldsValue({
      name: record.name,
      parentId: record.parentId ?? undefined,
    });
    setIsModalOpen(true);
  };

  const openCategoryCopyModal = (record: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(null);
    setCopyMode(true);
    const suggestedName = `${record.name} (bản sao)`;
    form.setFieldsValue({
      name: suggestedName,
      parentId: record.parentId ?? undefined,
    });
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: 'Tên danh mục',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Category) => (
        <Space>
          <FolderTree size={16} className={!record.parentId ? 'text-slate-700' : 'text-slate-600'} />
          <span className={!record.parentId ? 'font-semibold text-slate-800' : 'text-slate-700'}>{text}</span>
        </Space>
      ),
      sorter: (a: Category, b: Category) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 80,
      render: (_: unknown, record: Category) => (
        <Space size="middle" onClick={(e) => e.stopPropagation()}>
          <Button
            type="text"
            icon={<Copy size={16} />}
            title="Sao chép"
            aria-label="Sao chép"
            onClick={(e) => openCategoryCopyModal(record, e)}
          />
        </Space>
      ),
    },
  ];

  const isEditingGroup = editingCategory !== null && (editingCategory.children?.length ?? 0) > 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 font-display">Danh mục</h1>
        </div>
        <Button
          type="primary"
          icon={<Plus size={18} />}
          onClick={() => {
            setEditingCategory(null);
            setCopyMode(false);
            form.resetFields();
            form.setFieldsValue({
              parentId: undefined,
              name: '',
            });
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto"
          title="Thêm danh mục"
          aria-label="Thêm danh mục"
        />
      </div>

      <div className="glass-card p-4 lg:p-6 overflow-hidden">
        {isError && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">Không thể tải danh sách danh mục. Vui lòng thử lại.</div>}
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={categoryTree}
            loading={isLoading}
            rowKey="id"
            defaultExpandAllRows
            onRow={(record) => ({
              onClick: () => openCategoryEditModal(record),
              style: { cursor: 'pointer' },
            })}
            pagination={false}
            scroll={{ x: 500 }}
            size={window.innerWidth < 768 ? 'small' : 'middle'}
          />
        </div>
      </div>

      <Modal
        title={
          editingCategory
            ? 'Cập nhật danh mục'
            : copyMode
              ? 'Sao chép danh mục'
              : 'Thêm danh mục mới'
        }
        open={isModalOpen}
        forceRender
        onCancel={() => {
          setIsModalOpen(false);
          setCopyMode(false);
          setEditingCategory(null);
          form.resetFields();
          setReassignOpen(false);
          setUsageSummary(null);
          setReassignTargetId(undefined);
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        footer={[
          editingCategory ? (
            <Button
              key="delete"
              danger
              icon={<Trash2 size={18} />}
              title="Xóa danh mục"
              aria-label="Xóa danh mục"
              loading={deleteMutation.isPending || usageLoading}
              onClick={openDeleteCategoryFlow}
            />
          ) : null,
          <Button
            key="cancel"
            type="text"
            icon={<X size={18} />}
            title="Hủy"
            aria-label="Hủy"
            onClick={() => {
              setIsModalOpen(false);
              setCopyMode(false);
              setEditingCategory(null);
              form.resetFields();
              setReassignOpen(false);
              setUsageSummary(null);
              setReassignTargetId(undefined);
            }}
          />,
          <Button
            key="submit"
            type="primary"
            icon={<Check size={18} />}
            title={editingCategory ? 'Cập nhật' : 'Thêm'}
            aria-label={editingCategory ? 'Cập nhật' : 'Thêm'}
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={() => form.submit()}
          />,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const payload = {
              ...values,
              parentId: values.parentId || null,
            };
            if (editingCategory) {
              updateMutation.mutate(payload);
            } else {
              createMutation.mutate(payload);
            }
          }}
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Tên danh mục"
            rules={[{ required: true, message: 'Vui lòng nhập tên danh mục' }]}
          >
            <Input placeholder="Ví dụ: Đầu tư, Ăn uống, Lương..." />
          </Form.Item>
          <Form.Item
            name="parentId"
            label="Nhóm cha"
            extra={
              isEditingGroup
                ? 'Danh mục này có con, không thể thêm nhóm cha.'
                : 'Để trống để tạo nhóm cha. Chọn nhóm cha để tạo danh mục lá.'
            }
          >
            <Select
              allowClear
              disabled={isEditingGroup}
              placeholder={isEditingGroup ? 'Nhóm — không có cha' : 'Chọn nhóm cha (tùy chọn)'}
              options={parentOptions}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Chuyển dữ liệu rồi xóa danh mục"
        open={reassignOpen}
        onCancel={() => {
          setReassignOpen(false);
          setUsageSummary(null);
          setReassignTargetId(undefined);
        }}
        footer={[
          <Button
            key="cancel"
            type="text"
            icon={<X size={18} />}
            title="Hủy"
            aria-label="Hủy"
            onClick={() => {
              setReassignOpen(false);
              setUsageSummary(null);
              setReassignTargetId(undefined);
            }}
          />,
          <Button
            key="ok"
            type="primary"
            danger
            icon={<Check size={18} />}
            title="Chuyển dữ liệu và xóa"
            aria-label="Chuyển dữ liệu và xóa"
            loading={deleteMutation.isPending}
            onClick={() => void confirmDeleteWithReassign()}
          />,
        ]}
        destroyOnClose
      >
        {usageSummary && editingCategory ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Danh mục <strong>{editingCategory.name}</strong> đang có{' '}
              <strong>{usageSummary.assetCount}</strong> tài sản và{' '}
              <strong>{usageSummary.expenseCount}</strong> giao dịch. Chọn danh mục khác để chuyển
              toàn bộ sang, sau đó hệ thống sẽ xóa danh mục hiện tại.
            </p>
            {reassignCategoryOptions.length === 0 ? (
              <p className="text-sm text-amber-700">
                Chưa có danh mục nào khác. Hãy tạo thêm ít nhất một danh mục rồi thử lại.
              </p>
            ) : (
              <div>
                <div className="mb-2 text-sm font-medium text-slate-800">Danh mục đích</div>
                <Select
                  className="w-full"
                  placeholder="Chọn danh mục"
                  options={reassignCategoryOptions}
                  value={reassignTargetId}
                  onChange={(v) => setReassignTargetId(v)}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
