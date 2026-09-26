import { useMemo, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Col, Divider, Row, Select, Table, Tag, Typography, Button, Modal, Form, Input, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Building2, ShieldCheck, Users, Plus, UserPlus, Pencil, Trash2, UserMinus } from 'lucide-react';
import { adminApi, type AdminGroup, type AdminUser } from '../api/admin';

const ADMIN_USER_CHUNK = 8;
const ADMIN_MEMBER_CHUNK = 10;

type GroupMemberRow = {
  key: string;
  groupId: string;
  groupName: string;
  groupStatus: 'ACTIVE' | 'INACTIVE';
  userId: string;
  fullName: string | null;
  email: string;
  systemRole: 'USER' | 'APP_ADMIN';
  role: 'GROUP_ADMIN' | 'MEMBER';
};

export const AdminPanel = () => {
  const queryClient = useQueryClient();
  const [userVisibleCount, setUserVisibleCount] = useState(ADMIN_USER_CHUNK);
  const [memberVisibleCount, setMemberVisibleCount] = useState(ADMIN_MEMBER_CHUNK);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [createGroupForm] = Form.useForm();
  const [addMemberForm] = Form.useForm();
  const [editGroupForm] = Form.useForm();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((res) => res.data),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers().then((res) => res.data),
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => adminApi.getGroups().then((res) => res.data),
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: { name: string; adminUserId: string }) => adminApi.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('Tạo nhóm mới thành công');
      setIsCreateGroupModalOpen(false);
      createGroupForm.resetFields();
    },
    onError: () => message.error('Không thể tạo nhóm'),
  });

  const editGroupMutation = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      adminApi.updateGroupProfile(groupId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      message.success('Cập nhật tên nhóm thành công');
      setEditingGroup(null);
      editGroupForm.resetFields();
    },
    onError: () => message.error('Không thể cập nhật tên nhóm'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => adminApi.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('Xóa nhóm thành công');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể xóa nhóm');
    },
  });

  const addGroupMemberMutation = useMutation({
    mutationFn: ({ groupId, userId, role }: { groupId: string; userId: string; role: 'GROUP_ADMIN' | 'MEMBER' }) =>
      adminApi.addGroupMember(groupId, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('Đã thêm thành viên vào nhóm thành công');
      setIsAddMemberModalOpen(false);
      addMemberForm.resetFields();
    },
    onError: () => message.error('Không thể thêm thành viên vào nhóm'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      adminApi.removeGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('Đã xóa thành viên khỏi nhóm');
    },
    onError: () => message.error('Không thể xóa thành viên khỏi nhóm'),
  });

  const updateSystemRoleMutation = useMutation({
    mutationFn: ({ userId, systemRole }: { userId: string; systemRole: 'USER' | 'APP_ADMIN' }) =>
      adminApi.updateSystemRole(userId, systemRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      message.success('Cập nhật vai trò hệ thống thành công');
    },
    onError: () => message.error('Không thể cập nhật vai trò hệ thống'),
  });

  const updateGroupStatusMutation = useMutation({
    mutationFn: ({ groupId, status }: { groupId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      adminApi.updateGroupStatus(groupId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      message.success('Cập nhật trạng thái nhóm thành công');
    },
    onError: () => message.error('Không thể cập nhật trạng thái nhóm'),
  });

  const updateGroupRoleMutation = useMutation({
    mutationFn: ({ groupId, userId, role }: { groupId: string; userId: string; role: 'GROUP_ADMIN' | 'MEMBER' }) =>
      adminApi.updateGroupMemberRole(groupId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success('Cập nhật vai trò trong nhóm thành công');
    },
    onError: () => message.error('Không thể cập nhật vai trò trong nhóm'),
  });

  const memberRows = useMemo<GroupMemberRow[]>(() => (
    (groups ?? []).flatMap((group) =>
      group.members.map((member) => ({
        key: `${group.id}:${member.id}`,
        groupId: group.id,
        groupName: group.name,
        groupStatus: group.status,
        userId: member.id,
        fullName: member.fullName,
        email: member.email,
        systemRole: member.systemRole,
        role: member.role === 'GROUP_ADMIN' || (member.role as string) === 'FAMILY_ADMIN' ? 'GROUP_ADMIN' : 'MEMBER',
      })),
    )
  ), [groups]);

  useEffect(() => {
    setUserVisibleCount(ADMIN_USER_CHUNK);
  }, [users]);

  useEffect(() => {
    setMemberVisibleCount(ADMIN_MEMBER_CHUNK);
  }, [memberRows]);

  const usersTableSlice = useMemo(
    () => (users ?? []).slice(0, userVisibleCount),
    [users, userVisibleCount],
  );

  const memberRowsSlice = useMemo(
    () => memberRows.slice(0, memberVisibleCount),
    [memberRows, memberVisibleCount],
  );

  const onAdminUserTableScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      const total = users?.length ?? 0;
      if (nearBottom && userVisibleCount < total) {
        setUserVisibleCount((c) => Math.min(c + ADMIN_USER_CHUNK, total));
      }
    },
    [users?.length, userVisibleCount],
  );

  const onAdminMemberTableScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      const total = memberRows.length;
      if (nearBottom && memberVisibleCount < total) {
        setMemberVisibleCount((c) => Math.min(c + ADMIN_MEMBER_CHUNK, total));
      }
    },
    [memberRows.length, memberVisibleCount],
  );

  const userColumns: ColumnsType<AdminUser> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-foreground">{record.fullName || 'Chưa đặt tên'}</div>
          <div className="text-xs text-muted-foreground">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Vai trò hệ thống',
      dataIndex: 'systemRole',
      key: 'systemRole',
      render: (value: 'USER' | 'APP_ADMIN', record) => (
        <Select
          size="small"
          value={value}
          className="w-40"
          loading={updateSystemRoleMutation.isPending}
          onChange={(nextValue) => updateSystemRoleMutation.mutate({ userId: record.id, systemRole: nextValue })}
          options={[
            { value: 'USER', label: 'Người dùng thường' },
            { value: 'APP_ADMIN', label: 'Quản trị hệ thống' },
          ]}
        />
      ),
    },
    {
      title: 'Nhóm tham gia',
      key: 'memberships',
      render: (_, record) => (
        <div className="flex flex-wrap gap-1.5">
          {record.memberships.length > 0
            ? record.memberships.map((membership) => (
              <Tag key={`${record.id}-${membership.groupId || membership.familyId}`}>
                {membership.groupName || membership.familyName} · {membership.role === 'GROUP_ADMIN' || (membership.role as string) === 'FAMILY_ADMIN' ? 'Admin' : 'Member'}
              </Tag>
            ))
            : <span className="text-xs text-muted-foreground">Chưa tham gia nhóm nào</span>}
        </div>
      ),
    },
  ];

  const memberColumns: ColumnsType<GroupMemberRow> = [
    {
      title: 'Nhóm',
      key: 'group',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-foreground">{record.groupName}</div>
          <div className="text-xs text-muted-foreground">{record.groupStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}</div>
        </div>
      ),
    },
    {
      title: 'Thành viên',
      key: 'member',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-foreground">{record.fullName || 'Chưa đặt tên'}</div>
          <div className="text-xs text-muted-foreground">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Vai trò hệ thống',
      dataIndex: 'systemRole',
      key: 'systemRole',
      render: (value: 'USER' | 'APP_ADMIN') => (
        <Tag color={value === 'APP_ADMIN' ? 'purple' : 'default'}>
          {value === 'APP_ADMIN' ? 'APP_ADMIN' : 'USER'}
        </Tag>
      ),
    },
    {
      title: 'Vai trò trong nhóm',
      dataIndex: 'role',
      key: 'role',
      render: (value: 'GROUP_ADMIN' | 'MEMBER', record) => (
        <Select
          size="small"
          value={value}
          className="w-36"
          loading={updateGroupRoleMutation.isPending}
          onChange={(nextValue) => updateGroupRoleMutation.mutate({
            groupId: record.groupId,
            userId: record.userId,
            role: nextValue,
          })}
          options={[
            { value: 'GROUP_ADMIN', label: 'Quản trị nhóm' },
            { value: 'MEMBER', label: 'Thành viên' },
          ]}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Xóa thành viên khỏi nhóm"
          description={`Bạn có chắc chắn muốn xóa "${record.fullName || record.email}" khỏi nhóm "${record.groupName}"?`}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true, loading: removeMemberMutation.isPending }}
          onConfirm={() => removeMemberMutation.mutate({ groupId: record.groupId, userId: record.userId })}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<UserMinus size={14} />}
            title="Xóa khỏi nhóm"
          >
            Xóa
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground font-sans">Quản Trị Hệ Thống</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý toàn bộ nhóm làm việc, thành viên và phân quyền quản trị viên hệ thống (APP_ADMIN).
        </p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="glass-card" loading={statsLoading}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Tổng người dùng</div>
                <div className="text-2xl font-bold text-foreground">{stats?.totalUsers ?? 0}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-card" loading={statsLoading}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
                <Building2 size={18} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Tổng số nhóm</div>
                <div className="text-2xl font-bold text-foreground">{stats?.totalGroups ?? stats?.totalFamilies ?? 0}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-card" loading={statsLoading}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <Users size={18} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Tư cách thành viên</div>
                <div className="text-2xl font-bold text-foreground">{stats?.totalMemberships ?? 0}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="glass-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Typography.Title level={4} className="!mb-1">Phân quyền hệ thống</Typography.Title>
            <Typography.Text type="secondary">Chỉ tài khoản APP_ADMIN mới có thể cấp hoặc thu hồi quyền quản trị hệ thống.</Typography.Text>
          </div>
        </div>
        <Table
          rowKey="id"
          columns={userColumns}
          dataSource={usersTableSlice}
          loading={usersLoading}
          pagination={false}
          onScroll={onAdminUserTableScroll}
          scroll={{ x: 760, y: 360 }}
          size="small"
        />
      </Card>

      <Card className="glass-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography.Title level={4} className="!mb-1">Danh sách nhóm và thành viên</Typography.Title>
            <Typography.Text type="secondary">Quản lý các nhóm, chỉnh sửa tên, phân bổ thành viên và trạng thái hoạt động.</Typography.Text>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setIsCreateGroupModalOpen(true)}
            >
              Tạo nhóm mới
            </Button>
            <Button
              icon={<UserPlus size={14} />}
              onClick={() => setIsAddMemberModalOpen(true)}
            >
              Gán thành viên
            </Button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(groups ?? []).map((group: AdminGroup) => (
            <div key={group.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{group.name}</p>
                  <p className="text-xs text-muted-foreground">{group.members.length} thành viên</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    size="small"
                    value={group.status}
                    className="w-32"
                    loading={updateGroupStatusMutation.isPending}
                    onChange={(status) => updateGroupStatusMutation.mutate({ groupId: group.id, status })}
                    options={[
                      { value: 'ACTIVE', label: 'Hoạt động' },
                      { value: 'INACTIVE', label: 'Tạm dừng' },
                    ]}
                  />
                  <Button
                    size="small"
                    icon={<Pencil size={13} />}
                    onClick={() => {
                      setEditingGroup(group);
                      editGroupForm.setFieldsValue({ name: group.name });
                    }}
                    title="Đổi tên nhóm"
                  />
                  <Popconfirm
                    title="Xóa nhóm"
                    description={
                      group.members.length > 0
                        ? `Nhóm đang có ${group.members.length} thành viên. Vui lòng xóa hết thành viên trước khi xóa nhóm.`
                        : `Bạn có chắc chắn muốn xóa vĩnh viễn nhóm "${group.name}"?`
                    }
                    okText={group.members.length > 0 ? 'Đã hiểu' : 'Xóa vĩnh viễn'}
                    cancelText="Hủy"
                    okButtonProps={{
                      danger: group.members.length === 0,
                      disabled: group.members.length > 0,
                      loading: deleteGroupMutation.isPending,
                    }}
                    onConfirm={() => {
                      if (group.members.length === 0) {
                        deleteGroupMutation.mutate(group.id);
                      }
                    }}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      title="Xóa nhóm"
                    />
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Divider />

        <Table
          rowKey="key"
          columns={memberColumns}
          dataSource={memberRowsSlice}
          loading={groupsLoading}
          pagination={false}
          onScroll={onAdminMemberTableScroll}
          scroll={{ x: 860, y: 400 }}
          size="small"
        />
      </Card>

      {/* Modal Create Group */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Building2 size={18} className="text-primary" />
            <span>Tạo nhóm làm việc mới</span>
          </div>
        }
        open={isCreateGroupModalOpen}
        onCancel={() => setIsCreateGroupModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <p className="text-xs text-muted-foreground mb-4">
          Tạo nhóm làm việc mới và chỉ định Quản trị viên nhóm (GROUP_ADMIN) ban đầu.
        </p>
        <Form
          form={createGroupForm}
          layout="vertical"
          onFinish={(values) => createGroupMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Tên nhóm"
            rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}
          >
            <Input placeholder="Ví dụ: Nhóm Thiết Kế Mẫu A" size="large" />
          </Form.Item>
          <Form.Item
            name="adminUserId"
            label="Quản trị viên ban đầu"
            tooltip="Người dùng được chọn sẽ có vai trò Quản trị nhóm (GROUP_ADMIN)"
            rules={[{ required: true, message: 'Vui lòng chọn quản trị viên ban đầu' }]}
          >
            <Select
              placeholder="Chọn người dùng làm Quản trị nhóm"
              size="large"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(users ?? []).map((u) => ({
                value: u.id,
                label: `${u.fullName || 'Chưa đặt tên'} (${u.email})`,
              }))}
            />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsCreateGroupModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createGroupMutation.isPending}
            >
              Tạo nhóm
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Assign Member */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserPlus size={18} className="text-primary" />
            <span>Gán người dùng vào nhóm</span>
          </div>
        }
        open={isAddMemberModalOpen}
        onCancel={() => setIsAddMemberModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <p className="text-xs text-muted-foreground mb-4">
          Chỉ định trực tiếp người dùng vào nhóm với vai trò xác định.
        </p>
        <Form
          form={addMemberForm}
          layout="vertical"
          initialValues={{ role: 'MEMBER' }}
          onFinish={(values) => addGroupMemberMutation.mutate(values)}
        >
          <Form.Item
            name="groupId"
            label="Chọn nhóm"
            rules={[{ required: true, message: 'Vui lòng chọn nhóm' }]}
          >
            <Select
              placeholder="Chọn nhóm"
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(groups ?? []).map((g) => ({
                value: g.id,
                label: g.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="userId"
            label="Chọn người dùng"
            rules={[{ required: true, message: 'Vui lòng chọn người dùng' }]}
          >
            <Select
              placeholder="Chọn người dùng"
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(users ?? []).map((u) => ({
                value: u.id,
                label: `${u.fullName || 'Chưa đặt tên'} (${u.email})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="role"
            label="Vai trò trong nhóm"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select
              size="large"
              options={[
                { value: 'GROUP_ADMIN', label: 'Quản trị nhóm' },
                { value: 'MEMBER', label: 'Thành viên' },
              ]}
            />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsAddMemberModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={addGroupMemberMutation.isPending}
            >
              Gán thành viên
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Edit Group Name */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Pencil size={18} className="text-primary" />
            <span>Đổi tên nhóm làm việc</span>
          </div>
        }
        open={editingGroup !== null}
        onCancel={() => setEditingGroup(null)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form
          form={editGroupForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingGroup) {
              editGroupMutation.mutate({ groupId: editingGroup.id, name: values.name });
            }
          }}
        >
          <Form.Item
            name="name"
            label="Tên nhóm"
            rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}
          >
            <Input placeholder="Nhập tên nhóm mới" size="large" />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setEditingGroup(null)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editGroupMutation.isPending}
            >
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
