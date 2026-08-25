import { withTenantContext } from '../db';

export const PROFILE_CATEGORIES = new Set([
  'budget', 'preference_location', 'purpose', 'purchase_timeline', 'property_need', 'constraint', 'other',
]);
export const PROFILE_CONSENTS = new Set(['PENDING', 'OPTED_IN', 'OPTED_OUT']);

export type ObservedProfileFact = ReturnType<typeof normalizeProfileFact>;

export function observeCustomerMessage(message: string): ObservedProfileFact[] {
  const text = String(message || '').trim();
  if (!text) return [];
  const facts: ObservedProfileFact[] = [];
  const source = 'customer_message';
  const budget = text.match(/(?:ngân sách|tầm giá|khoảng|budget)[^.!?\n]{0,50}?(\d+(?:[.,]\d+)?)\s*(tỷ|tỉ|ty|triệu)/i);
  if (budget) {
    facts.push(normalizeProfileFact({
      fact: `Ngân sách khoảng ${budget[1]} ${budget[2]}`,
      category: 'budget', source, confidence: 0.8,
    }));
  }
  const location = text.match(/(?:quan tâm|muốn tìm|tìm|ở|tại|khu vực)\s+([^.!?\n]{2,70}?)(?=\s+(?:vì|do|để|và|nhưng)\b|[.!?\n]|$)/i);
  if (location && /\b(quận|huyện|thủ đức|thành phố|tp\.?|q\.?|khu vực|long thành|đồng nai|bình dương|hồ chí minh)\b/i.test(location[1])) {
    facts.push(normalizeProfileFact({
      fact: `Quan tâm khu vực ${location[1].trim()}`,
      category: 'preference_location', source, confidence: 0.75,
    }));
  }
  if (/(đầu tư|sinh lời|roi|lợi nhuận)/i.test(text)) {
    facts.push(normalizeProfileFact({ fact: 'Mục đích đầu tư', category: 'purpose', source, confidence: 0.75 }));
  } else if (/(ở thực|để ở|an cư|gia đình ở)/i.test(text)) {
    facts.push(normalizeProfileFact({ fact: 'Mục đích mua để ở', category: 'purpose', source, confidence: 0.75 }));
  }
  if (/(tháng này|tuần này|sớm|ngay|gấp)/i.test(text)) {
    facts.push(normalizeProfileFact({ fact: 'Dự kiến mua trong thời gian ngắn', category: 'purchase_timeline', source, confidence: 0.65 }));
  } else if (/(năm sau|vài tháng nữa|chưa vội|tham khảo)/i.test(text)) {
    facts.push(normalizeProfileFact({ fact: 'Chưa có kế hoạch mua ngay', category: 'purchase_timeline', source, confidence: 0.65 }));
  }
  if (/\b(khó khăn tài chính|nợ nần|ly hôn|bệnh|mất việc|khủng hoảng)\b/i.test(text)) {
    facts.push(normalizeProfileFact({
      fact: 'Khách đã chia sẻ một chủ đề nhạy cảm; không nhắc lại',
      category: 'other', source, sensitive: true, confidence: 0.6,
    }));
  }
  return facts;
}

export function classifyInteractionOutcome(message: string): 'positive' | 'negative' | 'neutral' {
  const text = String(message || '');
  if (/\b(không phù hợp|không thích|không quan tâm|bỏ qua|đừng gửi|sai nhu cầu|quá cao|quá thấp)\b/i.test(text)) return 'negative';
  if (/\b(quan tâm|phù hợp|gửi thêm|xem thêm|đặt lịch|muốn xem|được|cảm ơn)\b/i.test(text)) return 'positive';
  return 'neutral';
}

export function normalizeProfileFact(input: any): {
  fact: string; category: string; source: string; sensitive: boolean; confidence: number; validUntil: string | null;
} {
  const fact = String(input?.fact || '').trim();
  const category = String(input?.category || '').trim();
  const source = String(input?.source || '').trim();
  const confidence = Number(input?.confidence ?? 0.5);
  if (!fact || fact.length > 1000) throw new Error('fact is required and must be at most 1000 characters');
  if (!PROFILE_CATEGORIES.has(category)) throw new Error('Invalid customer profile fact category');
  if (!source || source.length > 500) throw new Error('source is required and must be at most 500 characters');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('confidence must be between 0 and 1');
  const validUntil = input?.validUntil == null || input.validUntil === '' ? null : String(input.validUntil);
  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) throw new Error('validUntil must be an ISO date');
  return { fact, category, source, sensitive: input?.sensitive === true, confidence, validUntil };
}

export function formatCustomerProfileContext(context: {
  consent: boolean;
  facts: Array<{ category: string; fact: string }>;
  topicsToAvoid?: string[];
}): string {
  if (!context.consent) return '';
  const facts = context.facts.map(f => `${f.category}: ${f.fact}`).join(' | ');
  const avoid = context.topicsToAvoid?.length
    ? `\nKHÔNG NHẮC LẠI các chủ đề khách yêu cầu tránh: ${context.topicsToAvoid.join(', ')}`
    : '';
  return `${facts ? `\n[HỒ SƠ CÁ NHÂN ĐÃ ĐƯỢC KHÁCH CHO PHÉP GHI NHỚ]: ${facts}` : ''}${avoid}`;
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
      const topics = await client.query(
        `SELECT id, topic, source, created_at FROM customer_profile_topics_to_avoid
         WHERE tenant_id=$1 AND profile_id=$2 ORDER BY created_at DESC`,
        [tenantId, profile.id],
      );
      return { ...profile, facts: facts.rows, interaction_outcomes: outcomes.rows, topics_to_avoid: topics.rows };
    });
  },

  async getPersonalizationContext(tenantId: string, customerId: string, message = '') {
    return withTenantContext(tenantId, async client => {
      const profileResult = await client.query(
        'SELECT id, remember_consent FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2',
        [tenantId, customerId],
      );
      const profile = profileResult.rows[0];
      if (!profile || profile.remember_consent !== 'OPTED_IN') {
        return { consent: false, enabled: false, block: '', stale: false, negativeStreak: 0, facts: [], interaction_outcomes: [], topicsToAvoid: [] };
      }
      const facts = await client.query(
        `SELECT fact, category, source, created_at
         FROM customer_profile_facts
         WHERE tenant_id=$1 AND profile_id=$2 AND sensitive=false
           AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
         ORDER BY created_at DESC LIMIT 100`,
        [tenantId, profile.id],
      );
      const normalized = String(message || '').toLocaleLowerCase('vi-VN');
      const relevant = facts.rows.filter((row: any) => {
        const ageDays = (Date.now() - new Date(row.created_at).getTime()) / 86400000;
        if (ageDays > 30) return false;
        return row.category === 'budget' && /\b(giá|ngân sách|tỷ|triệu|phù hợp|tìm)\b/i.test(normalized)
          || row.category === 'preference_location' && /\b(ở đâu|khu vực|quận|huyện|dự án|tìm)\b/i.test(normalized)
          || row.category === 'purpose' && /\b(đầu tư|ở thực|mục đích|phù hợp)\b/i.test(normalized)
          || row.category === 'purchase_timeline' && /\b(khi nào|bao giờ|thời gian|mua)\b/i.test(normalized)
          || row.category === 'property_need' && /\b(phòng ngủ|diện tích|căn)\b/i.test(normalized);
      }).slice(0, 5);
      const outcomes = await client.query(
        `SELECT result FROM customer_profile_outcomes
         WHERE tenant_id=$1 AND profile_id=$2 ORDER BY created_at DESC LIMIT 2`,
        [tenantId, profile.id],
      );
      const topics = await client.query(
        `SELECT topic FROM customer_profile_topics_to_avoid
         WHERE tenant_id=$1 AND profile_id=$2 ORDER BY created_at DESC`,
        [tenantId, profile.id],
      );
      const negativeStreak = outcomes.rows.length === 2 && outcomes.rows.every((row: any) => /negative|rejected|từ chối|không phù hợp/i.test(row.result)) ? 2 : 0;
      const block = relevant.length
        ? `[HỒ SƠ CÁ NHÂN — chỉ dùng khi liên quan trực tiếp]\n${relevant.map((row: any) => `- ${row.category}: ${row.fact} (nguồn: ${row.source})`).join('\n')}`
        : '';
      return {
        consent: true, enabled: true, block,
        facts: relevant.map((row: any) => ({ ...row, sensitive: false })),
        interaction_outcomes: outcomes.rows,
        topicsToAvoid: topics.rows.map((row: any) => row.topic),
        stale: facts.rows.some((row: any) => (Date.now() - new Date(row.created_at).getTime()) / 86400000 > 30),
        negativeStreak,
      };
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
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [tenantId, profile.rows[0].id, fact.fact, fact.category, fact.source, fact.sensitive, fact.confidence],
      );
      if (previous.rows[0]) {
        await client.query(
          `UPDATE customer_profile_facts SET valid_until=CURRENT_DATE - 1, superseded_by=$3
           WHERE tenant_id=$1 AND id=$2`,
          [tenantId, previous.rows[0].id, created.rows[0].id],
        );
      }
      if (fact.validUntil) {
        await client.query(
          `UPDATE customer_profile_facts SET valid_until=$3::date
           WHERE tenant_id=$1 AND id=$2`,
          [tenantId, created.rows[0].id, fact.validUntil],
        );
      }
      await audit(client, tenantId, customerId, 'FACT_CREATED', actorId, {
        factId: created.rows[0].id, category: fact.category, supersededFactId: previous.rows[0]?.id || null,
      });
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

  async addTopicToAvoid(tenantId: string, customerId: string, input: any, actorId?: string) {
    const topic = String(input?.topic || '').trim();
    const source = String(input?.source || '').trim();
    if (!topic || topic.length > 500 || !source || source.length > 500) {
      throw new Error('topic and source are required and must be at most 500 characters');
    }
    return withTenantContext(tenantId, async client => {
      const profile = await client.query(
        'SELECT id, remember_consent FROM customer_profiles WHERE tenant_id=$1 AND customer_id=$2 FOR UPDATE',
        [tenantId, customerId],
      );
      if (!profile.rows[0] || profile.rows[0].remember_consent !== 'OPTED_IN') throw new Error('Customer profile consent is required');
      const result = await client.query(
        `INSERT INTO customer_profile_topics_to_avoid (tenant_id, profile_id, topic, source)
         VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, profile_id, topic) DO UPDATE SET source=EXCLUDED.source
         RETURNING *`,
        [tenantId, profile.rows[0].id, topic, source],
      );
      await audit(client, tenantId, customerId, 'TOPIC_ADDED', actorId, { topic });
      return result.rows[0];
    });
  },

  async deleteTopicToAvoid(tenantId: string, customerId: string, topicId: string, actorId?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `DELETE FROM customer_profile_topics_to_avoid t USING customer_profiles p
         WHERE t.tenant_id=$1 AND t.id=$2 AND t.profile_id=p.id AND p.customer_id=$3 RETURNING t.topic`,
        [tenantId, topicId, customerId],
      );
      if (result.rows[0]) await audit(client, tenantId, customerId, 'TOPIC_DELETED', actorId, { topic: result.rows[0].topic });
      return Boolean(result.rows[0]);
    });
  },

  async deleteFact(tenantId: string, customerId: string, factId: string, actorId?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `DELETE FROM customer_profile_facts f USING customer_profiles p
         WHERE f.tenant_id=$1 AND f.id=$2 AND f.profile_id=p.id AND p.customer_id=$3
         RETURNING f.id`,
        [tenantId, factId, customerId],
      );
      if (result.rows[0]) await audit(client, tenantId, customerId, 'FACT_DELETED', actorId, { factId });
      return Boolean(result.rows[0]);
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
