import { api } from './apiClient';

export const scraperApi = {
  getJobs: () =>
    api.get('/api/scraper/jobs'),
  
  getLogs: (params?: Record<string, any>) =>
    api.get('/api/scraper/logs', params),
  
  getProjectsCatalog: () =>
    api.get('/api/scraper/projects/catalog'),
  
  getProjectsResults: () =>
    api.get('/api/scraper/projects/results'),
  
  triggerJob: (jobType: string) =>
    api.post('/api/scraper/trigger', { jobType }),
  
  getStatus: () =>
    api.get('/api/scraper/status'),
  
  getStats: () =>
    api.get('/api/scraper/stats'),
};
