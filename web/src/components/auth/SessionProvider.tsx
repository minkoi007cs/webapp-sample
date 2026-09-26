import { createContext, useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { authApi, type FamilyRole, type SessionMembership, type SessionResponse, type SessionUser, type SystemRole } from '../../api/auth';

type ModuleKey = 'DASHBOARD' | 'CATEGORY' | 'CALENDAR' | 'ASSET' | 'TRANSACTION' | 'USER' | 'FAMILY' | 'PERMISSION' | 'ADMIN' | 'GOUS' | 'DOCUMENT';
type PermissionAction = 'view' | 'create' | 'update' | 'delete';

type PermissionMatrix = Record<Exclude<FamilyRole, null>, Partial<Record<ModuleKey, PermissionAction[]>>>;

const SYSTEM_SCOPED_MODULES = new Set<ModuleKey>(['ADMIN', 'PERMISSION']);
const FAMILY_SCOPED_MODULES = new Set<ModuleKey>(['FAMILY', 'USER', 'DASHBOARD', 'CATEGORY', 'CALENDAR', 'ASSET', 'TRANSACTION', 'GOUS', 'DOCUMENT']);

const ROLE_PERMISSIONS: PermissionMatrix = {
  APP_ADMIN: {
    ADMIN: ['view', 'update'],
    FAMILY: ['view', 'update'],
    USER: ['view', 'update'],
    PERMISSION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
  FAMILY_ADMIN: {
    FAMILY: ['view', 'update'],
    USER: ['view', 'create', 'update', 'delete'],
    DASHBOARD: ['view'],
    CATEGORY: ['view', 'create', 'update', 'delete'],
    CALENDAR: ['view', 'create', 'update', 'delete'],
    ASSET: ['view', 'create', 'update', 'delete'],
    TRANSACTION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
  MEMBER: {
    FAMILY: ['view'],
    USER: ['view'],
    DASHBOARD: ['view'],
    CATEGORY: ['view'],
    CALENDAR: ['view', 'create', 'update', 'delete'],
    ASSET: ['view', 'create', 'update', 'delete'],
    TRANSACTION: ['view', 'create', 'update', 'delete'],
    GOUS: ['view', 'create', 'update', 'delete'],
    DOCUMENT: ['view', 'create', 'update', 'delete'],
  },
};

type SessionContextValue = {
  session: SessionResponse | null;
  user: SessionUser | null;
  memberships: SessionMembership[];
  activeFamilyId: string | null;
  activeFamilyName: string | null;
  role: FamilyRole;
  systemRole: SystemRole | null;
  isLoading: boolean;
  canAccess: (moduleKey: ModuleKey, action?: PermissionAction) => boolean;
  switchFamily: (familyId: string) => Promise<void>;
  isSwitchingFamily: boolean;
  createFamily: (name?: string) => Promise<void>;
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

  const switchFamilyMutation = useMutation({
    mutationFn: async (familyId: string) => {
      const { data } = await authApi.switchFamily(familyId);
      return storeSession(data);
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] !== 'session',
      });
      message.success(`Đã chuyển sang gia đình ${session.user.memberships.find((item) => item.familyId === session.user.familyId)?.familyName || ''}`.trim());
    },
    onError: () => {
      message.error('Không thể chuyển gia đình đang làm việc');
    },
  });

  const createFamilyMutation = useMutation({
    mutationFn: async (name?: string) => {
      const { data } = await authApi.createFamily(name);
      return storeSession(data);
    },
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] !== 'session',
      });
      message.success(`Đã tạo và kích hoạt gia đình mới thành công!`);
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Không thể tạo gia đình mới');
    },
  });

  const session = sessionQuery.data ?? null;
  const user = session?.user ?? null;
  const memberships = user?.memberships ?? [];
  const activeFamilyId = user?.familyId ?? null;
  const activeFamilyName = memberships.find((membership) => membership.familyId === activeFamilyId)?.familyName ?? null;
  const role = user?.role ?? null;
  const systemRole = user?.systemRole ?? null;

  const value = useMemo<SessionContextValue>(() => ({
    session,
    user,
    memberships,
    activeFamilyId,
    activeFamilyName,
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

      if (FAMILY_SCOPED_MODULES.has(moduleKey)) {
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
    switchFamily: async (familyId: string) => {
      if (familyId === activeFamilyId) {
        return;
      }
      await switchFamilyMutation.mutateAsync(familyId);
    },
    isSwitchingFamily: switchFamilyMutation.isPending,
    createFamily: async (name?: string) => {
      await createFamilyMutation.mutateAsync(name);
    },
    isCreatingFamily: createFamilyMutation.isPending,
    refreshSession: async () => {
      const next = await sessionQuery.refetch();
      return next.data;
    },
  }), [
    session,
    user,
    memberships,
    activeFamilyId,
    activeFamilyName,
    role,
    systemRole,
    sessionQuery,
    switchFamilyMutation,
    createFamilyMutation,
  ]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};
