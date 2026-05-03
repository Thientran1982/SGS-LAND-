/**
 * AgentRepository
 * Manages named AI agents (like ARIA) and their per-lead memories.
 * Agents have upgradeable skills stored in the database.
 * Memories provide continuity across multiple analyses of the same lead.
 */

import { BaseRepository } from './baseRepository';
import { logger } from '../middleware/logger';

const TENANT_FILTER = `tenant_id = current_setting('app.current_tenant_id', true)::uuid`;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  prompt_fragment: string;
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
        const row = res.rows[0];
        const agent = { ...this.rowToAgent(row), knowledgeFilter: row.knowledge_filter } as AiAgent & { knowledgeFilter?: any };
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
    const MAX_MEMORIES = 10;

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
    const MAX_MEMORIES = 10;

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
}

export const agentRepository = new AgentRepository();
