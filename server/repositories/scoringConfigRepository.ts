import { BaseRepository } from './baseRepository';

class ScoringConfigRepository extends BaseRepository {
  constructor() {
    super('scoring_configs');
  }

  async getByTenant(tenantId: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM ${this.tableName} LIMIT 1`
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async upsert(tenantId: string, data: { weights: any; thresholds: any }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const existing = await client.query(
        `SELECT id FROM ${this.tableName} LIMIT 1`
      );

      if (existing.rows.length > 0) {
        const result = await client.query(
          `UPDATE ${this.tableName}
           SET weights = $1, thresholds = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [JSON.stringify(data.weights), JSON.stringify(data.thresholds), existing.rows[0].id]
        );
        return this.rowToEntity(result.rows[0]);
      } else {
        const result = await client.query(
          `INSERT INTO ${this.tableName} (tenant_id, weights, thresholds)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [tenantId, JSON.stringify(data.weights), JSON.stringify(data.thresholds)]
        );
        return this.rowToEntity(result.rows[0]);
      }
    });
  }
}

export const scoringConfigRepository = new ScoringConfigRepository();
