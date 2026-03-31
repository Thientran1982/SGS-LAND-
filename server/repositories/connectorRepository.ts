import { pool, withTenantContext } from '../db';
import { BaseRepository } from './baseRepository';

const ENSURE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS connector_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    watermark TEXT,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    connector_id UUID NOT NULL,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    records_processed INT NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`;

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  await pool.query(ENSURE_TABLES_SQL);
  tablesEnsured = true;
}

class ConnectorRepository extends BaseRepository {
  constructor() {
    super('connector_configs');
  }

  async listByTenant(tenantId: string): Promise<any[]> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM connector_configs ORDER BY created_at DESC`
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: { type: string; name: string; config: Record<string, unknown> }): Promise<any> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO connector_configs (tenant_id, type, name, config, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING *`,
        [tenantId, data.type, data.name, JSON.stringify(data.config)]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: Record<string, any>): Promise<any> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE connector_configs
         SET name = COALESCE($1, name),
             status = COALESCE($2, status),
             config = COALESCE($3, config),
             last_sync_at = COALESCE($4, last_sync_at),
             last_sync_status = COALESCE($5, last_sync_status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND tenant_id = $7
         RETURNING *`,
        [
          data.name ?? null,
          data.status ?? null,
          data.config ? JSON.stringify(data.config) : null,
          data.lastSyncAt ?? null,
          data.lastSyncStatus ?? null,
          id,
          tenantId,
        ]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM connector_configs WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async findById(tenantId: string, id: string): Promise<any | null> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM connector_configs WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

class SyncJobRepository extends BaseRepository {
  constructor() {
    super('sync_jobs');
  }

  async listByTenant(tenantId: string, limit = 50): Promise<any[]> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM sync_jobs ORDER BY started_at DESC LIMIT $1`,
        [limit]
      );
      return this.rowsToEntities<any>(result.rows).map(j => ({
        ...j,
        errors: Array.isArray(j.errors) ? j.errors : [],
      }));
    });
  }

  async create(tenantId: string, data: { connectorId: string; status?: string }): Promise<any> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO sync_jobs (tenant_id, connector_id, status, started_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [tenantId, data.connectorId, data.status ?? 'QUEUED']
      );
      const row = this.rowToEntity<any>(result.rows[0]);
      return { ...row, errors: [] };
    });
  }

  async update(tenantId: string, id: string, data: Record<string, any>): Promise<any> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE sync_jobs
         SET status = COALESCE($1, status),
             finished_at = COALESCE($2, finished_at),
             records_processed = COALESCE($3, records_processed),
             errors = COALESCE($4, errors),
             retry_count = COALESCE($5, retry_count),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND tenant_id = $7
         RETURNING *`,
        [
          data.status ?? null,
          data.finishedAt ?? null,
          data.recordsProcessed ?? null,
          data.errors ? JSON.stringify(data.errors) : null,
          data.retryCount ?? null,
          id,
          tenantId,
        ]
      );
      const row = result.rows[0] ? this.rowToEntity<any>(result.rows[0]) : null;
      return row ? { ...row, errors: Array.isArray(row.errors) ? row.errors : [] } : null;
    });
  }

  async findById(tenantId: string, id: string): Promise<any | null> {
    await ensureTables();
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM sync_jobs WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      if (!result.rows[0]) return null;
      const row = this.rowToEntity<any>(result.rows[0]);
      return { ...row, errors: Array.isArray(row.errors) ? row.errors : [] };
    });
  }
}

export const connectorRepository = new ConnectorRepository();
export const syncJobRepository = new SyncJobRepository();
