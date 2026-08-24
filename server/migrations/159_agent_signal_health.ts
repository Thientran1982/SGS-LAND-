import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Indexes for tenant-scoped agent signal health monitoring',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_learning_health
        ON interactions (tenant_id, timestamp DESC)
        WHERE (metadata ? 'learningAction')
           OR (metadata ? 'expectedSignalType')
           OR (direction = 'OUTBOUND' AND status = 'SENT');
      CREATE INDEX IF NOT EXISTS idx_agent_signals_health
        ON agent_signals (tenant_id, created_at DESC, signal_type);
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS idx_interactions_learning_health; DROP INDEX IF EXISTS idx_agent_signals_health;');
  },
};

export default migration;