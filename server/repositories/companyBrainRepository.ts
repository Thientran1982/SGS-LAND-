import { withTenantContext } from '../db';
import { MARKETING_GROWTH_CAPABILITIES } from '../ai/marketingGrowthAgents';

export type CompanyBrainDocumentType =
  | 'brand_voice'
  | 'developer'
  | 'project'
  | 'legal_disclaimer'
  | 'broker'
  | 'faq'
  | 'competitor_note';

export type CompanyBrainDocument = {
  id?: string;
  documentType: CompanyBrainDocumentType;
  documentKey: string;
  content: Record<string, unknown>;
  source: string;
  sourceUrl?: string | null;
  verificationStatus: 'verified' | 'unverified' | 'needs_review' | 'stale';
  verifiedAt?: string | null;
};

class CompanyBrainRepository {
  async get(tenantId: string, documentType: CompanyBrainDocumentType, documentKey: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT id, document_type AS "documentType", document_key AS "documentKey",
                content_json AS content, source, source_url AS "sourceUrl",
                verification_status AS "verificationStatus", verified_at AS "verifiedAt",
                updated_at AS "updatedAt"
           FROM company_brain_documents
          WHERE tenant_id=$1 AND document_type=$2 AND document_key=$3
          LIMIT 1`,
        [tenantId, documentType, documentKey],
      );
      return result.rows[0] || null;
    });
  }

  async list(tenantId: string, documentType?: CompanyBrainDocumentType) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT id, document_type AS "documentType", document_key AS "documentKey",
                content_json AS content, source, source_url AS "sourceUrl",
                verification_status AS "verificationStatus", verified_at AS "verifiedAt",
                updated_at AS "updatedAt"
           FROM company_brain_documents
          WHERE tenant_id=$1 AND ($2::text IS NULL OR document_type=$2)
          ORDER BY document_type, document_key`,
        [tenantId, documentType || null],
      );
      return result.rows;
    });
  }

  async upsert(tenantId: string, document: CompanyBrainDocument, updatedBy?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `INSERT INTO company_brain_documents
          (tenant_id, document_type, document_key, content_json, source, source_url,
           verification_status, verified_at, updated_by)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
         ON CONFLICT (tenant_id, document_type, document_key) DO UPDATE SET
           content_json=EXCLUDED.content_json, source=EXCLUDED.source,
           source_url=EXCLUDED.source_url, verification_status=EXCLUDED.verification_status,
           verified_at=EXCLUDED.verified_at, updated_by=EXCLUDED.updated_by,
           updated_at=NOW()
         RETURNING id, document_type AS "documentType", document_key AS "documentKey",
                   content_json AS content, source, source_url AS "sourceUrl",
                   verification_status AS "verificationStatus", verified_at AS "verifiedAt",
                   updated_at AS "updatedAt"`,
        [
          tenantId, document.documentType, document.documentKey,
          JSON.stringify(document.content || {}), document.source || 'internal',
          document.sourceUrl || null, document.verificationStatus || 'unverified',
          document.verifiedAt || null, updatedBy || null,
        ],
      );
      return result.rows[0];
    });
  }

  async update(
    tenantId: string,
    id: string,
    document: Omit<CompanyBrainDocument, 'id'>,
    updatedBy?: string,
  ) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE company_brain_documents
            SET document_type=$3, document_key=$4, content_json=$5::jsonb,
                source=$6, source_url=$7, verification_status=$8,
                verified_at=CASE WHEN $8='verified' THEN COALESCE(verified_at, NOW()) ELSE NULL END,
                updated_by=$9, updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2
          RETURNING id, document_type AS "documentType", document_key AS "documentKey",
                    content_json AS content, source, source_url AS "sourceUrl",
                    verification_status AS "verificationStatus", verified_at AS "verifiedAt",
                    updated_at AS "updatedAt"`,
        [
          tenantId, id, document.documentType, document.documentKey,
          JSON.stringify(document.content || {}), document.source,
          document.sourceUrl || null, document.verificationStatus,
          updatedBy || null,
        ],
      );
      return result.rows[0] || null;
    });
  }

  async listCapabilityStatus(tenantId: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT capability_key AS "capabilityKey", role, cadence, rollout, active,
                prompt_version AS "promptVersion", metadata_json AS metadata,
                updated_at AS "updatedAt"
           FROM marketing_growth_capabilities
          WHERE tenant_id=$1
          ORDER BY capability_key`,
        [tenantId],
      );
      const configured = new Map(result.rows.map(row => [row.capabilityKey, row]));
      return MARKETING_GROWTH_CAPABILITIES.map(capability => ({
        capabilityKey: capability.capabilityKey,
        displayName: capability.displayName,
        role: capability.role,
        cadence: capability.cadence,
        requiresHumanApproval: capability.requiresHumanApproval,
        rollout: configured.get(capability.capabilityKey)?.rollout || 'SHADOW',
        active: configured.get(capability.capabilityKey)?.active ?? true,
        promptVersion: configured.get(capability.capabilityKey)?.promptVersion || 'v1',
        updatedAt: configured.get(capability.capabilityKey)?.updatedAt || null,
      }));
    });
  }

  async updateCapabilityStatus(
    tenantId: string,
    capabilityKey: string,
    patch: { rollout?: 'SHADOW' | 'CANARY_25' | 'CANARY_50' | 'LIVE'; active?: boolean },
  ) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE marketing_growth_capabilities
            SET rollout=COALESCE($3, rollout), active=COALESCE($4, active), updated_at=NOW()
          WHERE tenant_id=$1 AND capability_key=$2
          RETURNING capability_key AS "capabilityKey", role, cadence, rollout, active,
                    prompt_version AS "promptVersion", updated_at AS "updatedAt"`,
        [tenantId, capabilityKey, patch.rollout || null, patch.active ?? null],
      );
      return result.rows[0] || null;
    });
  }

  async updateVerificationStatus(
    tenantId: string,
    id: string,
    status: CompanyBrainDocument['verificationStatus'],
    updatedBy?: string,
  ) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE company_brain_documents
            SET verification_status=$3,
                verified_at=CASE WHEN $3='verified' THEN NOW() ELSE verified_at END,
                updated_by=$4, updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2
          RETURNING id, document_type AS "documentType", document_key AS "documentKey",
                    source, source_url AS "sourceUrl",
                    verification_status AS "verificationStatus", verified_at AS "verifiedAt",
                    updated_at AS "updatedAt"`,
        [tenantId, id, status, updatedBy || null],
      );
      return result.rows[0] || null;
    });
  }
}

export const companyBrainRepository = new CompanyBrainRepository();