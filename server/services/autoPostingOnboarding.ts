import type { Pool } from 'pg';
import {
  getAutoPostingSettings,
  upsertAutoPostingSettings,
} from '../repositories/autoPostingRepository';
import { getTenantPublicationCatalog } from './socialPublicationService';

export type AutoPostingOnboardingPlatform = {
  platform: string;
  status: string;
  ready: boolean;
  hasPublisher: boolean;
  reason: string;
};

export type AutoPostingOnboarding = {
  tenantId: string;
  autoPostingEnabled: boolean;
  autoEnabledNow: boolean;
  connectedPlatforms: string[];
  platforms: AutoPostingOnboardingPlatform[];
};

export async function buildAutoPostingOnboarding(
  pool: Pool,
  tenantId: string,
  options: { autoEnable?: boolean } = {},
): Promise<AutoPostingOnboarding> {
  const settings = await getAutoPostingSettings(pool, tenantId);
  const catalog = await getTenantPublicationCatalog(tenantId);
  const platforms: AutoPostingOnboardingPlatform[] = catalog.map(item => ({
    platform: item.platform,
    status: item.status,
    ready: item.status === 'READY' && item.canPublish,
    hasPublisher: item.hasPublisher,
    reason: item.reason,
  }));
  const readyPlatforms = platforms.filter(item => item.ready).map(item => item.platform);
  let autoEnabled = false;
  if (options.autoEnable && readyPlatforms.length && !settings.enabled) {
    await upsertAutoPostingSettings(pool, tenantId, {
      enabled: true,
      platforms: readyPlatforms,
    });
    autoEnabled = true;
  }
  const finalSettings = autoEnabled ? await getAutoPostingSettings(pool, tenantId) : settings;
  return {
    tenantId,
    autoPostingEnabled: finalSettings.enabled,
    autoEnabledNow: autoEnabled,
    connectedPlatforms: readyPlatforms,
    platforms,
  };
}
