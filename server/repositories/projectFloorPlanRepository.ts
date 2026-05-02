import { pool } from '../db';

export interface FloorPlanRow {
  id: string;
  tenant_id: string;
  project_id: string;
  tower: string;
  floor: string;
  svg_url: string;
  svg_filename: string;
  parsed_codes: string[];
  notes?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FloorPlanInput {
  tower: string;
  floor: string;
  svgUrl: string;
  svgFilename: string;
  parsedCodes: string[];
  notes?: string | null;
  uploadedBy?: string | null;
}

function normTower(v: string | null | undefined): string {
  const s = (v ?? '').toString().trim();
  return s.length === 0 ? 'ALL' : s.slice(0, 50);
}
function normFloor(v: string | null | undefined): string {
  const s = (v ?? '').toString().trim();
  return s.length === 0 ? 'ALL' : s.slice(0, 20);
}

export const projectFloorPlanRepository = {
  normTower,
  normFloor,

  async findByProject(tenantId: string, projectId: string): Promise<FloorPlanRow[]> {
    const { rows } = await pool.query(
      `SELECT * FROM project_floor_plans
       WHERE tenant_id = $1 AND project_id = $2
       ORDER BY tower ASC, floor ASC`,
      [tenantId, projectId],
    );
    return rows;
  },

  async findById(tenantId: string, id: string): Promise<FloorPlanRow | null> {
    const { rows } = await pool.query(
      `SELECT * FROM project_floor_plans
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return rows[0] ?? null;
  },

  async findByTowerFloor(
    tenantId: string,
    projectId: string,
    tower: string,
    floor: string,
  ): Promise<FloorPlanRow | null> {
    const { rows } = await pool.query(
      `SELECT * FROM project_floor_plans
       WHERE tenant_id = $1 AND project_id = $2 AND tower = $3 AND floor = $4`,
      [tenantId, projectId, normTower(tower), normFloor(floor)],
    );
    return rows[0] ?? null;
  },

  async upsert(
    tenantId: string,
    projectId: string,
    input: FloorPlanInput,
  ): Promise<FloorPlanRow> {
    const tower = normTower(input.tower);
    const floor = normFloor(input.floor);
    const { rows } = await pool.query(
      `INSERT INTO project_floor_plans
         (tenant_id, project_id, tower, floor, svg_url, svg_filename, parsed_codes, notes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT (project_id, tower, floor) DO UPDATE SET
         svg_url       = EXCLUDED.svg_url,
         svg_filename  = EXCLUDED.svg_filename,
         parsed_codes  = EXCLUDED.parsed_codes,
         notes         = EXCLUDED.notes,
         uploaded_by   = EXCLUDED.uploaded_by,
         updated_at    = NOW()
       RETURNING *`,
      [
        tenantId,
        projectId,
        tower,
        floor,
        input.svgUrl,
        input.svgFilename,
        JSON.stringify(input.parsedCodes ?? []),
        input.notes ?? null,
        input.uploadedBy ?? null,
      ],
    );
    return rows[0];
  },

  /**
   * Lightweight listing query specifically for the floor-plan mapping surface:
   * fetches every listing of a project that the *owner tenant* can see.
   * The listing repository's findListings() only filters by project_code, but
   * some seeded listings only have project_id set — this helper handles both.
   * RLS scoping is enforced via WHERE tenant_id = $1 (the row is owned by
   * the same tenant that owns the project).
   */
  async findOwnerListingsForProject(
    tenantId: string,
    projectId: string,
  ): Promise<Array<{
    id: string; code: string; status: string;
    tower: string | null; floor: string | null;
    area: number | null; price: number | null; title: string | null;
  }>> {
    const { rows } = await pool.query(
      `SELECT l.id,
              UPPER(COALESCE(l.code, '')) AS code,
              l.status,
              l.title,
              l.area,
              l.price,
              l.attributes->>'tower' AS tower,
              l.attributes->>'floor' AS floor
         FROM listings l
        WHERE l.tenant_id = $1
          AND (
            l.project_id = $2
            OR (l.project_id IS NULL
                AND l.project_code IS NOT NULL
                AND l.project_code = (SELECT code FROM projects WHERE id = $2))
          )
          AND COALESCE(l.code, '') <> ''`,
      [tenantId, projectId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      tower: r.tower ?? null,
      floor: r.floor != null ? String(r.floor) : null,
      area: r.area != null ? Number(r.area) : null,
      price: r.price != null ? Number(r.price) : null,
      title: r.title ?? null,
    }));
  },

  async deleteById(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM project_floor_plans WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return (rowCount ?? 0) > 0;
  },
};
