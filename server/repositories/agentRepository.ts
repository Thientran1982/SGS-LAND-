/**
 * AgentRepository
 * Manages named AI agents (like ARIA) and their per-lead memories.
 * Agents have upgradeable skills stored in the database.
 * Memories provide continuity across multiple analyses of the same lead.
 */

import { BaseRepository } from './baseRepository';
import { pool } from '../db';
import { logger } from '../middleware/logger';

const TENANT_FILTER = `tenant_id = current_setting('app.current_tenant_id', true)::uuid`;

// ── Types ──────────────────────────────────────────────────────────────────


// ============================================================
// C1: Prompt Version interfaces
// ============================================================
export interface AgentPromptVersion {
  id: string;
  tenantId: string;
  agentId: string;
  version: string;
  systemInstruction: string;
  isActive: boolean;
  changeNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// C2: Lead Journey Memory interface
// ============================================================
export interface LeadJourneyEvent {
  id: string;
  tenantId: string;
  leadId: string;
  agentId: string;
  sessionId: string | null;
  eventType: string;
  summary: string;
  signals: Record<string, any>;
  metadata: Record<string, any>;
  source: string;
  createdAt: string;
}
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  prompt_fragment: string;
}

export interface AgentKnowledgeFilter {
  domains?: string[];
  [k: string]: any;
}

export interface AiAgent {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  role: string;
  description: string;
  systemInstruction: string;
  skills: AgentSkill[];
  model: string | null;
  active: boolean;
  metadata: Record<string, any>;
  knowledgeFilter: AgentKnowledgeFilter;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMemory {
  id: string;
  tenantId: string;
  agentId: string;
  leadId: string | null;
  listingId: string | null;
  summary: string;
  signals: Record<string, any>;
  createdAt: string;
}

export interface ValuationMemorySignals {
  totalPrice: number;
  pricePerM2: number;
  confidence: number;
  trendGrowthPct: number;
  propertyType: string;
  address: string;
  rangeMin: number;
  rangeMax: number;
  isRealtime: boolean;
}

// ── In-memory cache ────────────────────────────────────────────────────────
// 5-minute TTL — agent config changes are rare; no need for Redis here.
const AGENT_CACHE_TTL_MS = 5 * 60 * 1000;
const agentCache = new Map<string, { agent: AiAgent; expiresAt: number }>();

class AgentRepository extends BaseRepository {
  constructor() {
    super('ai_agents');
  }

  // ── Row mappers ────────────────────────────────────────────────────────────

  private rowToAgent(row: any): AiAgent {
    return {
      id:                row.id,
      tenantId:          row.tenant_id,
      name:              row.name,
      displayName:       row.display_name,
      role:              row.role,
      description:       row.description || '',
      systemInstruction: row.system_instruction,
      skills:            Array.isArray(row.skills) ? row.skills : [],
      model:             row.model || null,
      active:            row.active ?? true,
      metadata:          row.metadata || {},
      knowledgeFilter:   row.knowledge_filter || {},
      createdAt:         row.created_at,
      updatedAt:         row.updated_at,
    };
  }

  private rowToMemory(row: any): AgentMemory {
    return {
      id:        row.id,
      tenantId:  row.tenant_id,
      agentId:   row.agent_id,
      leadId:    row.lead_id ?? null,
      listingId: row.listing_id ?? null,
      summary:   row.summary,
      signals:   row.signals || {},
      createdAt: row.created_at,
    };
  }

  // ── Agent CRUD ─────────────────────────────────────────────────────────────

  /**
   * Load an agent by name (e.g. 'ARIA').
   * Results are cached for AGENT_CACHE_TTL_MS.
   */
  async getAgentByName(tenantId: string, name: string): Promise<AiAgent | null> {
    const cacheKey = `${tenantId}:${name}`;
    const cached = agentCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.agent;

    try {
      return await this.withTenant(tenantId, async (client) => {
        const res = await client.query(
          `SELECT * FROM ai_agents WHERE name = $1 AND ${TENANT_FILTER} AND active = true LIMIT 1`,
          [name]
        );
        if (!res.rows.length) return null;
        const agent = this.rowToAgent(res.rows[0]);
        agentCache.set(cacheKey, { agent, expiresAt: Date.now() + AGENT_CACHE_TTL_MS });
        return agent;
      });
    } catch (e) {
      logger.warn(`AgentRepository.getAgentByName failed for '${name}':`, e);
      return null;
    }
  }

  /** Invalidate cache for an agent after update. */
  invalidateCache(tenantId: string, name: string) {
    agentCache.delete(`${tenantId}:${name}`);
  }

  /**
   * Load an agent by role (e.g. 'legal_specialist') — used by orchestrator
   * to fetch knowledge_filter when scoping RAG calls.
   * Cached under role key (separate from name cache).
   */
  async getAgentByRole(tenantId: string, role: string): Promise<AiAgent | null> {
    const cacheKey = `${tenantId}:role:${role}`;
    const cached = agentCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.agent;

    try {
      return await this.withTenant(tenantId, async (client) => {
        const res = await client.query(
          `SELECT *,
                  COALESCE(knowledge_filter, '{}'::jsonb) AS knowledge_filter
             FROM ai_agents
            WHERE role = $1 AND ${TENANT_FILTER} AND active = true
            LIMIT 1`,
          [role]
        );
        if (!res.rows.length) return null;
        const agent = this.rowToAgent(res.rows[0]);
        agentCache.set(cacheKey, { agent, expiresAt: Date.now() + AGENT_CACHE_TTL_MS });
        return agent;
      });
    } catch (e) {
      logger.warn(`AgentRepository.getAgentByRole failed for '${role}':`, e);
      return null;
    }
  }

  /** List all agents for a tenant. */
  async listAgents(tenantId: string): Promise<AiAgent[]> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT * FROM ai_agents WHERE ${TENANT_FILTER} ORDER BY created_at ASC`
      );
      return res.rows.map(this.rowToAgent);
    });
  }

  /** Update an agent's config (skills, system_instruction, model). */
  async updateAgent(tenantId: string, agentId: string, patch: {
    systemInstruction?: string;
    skills?: AgentSkill[];
    model?: string | null;
    displayName?: string;
    description?: string;
    active?: boolean;
  }): Promise<AiAgent> {
    return this.withTenant(tenantId, async (client) => {
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      if (patch.systemInstruction !== undefined) {
        sets.push(`system_instruction = $${idx++}`);
        vals.push(patch.systemInstruction);
      }
      if (patch.skills !== undefined) {
        sets.push(`skills = $${idx++}::jsonb`);
        vals.push(JSON.stringify(patch.skills));
      }
      if (patch.model !== undefined) {
        sets.push(`model = $${idx++}`);
        vals.push(patch.model);
      }
      if (patch.displayName !== undefined) {
        sets.push(`display_name = $${idx++}`);
        vals.push(patch.displayName);
      }
      if (patch.description !== undefined) {
        sets.push(`description = $${idx++}`);
        vals.push(patch.description);
      }
      if (patch.active !== undefined) {
        sets.push(`active = $${idx++}`);
        vals.push(patch.active);
      }
      sets.push('updated_at = CURRENT_TIMESTAMP');

      vals.push(agentId, tenantId);
      const res = await client.query(
        `UPDATE ai_agents SET ${sets.join(', ')}
         WHERE id = $${idx++} AND tenant_id = $${idx++}
         RETURNING *`,
        vals
      );
      if (!res.rows.length) throw new Error('Agent not found');
      const agent = this.rowToAgent(res.rows[0]);
      // Invalidate cache by name
      agentCache.delete(`${tenantId}:${agent.name}`);
      return agent;
    });
  }

  // ── Memory CRUD ────────────────────────────────────────────────────────────

  /**
   * Save an analysis result to agent memory.
   * Also trims old memories to keep only the last MAX_MEMORIES per lead.
   */
  async saveMemory(tenantId: string, agentId: string, leadId: string, summary: string, signals: Record<string, any> = {}): Promise<AgentMemory> {
    const MAX_MEMORIES = 25; // I2: Increased from 10 — supports VIP leads with high interaction volume

    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO ai_agent_memories (tenant_id, agent_id, lead_id, summary, signals)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [tenantId, agentId, leadId, summary, JSON.stringify(signals)]
      );

      // Trim old memories: keep newest MAX_MEMORIES, delete the rest
      await client.query(
        `DELETE FROM ai_agent_memories
         WHERE agent_id = $1 AND lead_id = $2 AND tenant_id = $3
           AND id NOT IN (
             SELECT id FROM ai_agent_memories
             WHERE agent_id = $1 AND lead_id = $2 AND tenant_id = $3
             ORDER BY created_at DESC
             LIMIT $4
           )`,
        [agentId, leadId, tenantId, MAX_MEMORIES]
      );

      return this.rowToMemory(res.rows[0]);
    });
  }

  /**
   * Retrieve the N most recent memories for a lead.
   * Returned in chronological order (oldest first) for prompt injection.
   */
  async getLeadMemories(tenantId: string, agentId: string, leadId: string, limit = 3): Promise<AgentMemory[]> {
    try {
      return await this.withTenant(tenantId, async (client) => {
        const res = await client.query(
          `SELECT * FROM ai_agent_memories
           WHERE agent_id = $1 AND lead_id = $2 AND ${TENANT_FILTER}
           ORDER BY created_at DESC
           LIMIT $3`,
          [agentId, leadId, limit]
        );
        // Reverse so oldest is first (for chronological narrative in prompt)
        return res.rows.map(this.rowToMemory).reverse();
      });
    } catch (e) {
      logger.warn('AgentRepository.getLeadMemories failed:', e);
      return [];
    }
  }

  /** All memories for a lead across all agents (for admin view). */
  async getAllLeadMemories(tenantId: string, leadId: string, limit = 20): Promise<(AgentMemory & { agentName: string })[]> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT m.*, a.name as agent_name
         FROM ai_agent_memories m
         JOIN ai_agents a ON a.id = m.agent_id
         WHERE m.lead_id = $1 AND m.${TENANT_FILTER}
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [leadId, limit]
      );
      return res.rows.map(row => ({ ...this.rowToMemory(row), agentName: row.agent_name }));
    });
  }

  // ── Property (listing) memory — for VALUATION agent ────────────────────────

  /**
   * Retrieve the N most recent valuation memories for a specific listing.
   * Returned in chronological order (oldest first) for prompt injection.
   */
  async getPropertyMemories(tenantId: string, agentId: string, listingId: string, limit = 3): Promise<AgentMemory[]> {
    try {
      return await this.withTenant(tenantId, async (client) => {
        const res = await client.query(
          `SELECT * FROM ai_agent_memories
           WHERE agent_id = $1 AND listing_id = $2 AND ${TENANT_FILTER}
           ORDER BY created_at DESC
           LIMIT $3`,
          [agentId, listingId, limit]
        );
        return res.rows.map(this.rowToMemory).reverse();
      });
    } catch (e) {
      logger.warn('AgentRepository.getPropertyMemories failed:', e);
      return [];
    }
  }

  /**
   * Save a valuation result to agent memory for a specific listing.
   * Keeps only the last MAX_MEMORIES per listing to avoid unbounded growth.
   */
  async savePropertyMemory(
    tenantId: string,
    agentId: string,
    listingId: string,
    summary: string,
    signals: ValuationMemorySignals | Record<string, any> = {}
  ): Promise<AgentMemory> {
    const MAX_MEMORIES = 25; // I2: Increased from 10 — supports VIP leads with high interaction volume

    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO ai_agent_memories (tenant_id, agent_id, listing_id, summary, signals)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [tenantId, agentId, listingId, summary, JSON.stringify(signals)]
      );

      await client.query(
        `DELETE FROM ai_agent_memories
         WHERE agent_id = $1 AND listing_id = $2 AND tenant_id = $3
           AND id NOT IN (
             SELECT id FROM ai_agent_memories
             WHERE agent_id = $1 AND listing_id = $2 AND tenant_id = $3
             ORDER BY created_at DESC
             LIMIT $4
           )`,
        [agentId, listingId, tenantId, MAX_MEMORIES]
      );

      return this.rowToMemory(res.rows[0]);
    });
  }

  // ============================================================
  // C1: Prompt Versioning methods
  // ============================================================

  /**
   * Get the currently active prompt version for a given agent+tenant.
   * Returns null if no DB override — caller should fallback to DEFAULT_*_SYSTEM.
   */
  async getActivePrompt(tenantId: string, agentId: string): Promise<AgentPromptVersion | null> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, agent_id, version, system_instruction,
                is_active, change_note, created_by, created_at, updated_at
         FROM agent_prompt_versions
         WHERE tenant_id = $1 AND agent_id = $2 AND is_active = true
         LIMIT 1`,
        [tenantId, agentId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        agentId: r.agent_id,
        version: r.version,
        systemInstruction: r.system_instruction,
        isActive: r.is_active,
        changeNote: r.change_note,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      } as AgentPromptVersion;
    });
  }

  /**
   * Save a new prompt version. Does NOT auto-activate.
   * Call activatePromptVersion() separately to activate.
   */
  async savePromptVersion(
    tenantId: string,
    agentId: string,
    version: string,
    systemInstruction: string,
    changeNote?: string,
    createdBy?: string
  ): Promise<AgentPromptVersion> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO agent_prompt_versions
           (tenant_id, agent_id, version, system_instruction, is_active, change_note, created_by)
         VALUES ($1, $2, $3, $4, false, $5, $6)
         RETURNING *`,
        [tenantId, agentId, version, systemInstruction, changeNote || null, createdBy || null]
      );
      const r = res.rows[0];
      return {
        id: r.id, tenantId: r.tenant_id, agentId: r.agent_id,
        version: r.version, systemInstruction: r.system_instruction,
        isActive: r.is_active, changeNote: r.change_note,
        createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
      } as AgentPromptVersion;
    });
  }

  /**
   * Activate a specific version — deactivates all others for same tenant+agent.
   * Uses a transaction to ensure atomicity.
   */
  async activatePromptVersion(tenantId: string, agentId: string, version: string): Promise<AgentPromptVersion> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `UPDATE agent_prompt_versions
         SET is_active = false, updated_at = NOW()
         WHERE tenant_id = $1 AND agent_id = $2 AND is_active = true`,
        [tenantId, agentId]
      );
      const res = await client.query(
        `UPDATE agent_prompt_versions
         SET is_active = true, updated_at = NOW()
         WHERE tenant_id = $1 AND agent_id = $2 AND version = $3
         RETURNING *`,
        [tenantId, agentId, version]
      );
      if (res.rows.length === 0) throw new Error(`Prompt version not found: ${agentId}@${version}`);
      const r = res.rows[0];
      return {
        id: r.id, tenantId: r.tenant_id, agentId: r.agent_id,
        version: r.version, systemInstruction: r.system_instruction,
        isActive: r.is_active, changeNote: r.change_note,
        createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
      } as AgentPromptVersion;
    });
  }

  /**
   * List all versions for a given agent+tenant, ordered by created_at desc.
   */
  async listPromptVersions(tenantId: string, agentId: string): Promise<AgentPromptVersion[]> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, agent_id, version, system_instruction,
                is_active, change_note, created_by, created_at, updated_at
         FROM agent_prompt_versions
         WHERE tenant_id = $1 AND agent_id = $2
         ORDER BY created_at DESC`,
        [tenantId, agentId]
      );
      return res.rows.map((r: any) => ({
        id: r.id, tenantId: r.tenant_id, agentId: r.agent_id,
        version: r.version, systemInstruction: r.system_instruction,
        isActive: r.is_active, changeNote: r.change_note,
        createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
      })) as AgentPromptVersion[];
    });
  }

  // ============================================================
  // C2: Lead Journey Memory methods
  // ============================================================

  /**
   * Save a journey event for a lead. Called by agents and LiveChat pipeline.
   */
  async saveLeadJourneyEvent(
    tenantId: string,
    leadId: string,
    agentId: string,
    eventType: string,
    summary: string,
    signals: Record<string, any> = {},
    metadata: Record<string, any> = {},
    sessionId?: string,
    source: string = 'chat'
  ): Promise<LeadJourneyEvent> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO lead_journey_memory
           (tenant_id, lead_id, agent_id, session_id, event_type, summary, signals, metadata, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
         RETURNING *`,
        [
          tenantId, leadId, agentId, sessionId || null,
          eventType, summary,
          JSON.stringify(signals), JSON.stringify(metadata), source
        ]
      );
      const r = res.rows[0];
      return {
        id: r.id, tenantId: r.tenant_id, leadId: r.lead_id,
        agentId: r.agent_id, sessionId: r.session_id,
        eventType: r.event_type, summary: r.summary,
        signals: r.signals, metadata: r.metadata,
        source: r.source, createdAt: r.created_at,
      } as LeadJourneyEvent;
    });
  }

  /**
   * Get the full journey for a lead — used by LEAD_ANALYST node.
   * Returns last N events across all agents, ordered newest first.
   */
  async getLeadJourney(
    tenantId: string,
    leadId: string,
    limit: number = 50
  ): Promise<LeadJourneyEvent[]> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, lead_id, agent_id, session_id,
                event_type, summary, signals, metadata, source, created_at
         FROM lead_journey_memory
         WHERE tenant_id = $1 AND lead_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [tenantId, leadId, Math.min(limit, 100)]
      );
      return res.rows.map((r: any) => ({
        id: r.id, tenantId: r.tenant_id, leadId: r.lead_id,
        agentId: r.agent_id, sessionId: r.session_id,
        eventType: r.event_type, summary: r.summary,
        signals: r.signals, metadata: r.metadata,
        source: r.source, createdAt: r.created_at,
      })) as LeadJourneyEvent[];
    });
  }

  /**
   * Get journey events from a specific session — used by C4 LiveChat sync.
   */
  async getSessionJourney(tenantId: string, sessionId: string): Promise<LeadJourneyEvent[]> {
    return this.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, lead_id, agent_id, session_id,
                event_type, summary, signals, metadata, source, created_at
         FROM lead_journey_memory
         WHERE tenant_id = $1 AND session_id = $2
         ORDER BY created_at ASC`,
        [tenantId, sessionId]
      );
      return res.rows.map((r: any) => ({
        id: r.id, tenantId: r.tenant_id, leadId: r.lead_id,
        agentId: r.agent_id, sessionId: r.session_id,
        eventType: r.event_type, summary: r.summary,
        signals: r.signals, metadata: r.metadata,
        source: r.source, createdAt: r.created_at,
      })) as LeadJourneyEvent[];
    });
  }

  /**
   * N1: Tenant-level prompt customization
   * Merges tenant-specific overrides into a base system prompt.
   * Sections are delimited by === SECTION_NAME === markers in the prompt.
   * Tenant can override: brand_name, focus_area, language, custom_instructions
   */
  async mergeTenantPrompt(
    basePrompt: string,
    tenantId: string
  ): Promise<string> {
    try {
      const result = await pool.query<{
        brand_name?: string;
        focus_area?: string;
        language?: string;
        custom_instructions?: string;
      }>(
        `SELECT brand_name, focus_area, language, custom_instructions
         FROM tenant_prompt_overrides
         WHERE tenant_id = $1
         LIMIT 1`,
        [tenantId]
      );
      if (result.rows.length === 0) return basePrompt;
      const override = result.rows[0];
      let merged = basePrompt;
      if (override.brand_name) {
        merged = merged.replace(/SGS LAND|SGSLand/g, override.brand_name);
      }
      if (override.focus_area) {
        merged = merged + `\n\n=== TENANT FOCUS ===\n${override.focus_area}`;
      }
      if (override.custom_instructions) {
        merged = merged + `\n\n=== CUSTOM INSTRUCTIONS ===\n${override.custom_instructions}`;
      }
      return merged;
    } catch {
      return basePrompt; // graceful fallback — never break on prompt merge failure
    }
  }

  /**
   * N2: Track prompt performance per version
   */
  async logPromptPerformance(params: {
    tenantId: string;
    agentId: string;
    promptVersion: string;
    sessionId: string;
    confidenceScore?: number;
    wasEscalated?: boolean;
    responseTimeMs?: number;
    tokensUsed?: number;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO prompt_performance_log
          (tenant_id, agent_id, prompt_version, session_id, confidence_score,
           was_escalated, response_time_ms, tokens_used, logged_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         ON CONFLICT DO NOTHING`,
        [
          params.tenantId, params.agentId, params.promptVersion,
          params.sessionId, params.confidenceScore ?? null,
          params.wasEscalated ?? false, params.responseTimeMs ?? null,
          params.tokensUsed ?? null,
        ]
      );
    } catch {
      // fire-and-forget — never throw
    }
  }

  /**
   * N2: Get prompt performance metrics by agent + version
   */
  async getPromptPerformanceMetrics(tenantId: string, agentId?: string): Promise<{
    agentId: string;
    promptVersion: string;
    sessionCount: number;
    avgConfidence: number | null;
    escalationRate: number;
    avgResponseTimeMs: number | null;
  }[]> {
    const result = await pool.query(
      `SELECT
         agent_id AS "agentId",
         prompt_version AS "promptVersion",
         COUNT(*) AS "sessionCount",
         ROUND(AVG(confidence_score)::numeric, 3) AS "avgConfidence",
         ROUND(AVG(CASE WHEN was_escalated THEN 1.0 ELSE 0.0 END)::numeric, 3) AS "escalationRate",
         ROUND(AVG(response_time_ms)::numeric, 0) AS "avgResponseTimeMs"
       FROM prompt_performance_log
       WHERE tenant_id = $1
         ${agentId ? 'AND agent_id = $2' : ''}
       GROUP BY agent_id, prompt_version
       ORDER BY agent_id, prompt_version DESC`,
      agentId ? [tenantId, agentId] : [tenantId]
    );
    return result.rows;
  }
}

export const agentRepository = new AgentRepository();
