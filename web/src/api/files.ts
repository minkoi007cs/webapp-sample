import api from './client';

export const filesApi = {
  upload: (file: File, folder = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ url: string }>(`/files/upload?folder=${encodeURIComponent(folder)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
