/**
 * Migration 045 — Drop FK on ai_feedback.interaction_id
 *
 * The valuation route generates random UUIDs for interactionId (for tracking),
 * but does NOT store them in the `interactions` table (a CRM concept).
 * The FK causes a 500 error every time a user submits valuation feedback.
 *
 * Fix: drop the FK so interaction_id is a free-form tracking field.
 */
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Drop FK constraint on ai_feedback.interaction_id (valuation UUIDs are not in interactions table)',

  async up(client) {
    await client.query(`
      ALTER TABLE ai_feedback
        DROP CONSTRAINT IF EXISTS ai_feedback_interaction_id_fkey;
    `);
  },

  async down(client) {
    // Re-add only if every existing value exists in interactions (data-dependent)
    // Safe no-op: leave FK dropped on rollback to avoid breaking existing data
  },
};

export default migration;
