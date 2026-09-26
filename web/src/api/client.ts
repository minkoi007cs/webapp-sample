import axios from 'axios';

const raw = import.meta.env.VITE_API_URL?.trim() ?? '';
// Dev: để trống VITE_API_URL → dùng /api/v1 (Vite proxy tới server), tránh trỏ nhầm URL deploy cũ
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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Phản hồi phân trang từ API khi có query page/pageSize */
export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Chuẩn hóa mảng hoặc object phân trang — dùng cho infinite query */
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

/** Lấy mảng phần tử dù client cũ chỉ mong đợi mảng */
export function asArray<T>(data: T[] | PaginatedList<T>): T[] {
  return Array.isArray(data) ? data : data.items;
}

export default api;
