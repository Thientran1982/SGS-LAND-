import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'P2: Skills catalog (#9) + multi-agent chat rooms (#10) + nen voice-call (#11) + teach recordings (#12).',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      -- #9 SKILLS CATALOG: bien 13 role prompts thanh skills cho moi gioi
      CREATE TABLE IF NOT EXISTS agent_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        skill_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'sales',
        author_id UUID,
        author_name TEXT,
        prompt_template TEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        visibility TEXT NOT NULL DEFAULT 'PRIVATE'
          CHECK (visibility IN ('PRIVATE','TENANT','PUBLIC')),
        published BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TIMESTAMPTZ,
        install_count INT NOT NULL DEFAULT 0,
        rating_sum INT NOT NULL DEFAULT 0,
        rating_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, skill_key)
      );

      -- #10 MULTI-AGENT ROOMS: phong chat nhom moi gioi + khach
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        topic TEXT,
        created_by UUID,
        is_open BOOLEAN NOT NULL DEFAULT TRUE,
        max_members INT NOT NULL DEFAULT 20,
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, slug)
      );
      CREATE TABLE IF NOT EXISTS chat_room_members (
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('HOST','MEMBER')),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS chat_room_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        sender_id UUID,
        sender_name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'TEXT' CHECK (kind IN ('TEXT','SYSTEM','AGENT')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- #11 VOICE CALL AGENT (nen tang): lich su cuoc goi cua Agent Minh
      CREATE TABLE IF NOT EXISTS agent_voice_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        lead_id UUID,
        phone TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'OUTBOUND' CHECK (direction IN ('INBOUND','OUTBOUND')),
        status TEXT NOT NULL DEFAULT 'DIALING'
          CHECK (status IN ('DIALING','ACTIVE','ENDED','FAILED','MISSED')),
        duration_sec INT,
        transcript_json JSONB,
        recording_url TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMPTZ
      );

      -- #12 TEACH BY DEMONSTRATION: ban ghi quy trinh ban hang de agent hoc
      CREATE TABLE IF NOT EXISTS agent_teach_recordings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        scenario TEXT,
        media_url TEXT,
        transcript TEXT,
        extracted_steps JSONB,
        derived_skill_id UUID REFERENCES agent_skills(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'RECORDED'
          CHECK (status IN ('RECORDED','TRANSCRIBED','EXTRACTED','APPROVED','REJECTED')),
        recorded_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_agent_skills_public
        ON agent_skills(published, visibility);
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_tenant
        ON chat_rooms(tenant_id, is_open);
      CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room
        ON chat_room_messages(room_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_voice_calls_lead
        ON agent_voice_calls(lead_id, started_at DESC);
    `);
  },
};

export default migration;
