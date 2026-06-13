import { api } from './apiClient';

export const newsApi = {
  getArticles: (params?: Record<string, any>) =>
    api.get('/api/public/news', params),
  
  getArticle: (slug: string) =>
    api.get(`/api/public/news/${slug}`),
  
  uploadImage: (data: FormData) =>
    fetch('/api/upload', { method: 'POST', body: data, credentials: 'include' }).then(r => r.json()),
  
  subscribeNewsletter: (email: string) =>
    api.post('/api/public/newsletter/subscribe', { email }),
  
  getCategories: () =>
    api.get('/api/public/news/categories'),
};
