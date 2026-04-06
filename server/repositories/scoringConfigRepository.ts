import { BaseRepository } from './baseRepository';

const DEFAULT_WEIGHTS = { engagement: 15, completeness: 10, budgetFit: 40, velocity: 10 };
const DEFAULT_THRESHOLDS = { A: 80, B: 60, C: 40, D: 20 };

class ScoringConfigRepository extends BaseRepository {
  constructor() {
    super('scoring_configs');
  }

  private async ensureVersionColumn(client: any): Promise<void> {
    await client.query(
      `ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`
    );
  }

  async getByTenant(tenantId: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      await this.ensureVersionColumn(client);
      const result = await client.query(
        `SELECT * FROM ${this.tableName} LIMIT 1`
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async upsert(tenantId: string, data: { weights: any; thresholds: any }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      await this.ensureVersionColumn(client);
      const existing = await client.query(
        `SELECT id, version FROM ${this.tableName} LIMIT 1`
      );

      if (existing.rows.length > 0) {
        const nextVersion = (existing.rows[0].version || 1) + 1;
        const result = await client.query(
          `UPDATE ${this.tableName}
           SET weights = $1, thresholds = $2, updated_at = CURRENT_TIMESTAMP, version = $4
           WHERE id = $3
           RETURNING *`,
          [JSON.stringify(data.weights), JSON.stringify(data.thresholds), existing.rows[0].id, nextVersion]
        );
        return this.rowToEntity(result.rows[0]);
      } else {
        const result = await client.query(
          `INSERT INTO ${this.tableName} (tenant_id, weights, thresholds, version)
           VALUES ($1, $2, $3, 1)
           RETURNING *`,
          [tenantId, JSON.stringify(data.weights), JSON.stringify(data.thresholds)]
        );
        return this.rowToEntity(result.rows[0]);
      }
    });
  }
}

export const scoringConfigRepository = new ScoringConfigRepository();
export { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS };
