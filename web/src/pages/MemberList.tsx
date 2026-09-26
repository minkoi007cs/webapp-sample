import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, message, Avatar, Spin } from 'antd';
import { UserPlus, Shield, Copy, Mail, Users, X, Check, Trash2, Send, Link2, CopyPlus } from 'lucide-react';
import { userApi } from '../api/user';
import type { User } from '../api/user';
import { useSession } from '../components/auth/SessionProvider';
import { asPaginatedList } from '../api/client';

const MEMBER_PAGE_SIZE = 15;

export const MemberList = () => {
    const queryClient = useQueryClient();
    const { role, canAccess } = useSession();
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();

    const {
        data: memberInfinite,
        isPending: membersLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['members', 'infinite'],
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            userApi
                .findAll({ page: pageParam, pageSize: MEMBER_PAGE_SIZE })
                .then((res) => asPaginatedList(res.data)),
        getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    });

    const members = useMemo(
        () => memberInfinite?.pages.flatMap((p) => p.items) ?? [],
        [memberInfinite],
    );

    const onMemberTableScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (nearBottom && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        },
        [fetchNextPage, hasNextPage, isFetchingNextPage],
    );

    const inviteMutation = useMutation({
        mutationFn: (values: { email: string; role: string; fullName: string }) =>
            userApi.invite(values.email, values.role, values.fullName),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['members'] });
            setInviteLink(`${window.location.origin}/accept-invite?token=${res.data.token}`);
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Failed to create invitation. Please check the email.');
        },
    });

    const copyInviteLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        message.success('Invitation link copied');
    };

    const closeInviteModal = () => {
        setIsInviteModalOpen(false);
        setInviteLink(null);
        form.resetFields();
    };

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => userApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members'] });
            message.success('Member information updated');
            setIsEditModalOpen(false);
            setEditingUser(null);
            editForm.resetFields();
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string; role: string }) => userApi.updateRole(id, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members'] });
            message.success('User role updated');
        },
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => userApi.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members'] });
            message.success('Member removed from workspace');
        },
    });

    const handleEdit = (user: User) => {
        if (role !== 'FAMILY_ADMIN') {
            return;
        }
        setEditingUser(user);
        editForm.setFieldsValue(user);
        setIsEditModalOpen(true);
    };

    const canManageMembers = role === 'FAMILY_ADMIN' && canAccess('USER', 'update');

    const openInviteFromMemberCopy = (record: User, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canManageMembers) return;
        form.resetFields();
        form.setFieldsValue({
            fullName: record.fullName || '',
            email: '',
            role: record.role || 'MEMBER',
        });
        setIsInviteModalOpen(true);
    };

    const columns = [
        {
            title: 'Member',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (text: string, record: User) => (
                <Space>
                    <Avatar className="bg-primary/10 text-primary font-bold">
                        {text?.charAt(0) || record.email.charAt(0)}
                    </Avatar>
                    <div>
                        <div className="font-medium text-foreground">{text || 'Pending...'}</div>
                        <div className="text-xs text-muted-foreground">{record.email}</div>
                    </div>
                </Space>
            ),
            sorter: (a: User, b: User) => (a.fullName || a.email || '').localeCompare(b.fullName || b.email || ''),
        },
        {
            title: 'AI Nicknames',
            dataIndex: 'otherNames',
            key: 'otherNames',
            render: (text: string) => (
                <span className="text-muted-foreground italic text-sm">{text || '-'}</span>
            ),
            sorter: (a: User, b: User) => (a.otherNames || '').localeCompare(b.otherNames || ''),
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string, record: User) => (
                <span onClick={(e) => e.stopPropagation()}>
                    <Select
                        value={role}
                        size="small"
                        className="w-32"
                        disabled={!canManageMembers}
                        onChange={(val) => updateRoleMutation.mutate({ id: record.id, role: val })}
                        options={[
                            { value: 'FAMILY_ADMIN', label: 'Admin' },
                            { value: 'MEMBER', label: 'Member' },
                        ]}
                    />
                </span>
            ),
            sorter: (a: User, b: User) => (a.role || '').localeCompare(b.role || ''),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors: Record<string, string> = { ACTIVE: 'green', INVITED: 'orange', REMOVED: 'red' };
                const labels: Record<string, string> = {
                    ACTIVE: 'Active',
                    INVITED: 'Invited',
                    REMOVED: 'Removed',
                };
                return <Tag color={colors[status] || 'blue'}>{labels[status] || status}</Tag>;
            },
            sorter: (a: User, b: User) => (a.status || '').localeCompare(b.status || ''),
        },
        {
            title: 'Actions',
            key: 'action',
            render: (_: unknown, record: User) => (
                <Space onClick={(e) => e.stopPropagation()}>
                    <Button
                        type="text"
                        disabled={!canManageMembers}
                        icon={<CopyPlus size={16} />}
                        title="Invite another with similar role"
                        aria-label="Invite another with similar role"
                        onClick={(e) => openInviteFromMemberCopy(record, e)}
                    />
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-4 lg:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-foreground font-sans">Family Members</h1>
                </div>
                <Button
                    type="primary"
                    icon={<UserPlus size={18} />}
                    disabled={!canManageMembers}
                    onClick={() => {
                        form.resetFields();
                        setIsInviteModalOpen(true);
                    }}
                    className="w-full sm:w-auto"
                    title="Invite Member"
                    aria-label="Invite Member"
                />
            </div>

            <div className="glass-card p-4 lg:p-6 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table
                        columns={columns}
                        dataSource={members}
                        loading={membersLoading}
                        rowKey="id"
                        onRow={(record) => ({
                            onClick: () => handleEdit(record),
                            style: { cursor: canManageMembers ? 'pointer' : 'default' }
                        })}
                        scroll={{ x: 600, y: 'calc(100vh - 260px)' }}
                        size={window.innerWidth < 768 ? 'small' : 'middle'}
                        pagination={false}
                        onScroll={onMemberTableScroll}
                    />
                    {isFetchingNextPage ? (
                        <div className="flex justify-center py-2">
                            <Spin size="small" />
                        </div>
                    ) : null}
                </div>
            </div>

            <Modal
                title="Edit Member Information"
                open={isEditModalOpen}
                forceRender
                onCancel={() => {
                    setIsEditModalOpen(false);
                    setEditingUser(null);
                    editForm.resetFields();
                }}
                confirmLoading={updateMutation.isPending}
                footer={[
                    editingUser ? (
                        <Button
                            key="delete"
                            danger
                            icon={<Trash2 size={18} />}
                            title="Remove from workspace"
                            aria-label="Remove from workspace"
                            loading={removeMutation.isPending}
                            disabled={!canManageMembers}
                            onClick={() => {
                                Modal.confirm({
                                    title: 'Confirm Removal',
                                    content: `Are you sure you want to remove "${editingUser.fullName || editingUser.email}" from the family?`,
                                    onOk: () => {
                                        removeMutation.mutate(editingUser.id, {
                                            onSuccess: () => {
                                                setIsEditModalOpen(false);
                                                setEditingUser(null);
                                                editForm.resetFields();
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
                        onClick={() => {
                            setIsEditModalOpen(false);
                            setEditingUser(null);
                            editForm.resetFields();
                        }}
                    />,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<Check size={18} />}
                        title="Update"
                        aria-label="Update"
                        onClick={() => editForm.submit()}
                        loading={updateMutation.isPending}
                    />,
                ]}
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={(values) => updateMutation.mutate({ id: editingUser!.id, data: values })}
                    className="mt-4"
                >
                    <Form.Item
                        name="fullName"
                        label="Full Name"
                        rules={[{ required: true }]}
                    >
                        <Input prefix={<Users size={16} className="text-muted-foreground mr-2" />} />
                    </Form.Item>
                    <Form.Item
                        name="otherNames"
                        label="Alternative Names / Nicknames (for AI)"
                        extra="Comma-separated names. e.g. Dad, Mom, Mike"
                    >
                        <Input placeholder="Names for AI prompt recognition..." />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={inviteLink ? 'Invitation Ready' : 'Invite New Member'}
                open={isInviteModalOpen}
                forceRender
                onCancel={closeInviteModal}
                footer={inviteLink ? [
                    <Button key="done" type="primary" onClick={closeInviteModal}>
                        Done
                    </Button>,
                ] : [
                    <Button
                        key="cancel"
                        type="text"
                        icon={<X size={18} />}
                        title="Cancel"
                        aria-label="Cancel"
                        onClick={closeInviteModal}
                    />,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<Send size={18} />}
                        title="Generate Invitation"
                        aria-label="Generate Invitation"
                        onClick={() => form.submit()}
                        loading={inviteMutation.isPending}
                    />,
                ]}
            >
                {inviteLink ? (
                    <div className="mt-4 space-y-4">
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg flex gap-3 text-emerald-700 dark:text-emerald-300 text-sm">
                            <Check size={18} className="flex-shrink-0" />
                            <p>Send this link to the invitee. They will sign in with Google to join this workspace.</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                            <Link2 size={16} className="flex-shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-sm text-muted-foreground">{inviteLink}</span>
                        </div>
                        <Button block icon={<Copy size={16} />} onClick={copyInviteLink}>
                            Copy Link
                        </Button>
                    </div>
                ) : (
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={(values) => inviteMutation.mutate(values)}
                        className="mt-4"
                    >
                        <Form.Item
                            name="fullName"
                            label="Full Name"
                        >
                            <Input prefix={<Users size={16} className="text-muted-foreground mr-2" />} placeholder="John Doe" />
                        </Form.Item>
                        <Form.Item
                            name="email"
                            label="Email Address"
                            rules={[{ required: true, type: 'email' }]}
                        >
                            <Input prefix={<Mail size={16} className="text-muted-foreground mr-2" />} placeholder="member@example.com" />
                        </Form.Item>
                        <Form.Item
                            name="role"
                            label="Role"
                            rules={[{ required: true }]}
                            initialValue="MEMBER"
                        >
                            <Select options={[
                                { value: 'FAMILY_ADMIN', label: 'Workspace Administrator (Full Access)' },
                                { value: 'MEMBER', label: 'Member (Standard Permissions)' },
                            ]} />
                        </Form.Item>
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg flex gap-3 text-blue-700 dark:text-blue-300 text-sm">
                            <Shield size={18} className="flex-shrink-0" />
                            <p>You will receive an invite link to send directly. The user must sign in using the designated email.</p>
                        </div>
                    </Form>
                )}
            </Modal>
        </div>
    );
};
