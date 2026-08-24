import { BaseRepository } from './baseRepository';

export interface UnitRow {
  id: string;
  tenantId: string;
  code: string;
  tower: string;
  floor: number;
  bedroom: string;
  areaSqm: number;
  priceSqm: number;
  status: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

class UnitRepository extends BaseRepository {
  constructor() {
    super('units');
  }

  async list(
    tenantId: string,
    filters: { tower?: string; status?: string } = {},
  ): Promise<UnitRow[]> {
    return this.withTenant(tenantId, async (client) => {
      const params: any[] = [tenantId];
      let where = 'tenant_id = $1';
      if (filters.tower && filters.tower !== 'all') {
        params.push(filters.tower);
        where += ` AND tower = $${params.length}`;
      }
      if (filters.status && filters.status !== 'all') {
        params.push(filters.status);
        where += ` AND status = $${params.length}`;
      }
      const result = await client.query(
        `SELECT * FROM units WHERE ${where} ORDER BY tower ASC, floor ASC, code ASC`,
        params,
      );
      return this.rowsToEntities<UnitRow>(result.rows);
    });
  }

  async create(
    tenantId: string,
    d: { code: string; tower: string; floor: number; bedroom: string; areaSqm: number; priceSqm: number; status?: string; projectId?: string | null },
  ): Promise<UnitRow> {
    return this.withTenant(tenantId, async (client) => {
      if (d.projectId !== null && d.projectId !== undefined) {
        const project = await client.query(
          `SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2`,
          [d.projectId, tenantId],
        );
        if (project.rowCount === 0) {
          const error: any = new Error('Project does not belong to tenant');
          error.code = 'PROJECT_TENANT_MISMATCH';
          throw error;
        }
      }
      const result = await client.query(
        `INSERT INTO units (tenant_id, code, tower, floor, bedroom, area_sqm, price_sqm, status, project_id)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($8, 'available'), $9)
         RETURNING *`,
        [tenantId, d.code, d.tower, d.floor, d.bedroom, d.areaSqm, d.priceSqm, d.status ?? null, d.projectId ?? null],
      );
      return this.rowToEntity<UnitRow>(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, d: Record<string, any>): Promise<UnitRow | null> {
    return this.withTenant(tenantId, async (client) => {
      const allowed: Record<string, string> = {
        code: 'code', tower: 'tower', floor: 'floor', bedroom: 'bedroom',
        areaSqm: 'area_sqm', priceSqm: 'price_sqm', status: 'status', projectId: 'project_id',
      };
      const sets: string[] = [];
      const params: any[] = [];
      for (const [k, col] of Object.entries(allowed)) {
        if (d[k] !== undefined) {
          params.push(d[k]);
          sets.push(`${col} = $${params.length}`);
        }
      }
      if (sets.length === 0) return this.findById(tenantId, id);
      sets.push(`updated_at = NOW()`);
      params.push(id);
      params.push(tenantId);
      // Validate project ownership in the same tenant transaction before
      // changing the unit. This complements the composite database FK.
      if (d.projectId !== undefined && d.projectId !== null) {
        const project = await client.query(
          `SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2`,
          [d.projectId, tenantId],
        );
        if (project.rowCount === 0) {
          const error: any = new Error('Project does not belong to tenant');
          error.code = 'PROJECT_TENANT_MISMATCH';
          throw error;
        }
      }
      const result = await client.query(
        `UPDATE units SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
        params,
      );
      return result.rows[0] ? this.rowToEntity<UnitRow>(result.rows[0]) : null;
    });
  }
}

export const unitRepository = new UnitRepository();
