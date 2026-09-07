import { BaseRepository, PaginatedResult } from './baseRepository';

class AiGovernanceRepository extends BaseRepository {
  constructor() {
    super('ai_safety_logs');
  }

  async getSafetyLogs(
    tenantId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const countResult = await client.query('SELECT COUNT(*)::int as total FROM ai_safety_logs');
      const total = countResult.rows[0].total;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        'SELECT * FROM ai_safety_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
      );

      return {
        data: this.rowsToEntities(result.rows),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async createSafetyLog(tenantId: string, data: any): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO ai_safety_logs (tenant_id, user_id, prompt, response, model, task_type, latency_ms, cost_usd, flagged, safety_flags, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          tenantId,
          data.userId || null,
          data.prompt || '',
          data.response || '',
          data.model || '',
          data.taskType || '',
          data.latencyMs || 0,
          data.costUsd || 0,
          data.flagged || false,
          JSON.stringify(data.safetyFlags || []),
          data.reason || null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async getPromptTemplates(tenantId: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        'SELECT * FROM prompt_templates ORDER BY created_at DESC'
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async getPromptTemplateById(tenantId: string, id: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        'SELECT * FROM prompt_templates WHERE id = $1',
        [id]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async createPromptTemplate(tenantId: string, data: any): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const contentText = data.content || '';
      const versions = data.versions || [{ version: 1, content: contentText, status: 'DRAFT', createdAt: new Date().toISOString() }];
      const result = await client.query(
        `INSERT INTO prompt_templates (tenant_id, name, content, description, category, active_version, versions, variables)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          data.name,
          contentText,
          data.description || '',
          data.category || 'general',
          data.activeVersion || 1,
          JSON.stringify(versions),
          JSON.stringify(data.variables || []),
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async updatePromptTemplate(tenantId: string, id: string, data: any): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.category !== undefined) {
        fields.push(`category = $${paramIndex++}`);
        values.push(data.category);
      }
      if (data.activeVersion !== undefined) {
        fields.push(`active_version = $${paramIndex++}`);
        values.push(data.activeVersion);
      }
      if (data.versions !== undefined) {
        fields.push(`versions = $${paramIndex++}`);
        values.push(JSON.stringify(data.versions));
        // Also sync `content` with the active version's content
        const activeVer = data.activeVersion;
        const activeVersionObj = data.versions.find((v: any) => v.version === activeVer) || data.versions[data.versions.length - 1];
        if (activeVersionObj?.content !== undefined) {
          fields.push(`content = $${paramIndex++}`);
          values.push(activeVersionObj.content);
        }
      }
      if (data.variables !== undefined) {
        fields.push(`variables = $${paramIndex++}`);
        values.push(JSON.stringify(data.variables));
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await client.query(
        `UPDATE prompt_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async deletePromptTemplate(tenantId: string, id: string): Promise<boolean> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        'DELETE FROM prompt_templates WHERE id = $1',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async getAiConfig(tenantId: string): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        "SELECT * FROM enterprise_config WHERE config_key = 'ai_config'"
      );
      if (result.rows[0]) {
        return result.rows[0].config_value;
      }
      return {
        enabled: true,
        allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3-pro-preview'],
        defaultModel: 'gemini-2.5-flash',
        budgetCapUsd: 100,
        currentSpendUsd: 0,
      };
    });
  }

  async getProviderFallbackConfig(tenantId: string): Promise<any> {
    const config = await this.getAiConfig(tenantId);
    return config?.providerFallback || null;
  }

  async upsertProviderFallbackConfig(tenantId: string, providerFallback: any): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO enterprise_config (tenant_id, config_key, config_value, updated_at)
         VALUES ($1, 'ai_config', jsonb_build_object('providerFallback', $2::jsonb), CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, config_key) DO UPDATE
           SET config_value = COALESCE(enterprise_config.config_value, '{}'::jsonb)
             || jsonb_build_object('providerFallback', $2::jsonb),
               updated_at = CURRENT_TIMESTAMP
         RETURNING config_value`,
        [tenantId, JSON.stringify(providerFallback)],
      );
      return result.rows[0]?.config_value || {};
    });
  }

  async logPromotion(
    tenantId: string,
    data: {
      templateId: string;
      templateName: string;
      version: number;
      previousVersion: number | null;
      promotedByUserId?: string | null;
      promotedByName?: string | null;
      promotedByEmail?: string | null;
    }
  ): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO prompt_promote_log
           (tenant_id, template_id, template_name, version, previous_version,
            promoted_by_user_id, promoted_by_name, promoted_by_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          data.templateId,
          data.templateName,
          data.version,
          data.previousVersion,
          data.promotedByUserId || null,
          data.promotedByName || null,
          data.promotedByEmail || null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async getPromoteLog(tenantId: string, templateId: string, limit: number = 50): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM prompt_promote_log
          WHERE template_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [templateId, limit]
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async upsertAiConfig(tenantId: string, config: any): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO enterprise_config (tenant_id, config_key, config_value, updated_at)
         VALUES ($1, 'ai_config', $2, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [tenantId, JSON.stringify(config)]
      );
      return result.rows[0]?.config_value || config;
    });
  }

  /**
   * Add spend atomically inside PostgreSQL. Reading config and writing it back
   * in application code loses increments when workers flush concurrently.
   */
  async incrementAiSpend(tenantId: string, amountUsd: number): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO enterprise_config
           (tenant_id, config_key, config_value, updated_at)
         VALUES (
           $1, 'ai_config',
           jsonb_build_object('enabled', true, 'currentSpendUsd', $2::numeric),
           CURRENT_TIMESTAMP
         )
         ON CONFLICT (tenant_id, config_key) DO UPDATE
           SET config_value = jsonb_set(
                 enterprise_config.config_value,
                 '{currentSpendUsd}',
                 to_jsonb(
                   COALESCE((enterprise_config.config_value->>'currentSpendUsd')::numeric, 0)
                   + $2::numeric
                 ),
                 true
               ),
               updated_at = CURRENT_TIMESTAMP
         RETURNING config_value`,
        [tenantId, amountUsd],
      );
      return result.rows[0]?.config_value;
    });
  }

  async recordAiSpendFlushAlert(
    tenantId: string,
    pendingAmountUsd: number,
    retryCount: number,
    failedAt: Date,
  ): Promise<void> {
    await this.withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO ai_spend_flush_alerts
           (tenant_id, pending_amount_usd, retry_count, first_failed_at, last_failed_at, resolved_at, updated_at)
         VALUES ($1, $2, $3, $4, $4, NULL, NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
           pending_amount_usd = EXCLUDED.pending_amount_usd,
           retry_count = EXCLUDED.retry_count,
           last_failed_at = EXCLUDED.last_failed_at,
           resolved_at = NULL,
           updated_at = NOW()`,
        [tenantId, pendingAmountUsd, retryCount, failedAt],
      );
    });
  }

  async resolveAiSpendFlushAlert(tenantId: string): Promise<void> {
    await this.withTenant(tenantId, async (client) => {
      await client.query(
        `UPDATE ai_spend_flush_alerts
            SET resolved_at = COALESCE(resolved_at, NOW()), updated_at = NOW()
          WHERE tenant_id = $1 AND resolved_at IS NULL`,
        [tenantId],
      );
    });
  }
}

export const aiGovernanceRepository = new AiGovernanceRepository();
