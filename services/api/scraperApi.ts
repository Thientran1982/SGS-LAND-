import { api } from './apiClient';

/**
 * Scraper endpoints. Market listings (sn th trng) live under /api/scraper,
 * project units and project leads under /api/scraper/projects.
 * (The old jobs/logs/trigger/stats helpers pointed at endpoints that do not exist.)
 */
export const scraperApi = {
  /** Source availability and cache state for market scraping. */
  getStatus: () =>
    api.get('/api/scraper/status'),

  /** Market listings from the last run. */
  getMarketResults: () =>
    api.get('/api/scraper/results'),

  getProjectsCatalog: () =>
    api.get('/api/scraper/projects/catalog'),

  /** Project units from the last project run. */
  getProjectsResults: () =>
    api.get('/api/scraper/projects/results'),
};
