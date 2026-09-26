import api from './client';

export type MaintenanceStatus = 'open' | 'completed' | 'skipped';
export type AssetMaintenanceType = 'maintenance' | 'operation' | 'liability';

export type MaintenanceFrequencyType = 'monthly' | 'yearly' | 'custom_days';

export interface AssetMaintenance {
  id: string;
  familyId?: string;
  assetId: string;
  scheduledDate: string;
  type: AssetMaintenanceType;
  status: MaintenanceStatus;
  content?: string | null;
  cost?: number | null;
  expenseId?: string | null;
  calendarEventId?: string | null;
  reminderDaysBefore?: number | null;
  asset?: { id: string; name: string };
}

export type CreateMaintenancePayload = {
  assetId: string;
  startDate: string;
  type: AssetMaintenanceType;
  content?: string;
  frequencyType?: MaintenanceFrequencyType;
  frequencyValue?: number;
  repeatCount?: number;
  reminderDaysBefore?: number;
};

export const maintenanceApi = {
  findAll: (params?: { assetId?: string; status?: MaintenanceStatus; type?: AssetMaintenanceType }) =>
    api.get<AssetMaintenance[]>('/maintenances', { params }),

  findOne: (id: string) => api.get<AssetMaintenance>(`/maintenances/${id}`),

  create: (data: CreateMaintenancePayload) =>
    api.post<AssetMaintenance[]>('/maintenances', data),

  update: (
    id: string,
    data: Partial<{
      scheduledDate: string;
      type: AssetMaintenanceType;
      status: MaintenanceStatus;
      content: string;
      reminderDaysBefore: number | null;
    }>,
  ) => api.patch<AssetMaintenance>(`/maintenances/${id}`, data),

  remove: (id: string) => api.delete(`/maintenances/${id}`),

  complete: (id: string, data: { content: string; cost: number; categoryId: string }) =>
    api.post<AssetMaintenance>(`/maintenances/${id}/complete`, data),
};
