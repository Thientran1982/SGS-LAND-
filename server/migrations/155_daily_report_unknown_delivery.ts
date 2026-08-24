import type { Migration } from './runner';

const migration: Migration = {
  description: 'Track daily report deliveries with an unknown provider outcome',
  async up(client) {
    await client.query(`
      ALTER TABLE agent_report_log
        DROP CONSTRAINT IF EXISTS agent_report_log_status_check;
      ALTER TABLE agent_report_log
        ADD CONSTRAINT agent_report_log_status_check
        CHECK (status IN ('pending','sent','failed','delivery_unknown'));
    `);
  },
  async down(client) {
    await client.query(`
      UPDATE agent_report_log SET status = 'failed'
      WHERE status = 'delivery_unknown';
      ALTER TABLE agent_report_log
        DROP CONSTRAINT IF EXISTS agent_report_log_status_check;
      ALTER TABLE agent_report_log
        ADD CONSTRAINT agent_report_log_status_check
        CHECK (status IN ('pending','sent','failed'));
    `);
  },
};

export default migration;