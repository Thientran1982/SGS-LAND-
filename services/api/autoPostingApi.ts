import { api } from './apiClient';

export interface AutoPostingTimeWindow {
  start: string;
  end: string;
}

export interface AutoPostingSettings {
  tenantId: string;
  enabled: boolean;
  postsPerDay: number;
  timeWindows: AutoPostingTimeWindow[];
  recycleAfterDays: number;
  platforms: string[];
}

export const autoPostingApi = {
  getSettings: (): Promise<AutoPostingSettings> =>
    api.get('/api/auto-posting/settings'),
  updateSettings: (input: Omit<AutoPostingSettings, 'tenantId'>): Promise<AutoPostingSettings> =>
    api.put('/api/auto-posting/settings', input),
};