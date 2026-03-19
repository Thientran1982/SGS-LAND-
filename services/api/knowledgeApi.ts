import { api, PaginatedResponse } from './apiClient';

export const knowledgeApi = {
  getDocuments: (page = 1, pageSize = 50, search?: string) =>
    api.get<PaginatedResponse<any>>('/api/knowledge/documents', { page, pageSize, ...(search ? { search } : {}) }),

  createDocument: (data: any) =>
    api.post<any>('/api/knowledge/documents', data),

  deleteDocument: (id: string) =>
    api.delete<any>(`/api/knowledge/documents/${id}`),

  getArticles: (page = 1, pageSize = 50, params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/api/knowledge/articles', { page, pageSize, ...params }),

  getPublicArticles: (page = 1, pageSize = 50, params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/api/public/articles', { page, pageSize, ...params }),

  getPublicArticleById: (id: string) =>
    api.get<any>(`/api/public/articles/${id}`),

  getArticleById: (id: string) =>
    api.get<any>(`/api/knowledge/articles/${id}`),

  createArticle: (data: any) =>
    api.post<any>('/api/knowledge/articles', data),

  updateArticle: (id: string, data: any) =>
    api.put<any>(`/api/knowledge/articles/${id}`, data),

  deleteArticle: (id: string) =>
    api.delete<any>(`/api/knowledge/articles/${id}`),
};
