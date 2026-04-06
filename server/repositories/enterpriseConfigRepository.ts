import { BaseRepository } from './baseRepository';
import { pool } from '../db';

export class EnterpriseConfigRepository extends BaseRepository {
  constructor() {
    super('enterprise_config');
  }

  /**
   * Cross-tenant lookup: find the tenantId that has a given Zalo OA ID configured.
   * Uses raw pool (bypasses RLS) because we need to search across all tenants.
   */
  async findTenantByZaloOaId(oaId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT tenant_id FROM enterprise_config
       WHERE config_key = 'zalo'
         AND config_value->>'oaId' = $1
         AND (config_value->>'enabled')::boolean = true
       LIMIT 1`,
      [oaId]
    );
    return result.rows[0]?.tenant_id ?? null;
  }

  /**
   * Cross-tenant lookup: find the tenantId that has a given Facebook Page ID configured.
   * Uses raw pool (bypasses RLS) because we need to search across all tenants.
   */
  async findTenantByFacebookPageId(pageId: string): Promise<string | null> {
    // facebookPages is stored as a JSON array: [{id: "pageId", ...}, ...]
    const result = await pool.query(
      `SELECT tenant_id FROM enterprise_config
       WHERE config_key = 'facebookPages'
         AND config_value @> $1::jsonb
       LIMIT 1`,
      [JSON.stringify([{ id: pageId }])]
    );
    return result.rows[0]?.tenant_id ?? null;
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
        email: config.email || { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: 'SGS LAND', fromAddress: '' },
        ipAllowlist: config.ipAllowlist || [],
        sessionTimeoutMins: config.sessionTimeoutMins || 480,
        retention: config.retention || { messagesDays: 365, auditLogsDays: 730 },
        legalHold: config.legalHold || false,
        dlpRules: config.dlpRules || [],
        slaConfig: config.slaConfig || { responseTimeMinutes: 30, escalationTimeMinutes: 120 },
      };
    });
  }

  async getConfigKey(tenantId: string, key: string): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT config_value FROM enterprise_config WHERE config_key = $1 LIMIT 1`,
        [key]
      );
      return result.rows[0]?.config_value ?? null;
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

  async getThemeConfig(tenantId: string): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT theme_config FROM enterprise_config
         WHERE config_key = '__theme__'
         LIMIT 1`
      );
      return result.rows[0]?.theme_config ?? null;
    });
  }

  async saveThemeConfig(tenantId: string, config: any): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO enterprise_config (tenant_id, config_key, config_value, theme_config, updated_at)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, '__theme__', 'null'::jsonb, $1, NOW())
         ON CONFLICT (tenant_id, config_key) DO UPDATE SET theme_config = $1, updated_at = NOW()`,
        [JSON.stringify(config ?? {})]
      );
      return config;
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
