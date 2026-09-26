import { createContext, useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import {
  authApi,
  type GroupRole,
  type SessionMembership,
  type SessionResponse,
  type SessionUser,
  type SystemRole,
} from '../../api/auth';

type ModuleKey =
  | 'DASHBOARD'
  | 'CATEGORY'
  | 'CALENDAR'
  | 'ASSET'
  | 'SAMPLE'
  | 'TRANSACTION'
  | 'USER'
  | 'GROUP'
  | 'FAMILY'
  | 'PERMISSION'
  | 'ADMIN'
  | 'GOUS'
  | 'DOCUMENT';

type PermissionAction = 'view' | 'create' | 'update' | 'delete';

type PermissionMatrix = Record<string, Partial<Record<ModuleKey, PermissionAction[]>>>;

const SYSTEM_SCOPED_MODULES = new Set<ModuleKey>(['ADMIN', 'PERMISSION']);
const GROUP_SCOPED_MODULES = new Set<ModuleKey>([
  'GROUP',
  'FAMILY',
  'USER',
  'DASHBOARD',
  'CATEGORY',
  'CALENDAR',
  'ASSET',
  'SAMPLE',
  'TRANSACTION',
  'GOUS',
  'DOCUMENT',
]);

const ROLE_PERMISSIONS: PermissionMatrix = {
  APP_ADMIN: {
    ADMIN: ['view', 'update'],
    GROUP: ['view', 'update'],
    FAMILY: ['view', 'update'],
    USER: ['view', 'update'],
    PERMISSION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
  GROUP_ADMIN: {
    GROUP: ['view', 'update'],
    FAMILY: ['view', 'update'],
    USER: ['view', 'create', 'update', 'delete'],
    DASHBOARD: ['view'],
    CATEGORY: ['view', 'create', 'update', 'delete'],
    CALENDAR: ['view', 'create', 'update', 'delete'],
    ASSET: ['view', 'create', 'update', 'delete'],
    SAMPLE: ['view', 'create', 'update', 'delete'],
    TRANSACTION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
  FAMILY_ADMIN: {
    GROUP: ['view', 'update'],
    FAMILY: ['view', 'update'],
    USER: ['view', 'create', 'update', 'delete'],
    DASHBOARD: ['view'],
    CATEGORY: ['view', 'create', 'update', 'delete'],
    CALENDAR: ['view', 'create', 'update', 'delete'],
    ASSET: ['view', 'create', 'update', 'delete'],
    SAMPLE: ['view', 'create', 'update', 'delete'],
    TRANSACTION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
  MEMBER: {
    GROUP: ['view'],
    FAMILY: ['view'],
    USER: ['view'],
    DASHBOARD: ['view'],
    CATEGORY: ['view'],
    CALENDAR: ['view', 'create', 'update', 'delete'],
    ASSET: ['view', 'create', 'update', 'delete'],
    SAMPLE: ['view', 'create', 'update', 'delete'],
    TRANSACTION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
};

type SessionContextValue = {
  session: SessionResponse | null;
  user: SessionUser | null;
  memberships: SessionMembership[];
  activeGroupId: string | null;
  activeGroupName: string | null;
  activeFamilyId: string | null;
  activeFamilyName: string | null;
  role: GroupRole;
  systemRole: SystemRole | null;
  isLoading: boolean;
  canAccess: (moduleKey: ModuleKey, action?: PermissionAction) => boolean;
  switchGroup: (groupId: string) => Promise<void>;
  switchFamily: (groupId: string) => Promise<void>;
  isSwitchingGroup: boolean;
  isSwitchingFamily: boolean;
  createGroup: (name?: string) => Promise<void>;
  createFamily: (name?: string) => Promise<void>;
  isCreatingGroup: boolean;
  isCreatingFamily: boolean;
  refreshSession: () => Promise<SessionResponse | undefined>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const getStoredToken = () => localStorage.getItem('token');

const storeSession = (session: SessionResponse) => {
  localStorage.setItem('token', session.access_token);
  return session;
};

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const token = getStoredToken();

  const sessionQuery = useQuery({
    queryKey: ['session'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await authApi.me();
      return storeSession(data);
    },
  });

  const switchGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { data } = await authApi.switchGroup(groupId);
      return storeSession(data);
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] !== 'session',
      });
      const activeName =
        session.user.memberships.find(
          (item) => item.groupId === session.user.groupId || item.familyId === session.user.groupId,
        )?.groupName || '';
      message.success(`Đã chuyển sang nhóm ${activeName}`.trim());
    },
    onError: () => {
      message.error('Không thể chuyển nhóm làm việc');
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (name?: string) => {
      const { data } = await authApi.createGroup(name);
      return storeSession(data);
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] !== 'session',
      });
      message.success(`Tạo nhóm mới thành công!`);
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể tạo nhóm làm việc');
    },
  });

  const session = sessionQuery.data ?? null;
  const user = session?.user ?? null;
  const memberships = useMemo(() => {
    return (user?.memberships ?? []).map((m) => ({
      ...m,
      groupId: m.groupId || m.familyId || '',
      groupName: m.groupName || m.familyName || '',
      familyId: m.groupId || m.familyId || '',
      familyName: m.groupName || m.familyName || '',
    }));
  }, [user?.memberships]);

  const activeGroupId = user?.groupId || user?.familyId || null;
  const activeGroupName =
    memberships.find((m) => m.groupId === activeGroupId || m.familyId === activeGroupId)?.groupName ?? null;

  const role = user?.role ?? null;
  const systemRole = user?.systemRole ?? null;

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user,
      memberships,
      activeGroupId,
      activeGroupName,
      activeFamilyId: activeGroupId,
      activeFamilyName: activeGroupName,
      role,
      systemRole,
      isLoading: sessionQuery.isLoading,
      canAccess: (moduleKey, action = 'view') => {
        if (systemRole === 'APP_ADMIN') {
          if (SYSTEM_SCOPED_MODULES.has(moduleKey) || moduleKey === 'GOUS') {
            return ROLE_PERMISSIONS.APP_ADMIN[moduleKey]?.includes(action) ?? false;
          }
          if (role && ROLE_PERMISSIONS[role]?.[moduleKey]?.includes(action)) {
            return true;
          }
          return ROLE_PERMISSIONS.APP_ADMIN[moduleKey]?.includes(action) ?? false;
        }

        if (GROUP_SCOPED_MODULES.has(moduleKey)) {
          if (!role || role === 'APP_ADMIN') {
            return false;
          }
          return ROLE_PERMISSIONS[role]?.[moduleKey]?.includes(action) ?? false;
        }

        if (!role) {
          return false;
        }

        return ROLE_PERMISSIONS[role]?.[moduleKey]?.includes(action) ?? false;
      },
      switchGroup: async (groupId: string) => {
        if (groupId === activeGroupId) {
          return;
        }
        await switchGroupMutation.mutateAsync(groupId);
      },
      switchFamily: async (groupId: string) => {
        if (groupId === activeGroupId) {
          return;
        }
        await switchGroupMutation.mutateAsync(groupId);
      },
      isSwitchingGroup: switchGroupMutation.isPending,
      isSwitchingFamily: switchGroupMutation.isPending,
      createGroup: async (name?: string) => {
        await createGroupMutation.mutateAsync(name);
      },
      createFamily: async (name?: string) => {
        await createGroupMutation.mutateAsync(name);
      },
      isCreatingGroup: createGroupMutation.isPending,
      isCreatingFamily: createGroupMutation.isPending,
      refreshSession: async () => {
        const next = await sessionQuery.refetch();
        return next.data;
      },
    }),
    [
      session,
      user,
      memberships,
      activeGroupId,
      activeGroupName,
      role,
      systemRole,
      sessionQuery,
      switchGroupMutation,
      createGroupMutation,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};
