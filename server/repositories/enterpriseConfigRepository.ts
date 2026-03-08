import { BaseRepository } from './baseRepository';

export class EnterpriseConfigRepository extends BaseRepository {
  constructor() {
    super('enterprise_config');
  }

  async getConfig(tenantId: string): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT config_key, config_value FROM enterprise_config`
      );

      const config: Record<string, any> = {};
      for (const row of result.rows) {
        config[row.config_key] = row.config_value;
      }

      return {
        id: tenantId,
        tenantId,
        language: config.language || 'vi',
        onboarding: config.onboarding || { completedSteps: [], isDismissed: false, percentage: 0 },
        domains: config.domains || [],
        sso: config.sso || { enabled: false, provider: 'OIDC' },
        scim: config.scim || { enabled: false, token: '', tokenCreatedAt: new Date().toISOString() },
        facebookPages: config.facebookPages || [],
        zalo: config.zalo || { enabled: false, oaId: '', oaName: '', webhookUrl: '' },
        email: config.email || { enabled: false, host: '', port: 587, user: '', password: '' },
        ipAllowlist: config.ipAllowlist || [],
        sessionTimeoutMins: config.sessionTimeoutMins || 480,
        retention: config.retention || { days: 365, autoDelete: false },
        legalHold: config.legalHold || false,
        dlpRules: config.dlpRules || [],
        slaConfig: config.slaConfig || { responseTimeMinutes: 30, escalationTimeMinutes: 120 },
      };
    });
  }

  async upsertConfigKey(tenantId: string, key: string, value: any): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO enterprise_config (tenant_id, config_key, config_value, updated_at)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, NOW())
         ON CONFLICT (tenant_id, config_key) DO UPDATE SET config_value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    });
  }

  async upsertConfig(tenantId: string, data: Record<string, any>): Promise<any> {
    const configKeys = [
      'language', 'onboarding', 'domains', 'sso', 'scim',
      'facebookPages', 'zalo', 'email', 'ipAllowlist',
      'sessionTimeoutMins', 'retention', 'legalHold', 'dlpRules', 'slaConfig'
    ];

    for (const key of configKeys) {
      if (data[key] !== undefined) {
        await this.upsertConfigKey(tenantId, key, data[key]);
      }
    }

    return this.getConfig(tenantId);
  }
}

export const enterpriseConfigRepository = new EnterpriseConfigRepository();
