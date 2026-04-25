import { pool } from '../db';

export interface PriceMatrixRow {
  id: string;
  tenant_id: string;
  project_id: string;
  tower?: string | null;
  floor_from: number;
  floor_to: number;
  direction: string;
  bedroom_type: string;
  base_price_sqm: number;
  adjustment_pct: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
}

export interface PriceMatrixInput {
  tower?: string;
  floor_from: number;
  floor_to: number;
  direction: string;
  bedroom_type: string;
  base_price_sqm: number;
  adjustment_pct: number;
  notes?: string;
  updated_by?: string;
}

export const projectPriceMatrixRepository = {
  async findByProject(tenantId: string, projectId: string): Promise<PriceMatrixRow[]> {
    const { rows } = await pool.query(
      `SELECT * FROM project_price_matrix
       WHERE tenant_id = $1 AND project_id = $2
       ORDER BY tower NULLS FIRST, floor_from ASC, direction ASC, bedroom_type ASC`,
      [tenantId, projectId]
    );
    return rows;
  },

  async upsertRow(tenantId: string, projectId: string, input: PriceMatrixInput): Promise<PriceMatrixRow> {
    const { rows } = await pool.query(
      `INSERT INTO project_price_matrix
         (tenant_id, project_id, tower, floor_from, floor_to, direction, bedroom_type,
          base_price_sqm, adjustment_pct, notes, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        tenantId, projectId,
        input.tower ?? null,
        input.floor_from, input.floor_to,
        input.direction, input.bedroom_type,
        Math.round(input.base_price_sqm),
        input.adjustment_pct,
        input.notes ?? null,
        input.updated_by ?? null,
      ]
    );
    return rows[0];
  },

  async updateRow(tenantId: string, id: string, input: Partial<PriceMatrixInput>): Promise<PriceMatrixRow | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: any[] = [tenantId, id];
    let p = 3;

    if (input.tower !== undefined)       { sets.push(`tower = $${p++}`);          vals.push(input.tower ?? null); }
    if (input.floor_from !== undefined)  { sets.push(`floor_from = $${p++}`);     vals.push(input.floor_from); }
    if (input.floor_to !== undefined)    { sets.push(`floor_to = $${p++}`);       vals.push(input.floor_to); }
    if (input.direction !== undefined)   { sets.push(`direction = $${p++}`);      vals.push(input.direction); }
    if (input.bedroom_type !== undefined){ sets.push(`bedroom_type = $${p++}`);   vals.push(input.bedroom_type); }
    if (input.base_price_sqm !== undefined){ sets.push(`base_price_sqm = $${p++}`); vals.push(Math.round(input.base_price_sqm)); }
    if (input.adjustment_pct !== undefined){ sets.push(`adjustment_pct = $${p++}`); vals.push(input.adjustment_pct); }
    if (input.notes !== undefined)       { sets.push(`notes = $${p++}`);          vals.push(input.notes ?? null); }
    if (input.updated_by !== undefined)  { sets.push(`updated_by = $${p++}`);     vals.push(input.updated_by ?? null); }

    const { rows } = await pool.query(
      `UPDATE project_price_matrix SET ${sets.join(', ')}
       WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      vals
    );
    return rows[0] ?? null;
  },

  async deleteRow(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM project_price_matrix WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return (rowCount ?? 0) > 0;
  },

  async deleteByProject(tenantId: string, projectId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `DELETE FROM project_price_matrix WHERE tenant_id = $1 AND project_id = $2`,
      [tenantId, projectId]
    );
    return rowCount ?? 0;
  },

  async lookupPrice(tenantId: string, projectId: string, opts: {
    floor?: number; direction?: string; bedroomType?: string; tower?: string;
  }): Promise<{ base_price_sqm: number; adjustment_pct: number; effective_price_sqm: number } | null> {
    const { floor = 1, direction = 'ALL', bedroomType = 'ALL', tower } = opts;
    const { rows } = await pool.query(
      `SELECT base_price_sqm, adjustment_pct
       FROM project_price_matrix
       WHERE tenant_id = $1 AND project_id = $2
         AND floor_from <= $3 AND floor_to >= $3
         AND (direction = $4 OR direction = 'ALL')
         AND (bedroom_type = $5 OR bedroom_type = 'ALL')
         AND ($6::varchar IS NULL OR tower = $6 OR tower IS NULL)
       ORDER BY
         CASE WHEN direction = $4 THEN 0 ELSE 1 END,
         CASE WHEN bedroom_type = $5 THEN 0 ELSE 1 END,
         CASE WHEN tower = $6 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tenantId, projectId, floor, direction, bedroomType, tower ?? null]
    );
    if (!rows[0]) return null;
    const base = Number(rows[0].base_price_sqm);
    const adj = Number(rows[0].adjustment_pct);
    return {
      base_price_sqm: base,
      adjustment_pct: adj,
      effective_price_sqm: Math.round(base * (1 + adj / 100)),
    };
  },
};
