import axios from 'axios';

const raw = import.meta.env.VITE_API_URL?.trim() ?? '';
export const apiBaseUrl = raw !== '' ? raw.replace(/\/$/, '') : '/api/v1';

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/login-success') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Paginated response from API when querying with page/pageSize */
export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Normalize array or paginated object for infinite query use */
export function asPaginatedList<T>(data: T[] | PaginatedList<T>): PaginatedList<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      hasMore: false,
    };
  }
  return data;
}

/** Extract items array from response */
export function asArray<T>(data: T[] | PaginatedList<T>): T[] {
  return Array.isArray(data) ? data : data.items;
}

export default api;
