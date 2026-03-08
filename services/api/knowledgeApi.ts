import { api, PaginatedResponse } from './apiClient';

export const knowledgeApi = {
  getDocuments: (page = 1, pageSize = 50) =>
    api.get<PaginatedResponse<any>>('/api/knowledge/documents', { page, pageSize }),

  createDocument: (data: any) =>
    api.post<any>('/api/knowledge/documents', data),

  deleteDocument: (id: string) =>
    api.delete<any>(`/api/knowledge/documents/${id}`),

  getArticles: (page = 1, pageSize = 50, params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/api/knowledge/articles', { page, pageSize, ...params }),

  getArticleById: (id: string) =>
    api.get<any>(`/api/knowledge/articles/${id}`),

  createArticle: (data: any) =>
    api.post<any>('/api/knowledge/articles', data),

  updateArticle: (id: string, data: any) =>
    api.put<any>(`/api/knowledge/articles/${id}`, data),

  deleteArticle: (id: string) =>
    api.delete<any>(`/api/knowledge/articles/${id}`),
};
