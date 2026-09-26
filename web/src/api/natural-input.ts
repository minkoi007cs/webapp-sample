/** Natural input history API */
import api from './client';
export interface NaturalInputHistory {
  id: string;
  inputMessage: string;
  intent: string;
  confidence: number;
  resultData: any;
  createdAt: string;
  user: any; // Using any temporarily for debugging
}

export const naturalInputApi = {
  parse: (message: string) => api.post<{
    success: boolean;
    intent?: string;
    confidence?: number;
    data?: any;
    clarification?: string;
    reason?: string;
    details?: string;
  }>('/natural-input/parse', { message }),
  
  getHistory: () => api.get<NaturalInputHistory[]>('/natural-input/history'),
};
