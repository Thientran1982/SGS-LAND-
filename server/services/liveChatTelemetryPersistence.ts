import { pool } from '../db';
import type { LiveChatTelemetryPersistenceState } from './liveChatTelemetry';

const TELEMETRY_SCOPE = 'public-livechat';

export async function loadLiveChatTelemetryState(): Promise<LiveChatTelemetryPersistenceState | null> {
  const result = await pool.query<{ state_json: LiveChatTelemetryPersistenceState }>(
    `SELECT state_json
       FROM live_chat_telemetry_snapshots
      WHERE scope = $1
      LIMIT 1`,
    [TELEMETRY_SCOPE],
  );
  return result.rows[0]?.state_json || null;
}

export async function saveLiveChatTelemetryState(
  state: LiveChatTelemetryPersistenceState,
): Promise<void> {
  await pool.query(
    `INSERT INTO live_chat_telemetry_snapshots (scope, state_json, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (scope) DO UPDATE
       SET state_json = EXCLUDED.state_json,
           updated_at = NOW()`,
    [TELEMETRY_SCOPE, JSON.stringify(state)],
  );
}