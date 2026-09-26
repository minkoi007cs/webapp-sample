import { useMemo, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Col, Divider, Row, Select, Table, Tag, Typography, Button, Modal, Form, Input, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Building2, ShieldCheck, Users, Plus, UserPlus, Pencil, Trash2, UserMinus } from 'lucide-react';
import { adminApi, type AdminFamily, type AdminUser } from '../api/admin';

const ADMIN_USER_CHUNK = 8;
const ADMIN_MEMBER_CHUNK = 10;

type FamilyMemberRow = {
  key: string;
  familyId: string;
  familyName: string;
  familyStatus: 'ACTIVE' | 'INACTIVE';
  userId: string;
  fullName: string | null;
  email: string;
  systemRole: 'USER' | 'APP_ADMIN';
  role: 'FAMILY_ADMIN' | 'MEMBER';
};

export const AdminPanel = () => {
  const queryClient = useQueryClient();
  const [userVisibleCount, setUserVisibleCount] = useState(ADMIN_USER_CHUNK);
  const [memberVisibleCount, setMemberVisibleCount] = useState(ADMIN_MEMBER_CHUNK);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<AdminFamily | null>(null);
  const [createFamilyForm] = Form.useForm();
  const [addMemberForm] = Form.useForm();
  const [editFamilyForm] = Form.useForm();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((res) => res.data),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers().then((res) => res.data),
  });

  const { data: families, isLoading: familiesLoading } = useQuery({
    queryKey: ['admin-families'],
    queryFn: () => adminApi.getFamilies().then((res) => res.data),
  });

  const createFamilyMutation = useMutation({
    mutationFn: (data: { name: string; adminUserId: string }) => adminApi.createFamily(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('New workspace created successfully');
      setIsCreateFamilyModalOpen(false);
      createFamilyForm.resetFields();
    },
    onError: () => message.error('Failed to create workspace'),
  });

  const editFamilyMutation = useMutation({
    mutationFn: ({ familyId, name }: { familyId: string; name: string }) =>
      adminApi.updateFamilyProfile(familyId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      message.success('Workspace name updated');
      setEditingFamily(null);
      editFamilyForm.resetFields();
    },
    onError: () => message.error('Failed to update workspace name'),
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: (familyId: string) => adminApi.deleteFamily(familyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('Workspace deleted successfully');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Failed to delete workspace');
    },
  });

  const addFamilyMemberMutation = useMutation({
    mutationFn: ({ familyId, userId, role }: { familyId: string; userId: string; role: 'FAMILY_ADMIN' | 'MEMBER' }) =>
      adminApi.addFamilyMember(familyId, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('User assigned to workspace successfully');
      setIsAddMemberModalOpen(false);
      addMemberForm.resetFields();
    },
    onError: () => message.error('Failed to assign user to workspace'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ familyId, userId }: { familyId: string; userId: string }) =>
      adminApi.removeFamilyMember(familyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      message.success('Member removed from workspace');
    },
    onError: () => message.error('Failed to remove member from workspace'),
  });

  const updateSystemRoleMutation = useMutation({
    mutationFn: ({ userId, systemRole }: { userId: string; systemRole: 'USER' | 'APP_ADMIN' }) =>
      adminApi.updateSystemRole(userId, systemRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      message.success('System role updated successfully');
    },
    onError: () => message.error('Failed to update system role'),
  });

  const updateFamilyStatusMutation = useMutation({
    mutationFn: ({ familyId, status }: { familyId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      adminApi.updateFamilyStatus(familyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      message.success('Workspace status updated');
    },
    onError: () => message.error('Failed to update workspace status'),
  });

  const updateFamilyRoleMutation = useMutation({
    mutationFn: ({ familyId, userId, role }: { familyId: string; userId: string; role: 'FAMILY_ADMIN' | 'MEMBER' }) =>
      adminApi.updateFamilyMemberRole(familyId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-families'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success('Workspace role updated');
    },
    onError: () => message.error('Failed to update workspace role'),
  });

  const memberRows = useMemo<FamilyMemberRow[]>(() => (
    (families ?? []).flatMap((family) =>
      family.members.map((member) => ({
        key: `${family.id}:${member.id}`,
        familyId: family.id,
        familyName: family.name,
        familyStatus: family.status,
        userId: member.id,
        fullName: member.fullName,
        email: member.email,
        systemRole: member.systemRole,
        role: member.role,
      })),
    )
  ), [families]);

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
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-foreground">{record.fullName || 'Unnamed'}</div>
          <div className="text-xs text-muted-foreground">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'System Role',
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
            { value: 'USER', label: 'Standard User' },
            { value: 'APP_ADMIN', label: 'System Admin' },
          ]}
        />
      ),
    },
    {
      title: 'Workspaces Joined',
      key: 'memberships',
      render: (_, record) => (
        <div className="flex flex-wrap gap-1.5">
          {record.memberships.length > 0
            ? record.memberships.map((membership) => (
              <Tag key={`${record.id}-${membership.familyId}`}>
                {membership.familyName} · {membership.role === 'FAMILY_ADMIN' ? 'Admin' : 'Member'}
              </Tag>
            ))
            : <span className="text-xs text-muted-foreground">No active workspaces</span>}
        </div>
      ),
    },
  ];

  const memberColumns: ColumnsType<FamilyMemberRow> = [
    {
      title: 'Workspace',
      key: 'family',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-foreground">{record.familyName}</div>
          <div className="text-xs text-muted-foreground">{record.familyStatus === 'ACTIVE' ? 'Active' : 'Inactive'}</div>
        </div>
      ),
    },
    {
      title: 'Member',
      key: 'member',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-foreground">{record.fullName || 'Unnamed'}</div>
          <div className="text-xs text-muted-foreground">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'System Role',
      dataIndex: 'systemRole',
      key: 'systemRole',
      render: (value: 'USER' | 'APP_ADMIN') => (
        <Tag color={value === 'APP_ADMIN' ? 'purple' : 'default'}>
          {value === 'APP_ADMIN' ? 'APP_ADMIN' : 'USER'}
        </Tag>
      ),
    },
    {
      title: 'Workspace Role',
      dataIndex: 'role',
      key: 'role',
      render: (value: 'FAMILY_ADMIN' | 'MEMBER', record) => (
        <Select
          size="small"
          value={value}
          className="w-36"
          loading={updateFamilyRoleMutation.isPending}
          onChange={(nextValue) => updateFamilyRoleMutation.mutate({
            familyId: record.familyId,
            userId: record.userId,
            role: nextValue,
          })}
          options={[
            { value: 'FAMILY_ADMIN', label: 'Workspace Admin' },
            { value: 'MEMBER', label: 'Member' },
          ]}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Remove Member from Workspace"
          description={`Are you sure you want to remove "${record.fullName || record.email}" from "${record.familyName}"?`}
          okText="Remove"
          cancelText="Cancel"
          okButtonProps={{ danger: true, loading: removeMemberMutation.isPending }}
          onConfirm={() => removeMemberMutation.mutate({ familyId: record.familyId, userId: record.userId })}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<UserMinus size={14} />}
            title="Remove from workspace"
          >
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground font-sans">System Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage system workspaces, edit configurations, assign members, and manage APP_ADMIN privileges.
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Users</div>
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Workspaces</div>
                <div className="text-2xl font-bold text-foreground">{stats?.totalFamilies ?? 0}</div>
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Active Memberships</div>
                <div className="text-2xl font-bold text-foreground">{stats?.totalMemberships ?? 0}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="glass-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Typography.Title level={4} className="!mb-1">System Permissions</Typography.Title>
            <Typography.Text type="secondary">Only APP_ADMIN accounts can grant or revoke application-level administrative privileges.</Typography.Text>
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
            <Typography.Title level={4} className="!mb-1">Workspaces and Members</Typography.Title>
            <Typography.Text type="secondary">Manage workspaces, modify names, assign members, and manage workspace statuses.</Typography.Text>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setIsCreateFamilyModalOpen(true)}
            >
              Create Workspace
            </Button>
            <Button
              icon={<UserPlus size={14} />}
              onClick={() => setIsAddMemberModalOpen(true)}
            >
              Assign Member
            </Button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(families ?? []).map((family: AdminFamily) => (
            <div key={family.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{family.name}</p>
                  <p className="text-xs text-muted-foreground">{family.members.length} members</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    size="small"
                    value={family.status}
                    className="w-32"
                    loading={updateFamilyStatusMutation.isPending}
                    onChange={(status) => updateFamilyStatusMutation.mutate({ familyId: family.id, status })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                  />
                  <Button
                    size="small"
                    icon={<Pencil size={13} />}
                    onClick={() => {
                      setEditingFamily(family);
                      editFamilyForm.setFieldsValue({ name: family.name });
                    }}
                    title="Edit Workspace Name"
                  />
                  <Popconfirm
                    title="Delete Workspace"
                    description={
                      family.members.length > 0
                        ? `Workspace currently has ${family.members.length} members. Remove all members first before deleting.`
                        : `Are you sure you want to permanently delete "${family.name}"?`
                    }
                    okText={family.members.length > 0 ? 'Understood' : 'Delete Permanently'}
                    cancelText="Cancel"
                    okButtonProps={{
                      danger: family.members.length === 0,
                      disabled: family.members.length > 0,
                      loading: deleteFamilyMutation.isPending,
                    }}
                    onConfirm={() => {
                      if (family.members.length === 0) {
                        deleteFamilyMutation.mutate(family.id);
                      }
                    }}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      title="Delete Workspace"
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
          loading={familiesLoading}
          pagination={false}
          onScroll={onAdminMemberTableScroll}
          scroll={{ x: 860, y: 400 }}
          size="small"
        />
      </Card>

      {/* Modal Create Family */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Building2 size={18} className="text-primary" />
            <span>Create New Workspace</span>
          </div>
        }
        open={isCreateFamilyModalOpen}
        onCancel={() => setIsCreateFamilyModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <p className="text-xs text-muted-foreground mb-4">
          Create a new workspace and assign an initial Workspace Administrator (FAMILY_ADMIN).
        </p>
        <Form
          form={createFamilyForm}
          layout="vertical"
          onFinish={(values) => createFamilyMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Workspace Name"
            rules={[{ required: true, message: 'Please enter workspace name' }]}
          >
            <Input placeholder="e.g., Smith Family Workspace" size="large" />
          </Form.Item>
          <Form.Item
            name="adminUserId"
            label="Initial Administrator"
            tooltip="Selected user will be designated as Workspace Admin (FAMILY_ADMIN)"
            rules={[{ required: true, message: 'Please select an initial administrator' }]}
          >
            <Select
              placeholder="Select user as Workspace Administrator"
              size="large"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(users ?? []).map((u) => ({
                value: u.id,
                label: `${u.fullName || 'Unnamed'} (${u.email})`,
              }))}
            />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsCreateFamilyModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createFamilyMutation.isPending}
            >
              Create Workspace
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Assign Member */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserPlus size={18} className="text-primary" />
            <span>Assign User to Workspace</span>
          </div>
        }
        open={isAddMemberModalOpen}
        onCancel={() => setIsAddMemberModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <p className="text-xs text-muted-foreground mb-4">
          Directly assign any user account into a workspace with a specific role.
        </p>
        <Form
          form={addMemberForm}
          layout="vertical"
          initialValues={{ role: 'MEMBER' }}
          onFinish={(values) => addFamilyMemberMutation.mutate(values)}
        >
          <Form.Item
            name="familyId"
            label="Select Workspace"
            rules={[{ required: true, message: 'Please select a workspace' }]}
          >
            <Select
              placeholder="Select workspace"
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(families ?? []).map((f) => ({
                value: f.id,
                label: f.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="userId"
            label="Select User"
            rules={[{ required: true, message: 'Please select a user' }]}
          >
            <Select
              placeholder="Select user"
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(users ?? []).map((u) => ({
                value: u.id,
                label: `${u.fullName || 'Unnamed'} (${u.email})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="role"
            label="Workspace Role"
            rules={[{ required: true, message: 'Please select role' }]}
          >
            <Select
              size="large"
              options={[
                { value: 'FAMILY_ADMIN', label: 'Workspace Admin' },
                { value: 'MEMBER', label: 'Member' },
              ]}
            />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsAddMemberModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={addFamilyMemberMutation.isPending}
            >
              Assign Member
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Edit Family Name */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Pencil size={18} className="text-primary" />
            <span>Edit Workspace Name</span>
          </div>
        }
        open={editingFamily !== null}
        onCancel={() => setEditingFamily(null)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form
          form={editFamilyForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingFamily) {
              editFamilyMutation.mutate({ familyId: editingFamily.id, name: values.name });
            }
          }}
        >
          <Form.Item
            name="name"
            label="Workspace Name"
            rules={[{ required: true, message: 'Please enter workspace name' }]}
          >
            <Input placeholder="Enter new workspace name" size="large" />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setEditingFamily(null)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editFamilyMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
