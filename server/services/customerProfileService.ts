import { withTenantContext } from '../db';

export const PROFILE_CATEGORIES = new Set([
  'budget', 'preference_location', 'purpose', 'purchase_timeline', 'property_need', 'constraint', 'other',
]);
export const PROFILE_CONSENTS = new Set(['PENDING', 'OPTED_IN', 'OPTED_OUT']);

export function normalizeProfileFact(input: any): {
  fact: string; category: string; source: string; sensitive: boolean; confidence: number;
} {
  const fact = String(input?.fact || '').trim();
  const category = String(input?.category || '').trim();
  const source = String(input?.source || '').trim();
  const confidence = Number(input?.confidence ?? 0.5);
  if (!fact || fact.length > 1000) throw new Error('fact is required and must be at most 1000 characters');
  if (!PROFILE_CATEGORIES.has(category)) throw new Error('Invalid customer profile fact category');
  if (!source || source.length > 500) throw new Error('source is required and must be at most 500 characters');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('confidence must be between 0 and 1');
  return { fact, category, source, sensitive: input?.sensitive === true, confidence };
}

async function audit(client: any, tenantId: string, customerId: string, action: string, actorId: string | undefined, details: any = {}) {
  await client.query(
    `INSERT INTO customer_profile_erasure_audit (tenant_id, customer_id, action, actor_id, details_json)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [tenantId, customerId, action, actorId || null, JSON.stringify(details)],
  );
}

export const customerProfileService = {
  async getOrCreate(tenantId: string, customerId: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `INSERT INTO customer_profiles (tenant_id, customer_id)
         VALUES ($1,$2)
         ON CONFLICT (tenant_id, customer_id) DO UPDATE SET updated_at=NOW()
         RETURNING *`,
        [tenantId, customerId],
      );
      return result.rows[0];
    });
  },

  async getProfile(tenantId: string, customerId: string, includeSensitive = false) {
    return withTenantContext(tenantId, async client => {
      const profileResult = await client.query(
        'SELECT * FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2',
        [tenantId, customerId],
      );
      if (!profileResult.rows[0]) return null;
      const profile = profileResult.rows[0];
      const facts = await client.query(
        `SELECT id, fact, category, source, valid_from, valid_until, superseded_by, confidence, created_at
         FROM customer_profile_facts
         WHERE tenant_id=$1 AND profile_id=$2
           AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
           AND ($3 OR sensitive=false)
         ORDER BY created_at DESC`,
        [tenantId, profile.id, includeSensitive],
      );
      const outcomes = await client.query(
        `SELECT id, action_taken, result, learning, created_at
         FROM customer_profile_outcomes WHERE tenant_id=$1 AND profile_id=$2
         ORDER BY created_at DESC LIMIT 100`,
        [tenantId, profile.id],
      );
      return { ...profile, facts: facts.rows, interaction_outcomes: outcomes.rows };
    });
  },

  async setConsent(tenantId: string, customerId: string, consent: string, actorId?: string, version = 'customer-profile-v1') {
    if (!PROFILE_CONSENTS.has(consent)) throw new Error('Invalid customer profile consent');
    return withTenantContext(tenantId, async client => {
      await client.query(
        `INSERT INTO customer_profiles (tenant_id, customer_id, remember_consent, consent_version, consent_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (tenant_id, customer_id) DO UPDATE SET
           remember_consent=EXCLUDED.remember_consent, consent_version=EXCLUDED.consent_version,
           consent_at=NOW(), updated_at=NOW()`,
        [tenantId, customerId, consent, version],
      );
      await audit(client, tenantId, customerId, 'CONSENT_CHANGED', actorId, { consent, version });
      return this.getProfileInTransaction(client, tenantId, customerId);
    });
  },

  async addFact(tenantId: string, customerId: string, input: any, actorId?: string) {
    const fact = normalizeProfileFact(input);
    return withTenantContext(tenantId, async client => {
      const profile = await client.query(
        `SELECT * FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2 FOR UPDATE`,
        [tenantId, customerId],
      );
      if (!profile.rows[0] || profile.rows[0].remember_consent !== 'OPTED_IN') {
        throw new Error('Customer profile consent is required');
      }
      const previous = await client.query(
        `SELECT id FROM customer_profile_facts
         WHERE tenant_id=$1 AND profile_id=$2 AND category=$3
           AND valid_until IS NULL AND sensitive=$4
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, profile.rows[0].id, fact.category, fact.sensitive],
      );
      const created = await client.query(
        `INSERT INTO customer_profile_facts
         (tenant_id, profile_id, fact, category, source, sensitive, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [tenantId, profile.rows[0].id, fact.fact, fact.category, fact.source, fact.sensitive, fact.confidence],
      );
      if (previous.rows[0]) {
        await client.query(
          `UPDATE customer_profile_facts SET valid_until=CURRENT_DATE, superseded_by=$3
           WHERE tenant_id=$1 AND id=$2`,
          [tenantId, previous.rows[0].id, created.rows[0].id],
        );
      }
      await client.query('UPDATE customer_profiles SET updated_at=NOW() WHERE tenant_id=$1 AND id=$2', [tenantId, profile.rows[0].id]);
      return created.rows[0];
    });
  },

  async recordOutcome(tenantId: string, customerId: string, input: any) {
    const action = String(input?.actionTaken || '').trim();
    const result = String(input?.result || '').trim();
    if (!action || !result || action.length > 500 || result.length > 500) throw new Error('actionTaken and result are required');
    return withTenantContext(tenantId, async client => {
      const profile = await client.query('SELECT id, remember_consent FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2', [tenantId, customerId]);
      if (!profile.rows[0] || profile.rows[0].remember_consent !== 'OPTED_IN') throw new Error('Customer profile consent is required');
      return (await client.query(
        `INSERT INTO customer_profile_outcomes (tenant_id, profile_id, action_taken, result, learning)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tenantId, profile.rows[0].id, action, result, typeof input.learning === 'string' ? input.learning.slice(0, 1000) : null],
      )).rows[0];
    });
  },

  async erase(tenantId: string, customerId: string, actorId?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query('DELETE FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2 RETURNING id', [tenantId, customerId]);
      if (result.rows[0]) await audit(client, tenantId, customerId, 'PROFILE_ERASED', actorId);
      return Boolean(result.rows[0]);
    });
  },

  async purgeExpired(tenantId: string, actorId?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `DELETE FROM customer_profile_facts f
         WHERE f.tenant_id=$1 AND f.valid_until < CURRENT_DATE
         RETURNING f.profile_id`,
        [tenantId],
      );
      if (result.rowCount) {
        const profiles = [...new Set(result.rows.map((row: any) => row.profile_id))];
        for (const profileId of profiles) {
          const p = await client.query('SELECT customer_id FROM customer_profiles WHERE tenant_id=$1 AND id=$2', [tenantId, profileId]);
          if (p.rows[0]) await audit(client, tenantId, p.rows[0].customer_id, 'RETENTION_PURGED', actorId, { facts: result.rowCount });
        }
      }
      return result.rowCount || 0;
    });
  },

  async getProfileInTransaction(client: any, tenantId: string, customerId: string) {
    const row = await client.query('SELECT * FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2', [tenantId, customerId]);
    return row.rows[0] || null;
  },
};