import { withTenantContext } from '../db';

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
}

export const companyBrainRepository = new CompanyBrainRepository();