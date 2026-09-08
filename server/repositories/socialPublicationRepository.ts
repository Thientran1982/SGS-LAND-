import { Pool, PoolClient } from 'pg';

export interface PublicationCreateInput {
  tenantId: string;
  listingId: string;
  createdBy: string | null;
  publishMode: 'NOW' | 'SCHEDULED';
  scheduledAt: string | null;
  contentSnapshot: Record<string, unknown>;
  assetSnapshot: string[];
  platforms: string[];
}

function mapTarget(row: any, attempts?: any[]) {
  return {
    id: row.id,
    publicationId: row.publication_id,
    tenantId: row.tenant_id,
    platform: row.platform,
    accountId: row.account_id,
    status: row.status,
    providerPostId: row.provider_post_id,
    providerPostUrl: row.provider_post_url,
    providerRequestId: row.provider_request_id,
    attemptCount: Number(row.attempt_count || 0),
    nextRetryAt: row.next_retry_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(attempts ? { attempts } : {}),
  };
}

function mapAttempt(row: any) {
  return {
    id: row.id,
    targetId: row.target_id,
    attemptNumber: Number(row.attempt_number),
    requestId: row.request_id,
    providerRequestId: row.provider_request_id,
    statusCode: row.status_code,
    resultStatus: row.result_status,
    errorCode: row.error_code,
    errorMessage: row.error_message_safe,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function mapEvent(row: any) {
  return {
    id: row.id,
    publicationId: row.publication_id,
    targetId: row.target_id,
    actorId: row.actor_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function mapPublication(row: any, targets: any[] = [], events: any[] = []) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    listingId: row.listing_id,
    createdBy: row.created_by,
    status: row.status,
    publishMode: row.publish_mode,
    scheduledAt: row.scheduled_at,
    contentSnapshot: row.content_snapshot,
    assetSnapshot: row.asset_snapshot,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    targets,
    events,
  };
}

export async function createSocialPublication(pool: Pool, input: PublicationCreateInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const publication = await client.query(
      `INSERT INTO social_publications
        (tenant_id, listing_id, created_by, status, publish_mode, scheduled_at, content_snapshot, asset_snapshot)
       VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6::jsonb, $7::jsonb)
       RETURNING *`,
      [
        input.tenantId,
        input.listingId,
        input.createdBy,
        input.publishMode,
        input.scheduledAt,
        JSON.stringify(input.contentSnapshot),
        JSON.stringify(input.assetSnapshot),
      ],
    );
    const targetResult = await client.query(
      `INSERT INTO social_publication_targets
        (publication_id, tenant_id, platform, account_id, status)
       SELECT $1, $2, platform, 'default', 'NOT_READY'
       FROM unnest($3::text[]) AS platform
       ON CONFLICT (publication_id, platform, account_id) DO NOTHING
       RETURNING *`,
      [publication.rows[0].id, input.tenantId, input.platforms],
    );
    await client.query('COMMIT');
    return mapPublication(publication.rows[0], targetResult.rows.map(row => mapTarget(row)));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listSocialPublications(pool: Pool, tenantId: string, limit = 100) {
  const result = await pool.query(
    `SELECT * FROM social_publications
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [tenantId, Math.min(Math.max(limit, 1), 200)],
  );
  if (!result.rows.length) return [];
  const targets = await pool.query(
    `SELECT * FROM social_publication_targets
      WHERE tenant_id = $1 AND publication_id = ANY($2::uuid[])
      ORDER BY created_at ASC`,
    [tenantId, result.rows.map(row => row.id)],
  );
  const byPublication = new Map<string, any[]>();
  for (const row of targets.rows) {
    const list = byPublication.get(row.publication_id) || [];
    list.push(mapTarget(row));
    byPublication.set(row.publication_id, list);
  }
  return result.rows.map(row => mapPublication(row, byPublication.get(row.id) || []));
}

export async function findSocialPublication(pool: Pool, tenantId: string, id: string) {
  const publication = await pool.query(
    `SELECT * FROM social_publications WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  if (!publication.rowCount) return null;
  const targets = await pool.query(
    `SELECT * FROM social_publication_targets
      WHERE publication_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC`,
    [id, tenantId],
  );
  const attempts = targets.rows.length
    ? await pool.query(
      `SELECT * FROM social_publication_attempts
        WHERE target_id = ANY($1::uuid[])
        ORDER BY target_id, attempt_number DESC`,
      [targets.rows.map(row => row.id)],
    )
    : { rows: [] };
  const attemptsByTarget = new Map<string, any[]>();
  for (const row of attempts.rows) {
    const list = attemptsByTarget.get(row.target_id) || [];
    list.push(mapAttempt(row));
    attemptsByTarget.set(row.target_id, list);
  }
  const events = await pool.query(
    `SELECT * FROM social_publication_events
      WHERE publication_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC`,
    [id, tenantId],
  );
  return mapPublication(
    publication.rows[0],
    targets.rows.map(row => mapTarget(row, attemptsByTarget.get(row.id) || [])),
    events.rows.map(mapEvent),
  );
}

export async function activateSocialPublication(pool: Pool, tenantId: string, id: string) {
  const result = await pool.query(
    `UPDATE social_publications
        SET status = CASE WHEN publish_mode = 'SCHEDULED' THEN 'SCHEDULED' ELSE 'PROCESSING' END,
            approved_at = NOW(),
            updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'DRAFT'
      RETURNING *`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function markSocialTargetsPending(pool: Pool, tenantId: string, publicationId: string) {
  await pool.query(
    `UPDATE social_publication_targets
        SET status = 'PENDING', updated_at = NOW()
      WHERE publication_id = $1
        AND tenant_id = $2
        AND status = 'NOT_READY'`,
    [publicationId, tenantId],
  );
}

export async function cancelSocialPublication(pool: Pool, tenantId: string, id: string) {
  const result = await pool.query(
    `UPDATE social_publications
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
        AND status IN ('DRAFT', 'SCHEDULED', 'FAILED')
      RETURNING *`,
    [id, tenantId],
  );
  if (!result.rowCount) return null;
  await pool.query(
    `UPDATE social_publication_targets
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE publication_id = $1 AND tenant_id = $2
        AND status NOT IN ('PUBLISHED', 'CANCELLED')`,
    [id, tenantId],
  );
  return result.rows[0];
}

export async function claimDueSocialTargets(pool: Pool, limit = 50) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `WITH candidates AS (
         SELECT t.id
           FROM social_publication_targets t
           JOIN social_publications p ON p.id = t.publication_id
          WHERE t.status IN ('PENDING', 'FAILED_RETRYABLE')
            AND (t.next_retry_at IS NULL OR t.next_retry_at <= NOW())
            AND p.status IN ('SCHEDULED', 'PROCESSING', 'PARTIALLY_PUBLISHED')
            AND (p.publish_mode = 'NOW' OR p.scheduled_at <= NOW())
          ORDER BY COALESCE(p.scheduled_at, p.created_at), t.created_at
          LIMIT $1
          FOR UPDATE OF t SKIP LOCKED
       )
       UPDATE social_publication_targets t
          SET status = 'PROCESSING',
              processing_started_at = NOW(),
              attempt_count = t.attempt_count + 1,
              updated_at = NOW()
         FROM candidates
        WHERE t.id = candidates.id
        RETURNING t.*`,
      [limit],
    );
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getPublicationForTarget(pool: Pool, targetId: string) {
  const result = await pool.query(
    `SELECT t.*, p.tenant_id AS publication_tenant_id, p.status AS publication_status,
            p.content_snapshot, p.asset_snapshot, p.listing_id
       FROM social_publication_targets t
       JOIN social_publications p ON p.id = t.publication_id
      WHERE t.id = $1`,
    [targetId],
  );
  return result.rows[0] || null;
}

export async function recordSocialAttempt(
  pool: Pool,
  targetId: string,
  attempt: {
    attemptNumber: number;
    requestId: string;
    providerRequestId?: string;
    statusCode?: number;
    resultStatus: string;
    errorCode?: string;
    errorMessage?: string;
  },
) {
  await pool.query(
    `INSERT INTO social_publication_attempts
      (target_id, attempt_number, request_id, provider_request_id, status_code,
       result_status, error_code, error_message_safe, finished_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (target_id, attempt_number) DO UPDATE SET
       provider_request_id = EXCLUDED.provider_request_id,
       status_code = EXCLUDED.status_code,
       result_status = EXCLUDED.result_status,
       error_code = EXCLUDED.error_code,
       error_message_safe = EXCLUDED.error_message_safe,
       finished_at = EXCLUDED.finished_at`,
    [
      targetId,
      attempt.attemptNumber,
      attempt.requestId,
      attempt.providerRequestId || null,
      attempt.statusCode || null,
      attempt.resultStatus,
      attempt.errorCode || null,
      attempt.errorMessage || null,
    ],
  );
}

export async function updateSocialTarget(
  pool: Pool,
  targetId: string,
  update: {
    status: string;
    providerPostId?: string;
    providerPostUrl?: string;
    providerRequestId?: string;
    nextRetryAt?: Date | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
) {
  const target = await pool.query(
    `UPDATE social_publication_targets
        SET status = $2,
            provider_post_id = COALESCE($3, provider_post_id),
            provider_post_url = COALESCE($4, provider_post_url),
            provider_request_id = COALESCE($5, provider_request_id),
            next_retry_at = $6,
            last_error_code = $7,
            last_error_message = $8,
            updated_at = NOW(),
            published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE published_at END
      WHERE id = $1
      RETURNING publication_id`,
    [
      targetId,
      update.status,
      update.providerPostId || null,
      update.providerPostUrl || null,
      update.providerRequestId || null,
      update.nextRetryAt ?? null,
      update.errorCode ?? null,
      update.errorMessage ?? null,
    ],
  );
  if (!target.rowCount) return null;
  await recomputePublicationStatus(pool, target.rows[0].publication_id);
  return target.rows[0].publication_id as string;
}

async function recomputePublicationStatusQuery(queryable: Pick<Pool, 'query'>, publicationId: string) {
  await queryable.query(
    `UPDATE social_publications p
        SET status = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM social_publication_targets t
             WHERE t.publication_id = p.id AND t.status <> 'PUBLISHED'
          ) THEN 'PUBLISHED'
          WHEN EXISTS (
            SELECT 1 FROM social_publication_targets t
             WHERE t.publication_id = p.id AND t.status IN ('PUBLISHED', 'PROCESSING', 'PENDING', 'FAILED_RETRYABLE')
          ) THEN 'PARTIALLY_PUBLISHED'
          WHEN EXISTS (
            SELECT 1 FROM social_publication_targets t
             WHERE t.publication_id = p.id AND t.status = 'AMBIGUOUS'
          ) THEN 'FAILED'
          ELSE 'FAILED'
        END,
        published_at = CASE WHEN NOT EXISTS (
          SELECT 1 FROM social_publication_targets t
           WHERE t.publication_id = p.id AND t.status <> 'PUBLISHED'
        ) THEN COALESCE(p.published_at, NOW()) ELSE p.published_at END,
        updated_at = NOW()
      WHERE p.id = $1
        AND p.status NOT IN ('DRAFT', 'CANCELLED')`,
    [publicationId],
  );
}

export async function recomputePublicationStatus(pool: Pool, publicationId: string) {
  await recomputePublicationStatusQuery(pool, publicationId);
}

export interface SocialPublicationEventInput {
  tenantId: string;
  publicationId: string;
  targetId?: string | null;
  actorId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordSocialPublicationEvent(
  pool: Pool,
  input: SocialPublicationEventInput,
) {
  await pool.query(
    `INSERT INTO social_publication_events
      (tenant_id, publication_id, target_id, actor_id, event_type,
       from_status, to_status, reason, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      input.tenantId,
      input.publicationId,
      input.targetId || null,
      input.actorId || null,
      input.eventType,
      input.fromStatus || null,
      input.toStatus || null,
      input.reason || null,
      JSON.stringify(input.metadata || {}),
    ],
  );
}

export type SocialTargetOperatorAction =
  | 'CONFIRM_PUBLISHED'
  | 'MARK_FAILED'
  | 'REQUEUE';

export async function applySocialTargetOperatorAction(
  pool: Pool,
  input: {
    tenantId: string;
    publicationId: string;
    targetId: string;
    actorId: string | null;
    action: SocialTargetOperatorAction;
    reason: string;
    providerPostId?: string;
    providerPostUrl?: string | null;
  },
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT t.*, p.status AS publication_status
         FROM social_publication_targets t
         JOIN social_publications p ON p.id = t.publication_id
        WHERE t.id = $1 AND t.publication_id = $2 AND t.tenant_id = $3
        FOR UPDATE`,
      [input.targetId, input.publicationId, input.tenantId],
    );
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return { kind: 'NOT_FOUND' as const };
    }
    const target = current.rows[0];
    const allowed = input.action === 'CONFIRM_PUBLISHED'
      ? target.status === 'AMBIGUOUS'
      : input.action === 'MARK_FAILED'
        ? target.status === 'AMBIGUOUS'
        : ['FAILED_RETRYABLE', 'FAILED_FINAL'].includes(target.status);
    if (!allowed) {
      await client.query('ROLLBACK');
      return { kind: 'INVALID_STATE' as const, status: target.status };
    }
    if (input.action === 'CONFIRM_PUBLISHED' && !input.providerPostId) {
      await client.query('ROLLBACK');
      return { kind: 'INVALID_INPUT' as const, message: 'Cần provider post ID để xác nhận đã đăng.' };
    }

    const nextStatus = input.action === 'CONFIRM_PUBLISHED'
      ? 'PUBLISHED'
      : input.action === 'MARK_FAILED'
        ? 'FAILED_FINAL'
        : 'PENDING';
    const update = await client.query(
      `UPDATE social_publication_targets
          SET status = $2::varchar,
              provider_post_id = COALESCE($3, provider_post_id),
              provider_post_url = COALESCE($4, provider_post_url),
              next_retry_at = NULL,
              last_error_code = CASE WHEN $2::varchar = 'PUBLISHED' OR $2::varchar = 'PENDING' THEN NULL ELSE 'OPERATOR_MARKED_FAILED' END,
              last_error_message = CASE WHEN $2::varchar = 'PUBLISHED' OR $2::varchar = 'PENDING' THEN NULL ELSE $5 END,
              published_at = CASE WHEN $2::varchar = 'PUBLISHED' THEN COALESCE(published_at, NOW()) ELSE published_at END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        input.targetId,
        nextStatus,
        input.providerPostId || null,
        input.providerPostUrl || null,
        input.reason,
      ],
    );
    await recomputePublicationStatusQuery(client, input.publicationId);
    await client.query(
      `INSERT INTO social_publication_events
        (tenant_id, publication_id, target_id, actor_id, event_type,
         from_status, to_status, reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        input.tenantId,
        input.publicationId,
        input.targetId,
        input.actorId,
        `OPERATOR_${input.action}`,
        target.status,
        nextStatus,
        input.reason,
        JSON.stringify({
          providerPostId: input.providerPostId || null,
          providerPostUrl: input.providerPostUrl || null,
        }),
      ],
    );
    await client.query('COMMIT');
    return { kind: 'OK' as const, target: mapTarget(update.rows[0]), status: nextStatus };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}