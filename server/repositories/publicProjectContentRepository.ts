import { BaseRepository } from './baseRepository';

class PublicProjectContentRepository extends BaseRepository {
  constructor() { super('public_project_contents'); }

  async findPublished(limit = 100) {
    return this.withTenant(null as any, async (client) => {
      const result = await client.query(
        `SELECT * FROM public_project_contents WHERE status = 'PUBLISHED'
         ORDER BY updated_at DESC LIMIT $1`, [limit],
      );
      return result.rows;
    });
  }

  async findForTenant(tenantId: string, id?: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        id
          ? 'SELECT * FROM public_project_contents WHERE tenant_id = $1 AND id = $2 LIMIT 1'
          : 'SELECT * FROM public_project_contents WHERE tenant_id = $1 ORDER BY updated_at DESC',
        id ? [tenantId, id] : [tenantId],
      );
      return id ? result.rows[0] || null : result.rows;
    });
  }

  async create(tenantId: string, userId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO public_project_contents
          (tenant_id, slug, name, content, status, created_by, updated_by, published_at)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$6,CASE WHEN $5='PUBLISHED' THEN NOW() ELSE NULL END)
         RETURNING *`,
        [tenantId, data.slug, data.name, JSON.stringify(data.content || {}), data.status || 'DRAFT', userId],
      );
      return result.rows[0];
    });
  }

  async update(tenantId: string, userId: string, id: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE public_project_contents
            SET slug = COALESCE($3, slug), name = COALESCE($4, name),
                content = COALESCE($5::jsonb, content), status = COALESCE($6, status),
                updated_by = $2, updated_at = NOW(),
                published_at = CASE WHEN $6 = 'PUBLISHED' THEN COALESCE(published_at, NOW())
                                    WHEN $6 = 'DRAFT' THEN NULL ELSE published_at END
          WHERE tenant_id = $1 AND id = $7
          RETURNING *`,
        [tenantId, userId, data.slug ?? null, data.name ?? null,
          data.content === undefined ? null : JSON.stringify(data.content), data.status ?? null, id],
      );
      return result.rows[0] || null;
    });
  }

  async remove(tenantId: string, id: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        'DELETE FROM public_project_contents WHERE tenant_id = $1 AND id = $2 RETURNING id',
        [tenantId, id],
      );
      return result.rowCount > 0;
    });
  }
}

export const publicProjectContentRepository = new PublicProjectContentRepository();