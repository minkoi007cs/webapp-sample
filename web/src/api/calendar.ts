import api from './client';

export interface CalendarEvent {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isFullDay: boolean;
  location?: string;
  reminderMinutes: number;
  type: 'EVENT' | 'MAINTENANCE' | 'PAYMENT' | 'REMINDER';
  metadata?: string;
  recurrenceRule?: string;
  participants?: any[];
  participantIds?: string[];
  createdBy?: string;
  createdAt?: string;
  creator?: { fullName: string; email: string };
  updatedBy?: string;
  updatedAt?: string;
  updater?: { fullName: string; email: string };
}

export const calendarApi = {
  getAll: (startDate?: string, endDate?: string) =>
    api.get<CalendarEvent[]>('/calendar', { params: { startDate, endDate } }),

  getOne: (id: string) => api.get<CalendarEvent>(`/calendar/${id}`),

  create: (data: Partial<CalendarEvent>) => api.post<CalendarEvent>('/calendar', data),

  update: (id: string, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/calendar/${id}`, data),

  remove: (id: string) => api.delete(`/calendar/${id}`),
};
