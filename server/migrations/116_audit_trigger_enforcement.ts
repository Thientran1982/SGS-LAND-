import { PoolClient } from 'pg';

/*
 * Bo sung trigger-level enforcement cho audit_logs.
 *
 * Boi canh: audit_logs hien tai chi duoc ghi o tang ung dung (middleware
 * globalMutationAudit + goi thu cong qua auditRepository). Neu co truy van
 * SQL truc tiep bo qua tang ung dung (script noi bo, sua tay, bug), se
 * KHONG co dau vet audit nao duoc tao.
 *
 * Trigger nay bo sung mot lop bao ve o tang database: bat ky INSERT / UPDATE /
 * DELETE nao tren cac bang nhay cam se tu dong ghi 1 dong vao audit_logs,
 * bat ke request di qua duong nao. Day la lop "phong ho" (defense-in-depth)
 * bo sung, KHONG thay the audit o tang ung dung (van giu nguyen).
 */

const TRIGGER_TABLES = ['users', 'leads', 'listings', 'contracts'] as const;
const TRIGGER_NAME = 'trg_audit_log_enforce';
const FN_NAME = 'fn_audit_log_enforce';

export default {
  id: '116_audit_trigger_enforcement',
  description: 'Add DB-level AFTER trigger to auto-log INSERT/UPDATE/DELETE into audit_logs for sensitive tables',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE OR REPLACE FUNCTION ${FN_NAME}() RETURNS trigger AS $fn$
      DECLARE
        v_tenant_text text;
        v_tenant_id uuid;
        v_entity_id text;
        v_actor text;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          v_tenant_text := (to_jsonb(OLD)->>'tenant_id');
          v_entity_id   := (to_jsonb(OLD)->>'id');
        ELSE
          v_tenant_text := (to_jsonb(NEW)->>'tenant_id');
          v_entity_id   := (to_jsonb(NEW)->>'id');
        END IF;

        BEGIN
          v_tenant_id := NULLIF(v_tenant_text, '')::uuid;
        EXCEPTION WHEN others THEN
          v_tenant_id := NULL;
        END;
        IF v_tenant_id IS NULL THEN
          v_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
        END IF;

        v_actor := COALESCE(NULLIF(current_setting('app.current_actor_id', true), ''), 'system_trigger');

        INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details, metadata)
        VALUES (
          v_tenant_id,
          v_actor,
          TG_OP,
          TG_TABLE_NAME,
          v_entity_id,
          'auto-log tu DB trigger (defense-in-depth)',
          CASE
            WHEN TG_OP = 'DELETE' THEN jsonb_build_object('old', to_jsonb(OLD))
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
            ELSE jsonb_build_object('new', to_jsonb(NEW))
          END
        );

        RETURN NULL;
      EXCEPTION WHEN others THEN
        -- Khong bao gio de audit trigger loi lam hong giao dich nghiep vu chinh.
        RAISE WARNING '[116] audit trigger failed on %: %', TG_TABLE_NAME, SQLERRM;
        RETURN NULL;
      END;
      $fn$ LANGUAGE plpgsql;
    `);

    for (const table of TRIGGER_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
        [table],
      );
      if (exists.rowCount === 0) {
        console.log(`[116] Bo qua ${table} - bang khong ton tai`);
        continue;
      }
      await client.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON ${table}`);
      await client.query(`
        CREATE TRIGGER ${TRIGGER_NAME}
          AFTER INSERT OR UPDATE OR DELETE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION ${FN_NAME}()
      `);
      console.log(`[116] Trigger ${TRIGGER_NAME} da gan vao ${table}`);
    }

    console.log('[116] Hoan tat: trigger-level audit enforcement.');
  },

  async down(client: PoolClient): Promise<void> {
    for (const table of TRIGGER_TABLES) {
      await client.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON ${table}`).catch(() => {});
    }
    await client.query(`DROP FUNCTION IF EXISTS ${FN_NAME}()`).catch(() => {});
  },
};
