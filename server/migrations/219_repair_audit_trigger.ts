import type { PoolClient } from 'pg';
import type { Migration } from './runner';

/**
 * 116_audit_trigger_enforcement installed fn_audit_log_enforce() on users, leads,
 * listings and contracts, but it inserts into audit_logs.metadata, a column that
 * was never created. Every write on those tables therefore raised a warning and
 * wrote no audit row.
 *
 * - Add audit_logs.metadata (JSONB).
 * - Replace the function so it records only what changed on UPDATE (and skips
 *   no-op updates), and never stores secrets: fields whose names look like
 *   passwords, tokens, secrets, OTP/TOTP or API keys are listed by name only.
 */
const migration: Migration = {
  description: 'Repair DB audit trigger: add audit_logs.metadata, log changed fields only, redact secrets',

  async up(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`);

    await client.query(`
      CREATE OR REPLACE FUNCTION fn_audit_log_enforce() RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_tenant_id uuid;
        v_entity_id text;
        v_actor text;
        v_old jsonb;
        v_new jsonb;
        v_changed text[];
        v_changes jsonb;
        v_meta jsonb;
        c_secret constant text := '(password|passwd|secret|token|totp|otp|api_key|apikey|hash)';
      BEGIN
        v_old := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
        v_new := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;

        BEGIN
          v_tenant_id := NULLIF(COALESCE(v_new, v_old)->>'tenant_id', '')::uuid;
        EXCEPTION WHEN others THEN
          v_tenant_id := NULL;
        END;
        IF v_tenant_id IS NULL THEN
          v_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
        END IF;
        v_entity_id := COALESCE(v_new, v_old)->>'id';
        v_actor := COALESCE(NULLIF(current_setting('app.current_actor_id', true), ''), 'system_trigger');

        IF TG_OP = 'UPDATE' THEN
          SELECT array_agg(n.key ORDER BY n.key)
            INTO v_changed
            FROM jsonb_each(v_new) n
            LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
           WHERE o.value IS DISTINCT FROM n.value
             AND n.key NOT IN ('updated_at');
          IF v_changed IS NULL THEN
            RETURN NULL; -- nothing but updated_at changed
          END IF;
          SELECT jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
            INTO v_changes
            FROM jsonb_each(v_new) n
            LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
           WHERE n.key = ANY (v_changed)
             AND n.key !~* c_secret;
          v_meta := jsonb_build_object('changed_fields', to_jsonb(v_changed), 'changes', COALESCE(v_changes, '{}'::jsonb));
        ELSE
          SELECT jsonb_object_agg(key, value)
            INTO v_meta
            FROM jsonb_each(COALESCE(v_new, v_old))
           WHERE key !~* c_secret;
          v_meta := jsonb_build_object(CASE WHEN TG_OP = 'INSERT' THEN 'new' ELSE 'old' END, COALESCE(v_meta, '{}'::jsonb));
        END IF;

        INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details, metadata)
        VALUES (v_tenant_id, v_actor, TG_OP, TG_TABLE_NAME, v_entity_id,
                'auto-log tu DB trigger (defense-in-depth)', v_meta);
        RETURN NULL;
      EXCEPTION WHEN others THEN
        -- Never let an audit failure break the business transaction.
        RAISE WARNING '[219] audit trigger failed on %: %', TG_TABLE_NAME, SQLERRM;
        RETURN NULL;
      END;
      $fn$;
    `);
  },

  async down(): Promise<void> {
    // The previous function could not write any row; keep the repaired version.
  },
};

export default migration;
