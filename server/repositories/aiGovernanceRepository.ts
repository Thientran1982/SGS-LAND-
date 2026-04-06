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
}

export const aiGovernanceRepository = new AiGovernanceRepository();
