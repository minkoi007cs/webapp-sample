import api from './client';

export interface FamilyDocument {
  id: string;
  familyId: string;
  uploadedByUserId?: string;
  uploadedByUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  title: string;
  originalFileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize: number;
  category: string;
  tags: string[];
  summary?: string;
  extractedContent?: string;
  structuredData?: Record<string, any>;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  errorMessage?: string;
  userNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  items: FamilyDocument[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  meta: {
    categories: Record<string, number>;
    availableTags: string[];
  };
}

export interface DocumentSynthesisResponse {
  query: string;
  synthesis: string;
  sourceDocuments: Array<{
    id: string;
    title: string;
    category: string;
    thumbnailUrl?: string;
    fileUrl: string;
    mimeType: string;
    summary?: string;
    tags?: string[];
  }>;
}

export const documentApi = {
  getAll: (params?: {
    search?: string;
    category?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) => api.get<DocumentListResponse>('/documents', { params }),

  getById: (id: string) => api.get<FamilyDocument>(`/documents/${id}`),

  upload: (
    file: File,
    metadata?: { title?: string; category?: string; tags?: string[]; userNote?: string },
    onUploadProgress?: (progressEvent: any) => void,
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.title) formData.append('title', metadata.title);
    if (metadata?.category) formData.append('category', metadata.category);
    if (metadata?.tags && metadata.tags.length > 0) {
      metadata.tags.forEach((tag) => formData.append('tags[]', tag));
    }
    if (metadata?.userNote) formData.append('userNote', metadata.userNote);

    return api.post<FamilyDocument>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },

  update: (
    id: string,
    data: {
      title?: string;
      category?: string;
      tags?: string[];
      summary?: string;
      extractedContent?: string;
      structuredData?: Record<string, any>;
      userNote?: string;
    },
  ) => api.patch<FamilyDocument>(`/documents/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/documents/${id}`),

  reanalyze: (id: string) => api.post<FamilyDocument>(`/documents/${id}/reanalyze`),

  synthesize: (query: string, documentIds?: string[]) =>
    api.post<DocumentSynthesisResponse>('/documents/synthesize', { query, documentIds }),
};
