import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

export interface ProjectFilters {
    status?: string;
    search?: string;
}

export class ProjectRepository extends BaseRepository {
    constructor() {
        super('projects');
    }

    // -------------------------------------------------------------------------
    // Projects
    // -------------------------------------------------------------------------

    async findProjects(
        tenantId: string,
        pagination: PaginationParams,
        filters?: ProjectFilters
    ): Promise<PaginatedResult<any>> {
        return this.withTenant(tenantId, async (client) => {
            const conditions: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (filters?.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }
            if (filters?.search) {
                conditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex} OR location ILIKE $${paramIndex})`);
                values.push(`%${filters.search}%`);
                paramIndex++;
            }

            const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const offset = (pagination.page - 1) * pagination.pageSize;

            const countResult = await client.query(`SELECT COUNT(*)::int FROM projects ${where}`, values);
            const total = countResult.rows[0].count;

            const dataResult = await client.query(
                `SELECT p.*,
                    (SELECT COUNT(*)::int FROM project_access pa WHERE pa.project_id = p.id AND pa.status = 'ACTIVE') AS partner_count,
                    (SELECT COUNT(*)::int FROM listings l WHERE l.project_id = p.id) AS listing_count
                 FROM projects p ${where}
                 ORDER BY p.created_at DESC
                 LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...values, pagination.pageSize, offset]
            );

            const totalPages = Math.ceil(total / pagination.pageSize) || 1;
            return { data: this.rowsToEntities(dataResult.rows), total, page: pagination.page, pageSize: pagination.pageSize, totalPages };
        });
    }

    // Find projects accessible by a partner tenant (via project_access).
    // Cross-tenant đọc hợp pháp: dùng RLS bypass có kiểm soát, ràng buộc bằng partner_tenant_id.
    async findAccessibleProjects(partnerTenantId: string): Promise<any[]> {
        const { withRlsBypass } = await import('../db');
        return withRlsBypass(async (client) => {
            const result = await client.query(
                `SELECT p.*, pa.granted_at, pa.expires_at, pa.note as access_note,
                        t.name as developer_name
                 FROM project_access pa
                 JOIN projects p ON p.id = pa.project_id
                 JOIN tenants t ON t.id = p.tenant_id
                 WHERE pa.partner_tenant_id = $1
                   AND pa.status = 'ACTIVE'
                   AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
                   AND p.status = 'ACTIVE'
                 ORDER BY p.name ASC`,
                [partnerTenantId]
            );
            return result.rows;
        });
    }

    async findById(tenantId: string, id: string): Promise<any | null> {
        return this.withTenant(tenantId, async (client) => {
            const result = await client.query(
                `SELECT p.*,
                    (SELECT COUNT(*)::int FROM listings l WHERE l.project_id = p.id) AS listing_count
                 FROM projects p
                 WHERE p.id = $1 AND p.tenant_id = $2`,
                [id, tenantId]
            );
            return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
        });
    }

    async create(tenantId: string, data: {
        name: string;
        code?: string;
        description?: string;
        location?: string;
        totalUnits?: number;
        status?: string;
        openDate?: string;
        handoverDate?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any> {
        return this.withTenant(tenantId, async (client) => {
            const result = await client.query(
                `INSERT INTO projects (tenant_id, name, code, description, location, total_units, status, open_date, handover_date, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    tenantId,
                    data.name,
                    data.code || null,
                    data.description || null,
                    data.location || null,
                    data.totalUnits || null,
                    data.status || 'ACTIVE',
                    data.openDate || null,
                    data.handoverDate || null,
                    JSON.stringify(data.metadata || {}),
                ]
            );
            return this.rowToEntity(result.rows[0]);
        });
    }

    async update(tenantId: string, id: string, data: Partial<{
        name: string;
        code: string;
        description: string;
        location: string;
        totalUnits: number;
        status: string;
        openDate: string;
        handoverDate: string;
        metadata: Record<string, unknown>;
    }>): Promise<any | null> {
        return this.withTenant(tenantId, async (client) => {
            const sets: string[] = [];
            const values: any[] = [];
            let i = 1;

            if (data.name !== undefined)        { sets.push(`name = $${i++}`);          values.push(data.name); }
            if (data.code !== undefined)        { sets.push(`code = $${i++}`);          values.push(data.code); }
            if (data.description !== undefined) { sets.push(`description = $${i++}`);   values.push(data.description); }
            if (data.location !== undefined)    { sets.push(`location = $${i++}`);      values.push(data.location); }
            if (data.totalUnits !== undefined)  { sets.push(`total_units = $${i++}`);   values.push(data.totalUnits); }
            if (data.status !== undefined)      { sets.push(`status = $${i++}`);        values.push(data.status); }
            if (data.openDate !== undefined)    { sets.push(`open_date = $${i++}`);     values.push(data.openDate); }
            if (data.handoverDate !== undefined){ sets.push(`handover_date = $${i++}`); values.push(data.handoverDate); }
            // Metadata is JSONB-merged (concurrent-safe) + null-stripped:
            // sending `{ key: null }` removes that key, omitted keys stay intact,
            // and present keys overwrite. Avoids clobbering fields written by
            // parallel flows (e.g. cover-image upload vs Drive URL edit).
            //
            // ⚠ SEMANTIC CHANGE (was: full replace) — callers that previously
            // relied on `update({ metadata: {...} })` to wipe all unrelated
            // metadata keys must now send explicit `null` for each key they
            // want removed. All current call-sites already follow the
            // patch-with-explicit-nulls convention (Projects.tsx
            // ProjectFormModal sends `{ coverImage, cover_image: null,
            // driveUrl: null, ... }`).
            if (data.metadata !== undefined) {
                sets.push(`metadata = jsonb_strip_nulls(COALESCE(metadata, '{}'::jsonb) || $${i++}::jsonb)`);
                values.push(JSON.stringify(data.metadata));
            }

            if (sets.length === 0) return null;
            sets.push(`updated_at = NOW()`);

            values.push(id, tenantId);
            const result = await client.query(
                `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
                values
            );
            return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
        });
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        return this.withTenant(tenantId, async (client) => {
            const result = await client.query(
                `DELETE FROM projects WHERE id = $1 AND tenant_id = $2`,
                [id, tenantId]
            );
            return (result.rowCount ?? 0) > 0;
        });
    }

    // -------------------------------------------------------------------------
    // Project Access (B2B2C: grant broker/exchange access to projects)
    // -------------------------------------------------------------------------

    async getProjectAccess(tenantId: string, projectId: string): Promise<any[]> {
        return this.withTenant(tenantId, async (client) => {
            const result = await client.query(
                `SELECT pa.*, t.name as partner_tenant_name, t.domain as partner_tenant_domain
                 FROM project_access pa
                 JOIN tenants t ON t.id = pa.partner_tenant_id
                 WHERE pa.project_id = $1
                 ORDER BY pa.granted_at DESC`,
                [projectId]
            );
            return result.rows;
        });
    }

    async grantAccess(tenantId: string, data: {
        projectId: string;
        partnerTenantId: string;
        grantedBy: string;
        expiresAt?: string;
        note?: string;
    }): Promise<any> {
        return this.withTenant(tenantId, async (client) => {
            // Verify project belongs to this tenant
            const projectCheck = await client.query(
                `SELECT id FROM projects WHERE id = $1 AND tenant_id = $2`,
                [data.projectId, tenantId]
            );
            if (!projectCheck.rows[0]) throw new Error('Project not found or access denied');

            // Verify partner tenant exists
            const partnerCheck = await client.query(
                `SELECT id, name, domain FROM tenants WHERE id = $1`,
                [data.partnerTenantId]
            );
            if (!partnerCheck.rows[0]) throw new Error('Partner tenant not found');

            const result = await client.query(
                `INSERT INTO project_access (project_id, partner_tenant_id, granted_by, expires_at, note, status)
                 VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
                 ON CONFLICT (project_id, partner_tenant_id)
                 DO UPDATE SET status = 'ACTIVE', expires_at = $4, note = $5, granted_by = $3, granted_at = NOW()
                 RETURNING *`,
                [data.projectId, data.partnerTenantId, data.grantedBy, data.expiresAt || null, data.note || null]
            );
            return { ...result.rows[0], partner_tenant_name: partnerCheck.rows[0].name, partner_tenant_domain: partnerCheck.rows[0].domain };
        });
    }

    async revokeAccess(tenantId: string, projectId: string, partnerTenantId: string): Promise<boolean> {
        return this.withTenant(tenantId, async (client) => {
            const result = await client.query(
                `UPDATE project_access SET status = 'REVOKED'
                 WHERE project_id = $1 AND partner_tenant_id = $2
                   AND project_id IN (SELECT id FROM projects WHERE tenant_id = $3)`,
                [projectId, partnerTenantId, tenantId]
            );
            return (result.rowCount ?? 0) > 0;
        });
    }

    // Check if partner has access to a specific project
    async checkPartnerAccess(partnerTenantId: string, projectId: string): Promise<boolean> {
        // This query runs outside tenant context (cross-tenant check)
        const { pool } = await import('../db');
        const result = await pool.query(
            `SELECT 1 FROM project_access
             WHERE project_id = $1 AND partner_tenant_id = $2
               AND status = 'ACTIVE'
               AND (expires_at IS NULL OR expires_at > NOW())`,
            [projectId, partnerTenantId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // Get all tenants (for dropdown when granting access)
    async listTenants(excludeTenantId?: string): Promise<any[]> {
        const { pool } = await import('../db');
        const result = await pool.query(
            `SELECT id, name, domain FROM tenants WHERE id != $1 ORDER BY name ASC`,
            [excludeTenantId || '00000000-0000-0000-0000-000000000000']
        );
        return result.rows;
    }

    // -------------------------------------------------------------------------
    // Listing Access (B2B2C: per-listing partner view permission)
    // -------------------------------------------------------------------------

    // Get all listing_access grants for a specific listing (cross-tenant)
    async getListingAccess(listingId: string): Promise<any[]> {
        const { pool } = await import('../db');
        const result = await pool.query(
            `SELECT la.*, t.name as partner_tenant_name, t.domain as partner_tenant_domain
             FROM listing_access la
             JOIN tenants t ON t.id = la.partner_tenant_id
             WHERE la.listing_id = $1
             ORDER BY la.granted_at DESC`,
            [listingId]
        );
        return result.rows;
    }

    // Grant a partner tenant access to a specific listing
    async grantListingAccess(data: {
        listingId: string;
        partnerTenantId: string;
        grantedBy: string;
        expiresAt?: string;
        note?: string;
    }): Promise<any> {
        const { pool } = await import('../db');

        const partnerCheck = await pool.query(
            `SELECT id, name, domain FROM tenants WHERE id = $1`,
            [data.partnerTenantId]
        );
        if (!partnerCheck.rows[0]) throw new Error('Partner tenant not found');

        const result = await pool.query(
            `INSERT INTO listing_access (listing_id, partner_tenant_id, granted_by, expires_at, note, status)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
             ON CONFLICT (listing_id, partner_tenant_id)
             DO UPDATE SET status = 'ACTIVE', expires_at = $4, note = $5, granted_by = $3, granted_at = NOW()
             RETURNING *`,
            [data.listingId, data.partnerTenantId, data.grantedBy, data.expiresAt || null, data.note || null]
        );
        return {
            ...result.rows[0],
            partner_tenant_name: partnerCheck.rows[0].name,
            partner_tenant_domain: partnerCheck.rows[0].domain,
        };
    }

    // Revoke a partner tenant's access to a specific listing
    async revokeListingAccess(listingId: string, partnerTenantId: string): Promise<boolean> {
        const { pool } = await import('../db');
        const result = await pool.query(
            `UPDATE listing_access SET status = 'REVOKED'
             WHERE listing_id = $1 AND partner_tenant_id = $2`,
            [listingId, partnerTenantId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // Check if a partner has explicit listing_access for a specific listing
    async checkPartnerListingAccess(partnerTenantId: string, listingId: string): Promise<boolean> {
        const { pool } = await import('../db');
        const result = await pool.query(
            `SELECT 1 FROM listing_access
             WHERE listing_id = $1 AND partner_tenant_id = $2
               AND status = 'ACTIVE'
               AND (expires_at IS NULL OR expires_at > NOW())`,
            [listingId, partnerTenantId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}

export const projectRepository = new ProjectRepository();
