import { pool } from '../db';
import { logger } from '../middleware/logger';
import type { PromptVariant } from './types';

const MUTATION_POOL = [
  'Hỏi clarifying question để hiểu rõ hơn nhu cầu khách.',
  'Kết thúc bằng call-to-action cụ thể (đặt lịch xem nhà, gọi hotline).',
  'Đề cập giá bằng tỷ VND, làm rõ bao gồm/chưa bao gồm VAT và phí.',
  'Cảnh báo rủi ro pháp lý nếu phát hiện dấu hiệu bất thường trong yêu cầu.',
  'Gợi ý 2 dự án cụ thể phù hợp nhất với ngân sách và khu vực khách đề cập.',
];

function computeFitness(variant: { wins: number; losses: number; generationCount: number }): number {
  const total = variant.wins + variant.losses;
  if (total === 0) return 0.5;
  const winRate = variant.wins / total;
  const recency = Math.max(0, 1 - variant.generationCount * 0.02);
  return winRate * 0.8 + recency * 0.2;
}

function crossover(a: PromptVariant, b: PromptVariant): string {
  const sentencesA = a.systemPromptSuffix.split('. ').filter(Boolean);
  const sentencesB = b.systemPromptSuffix.split('. ').filter(Boolean);
  const pivot = Math.floor(sentencesA.length / 2);
  const childSentences = [
    ...sentencesA.slice(0, pivot),
    ...sentencesB.slice(pivot),
  ];
  return [...new Set(childSentences)].join('. ').trim();
}

function mutate(base: string): string {
  const mutation = MUTATION_POOL[Math.floor(Math.random() * MUTATION_POOL.length)];
  const lines = base.split('. ').filter(Boolean);
  const insertAt = Math.floor(Math.random() * (lines.length + 1));
  lines.splice(insertAt, 0, mutation);
  return [...new Set(lines)].join('. ').trim();
}

function paretoFilter(variants: PromptVariant[]): PromptVariant[] {
  return variants.filter(v => {
    const dominated = variants.some(
      other =>
        other.id !== v.id &&
        other.fitnessScore >= v.fitnessScore &&
        other.generationCount <= v.generationCount &&
        (other.fitnessScore > v.fitnessScore || other.generationCount < v.generationCount),
    );
    return !dominated;
  });
}

export async function runGEPAOptimizer(agentId: string): Promise<void> {
  try {
    const { rows } = await pool.query<PromptVariant>(
      `SELECT id, agent_id AS "agentId", system_prompt_suffix AS "systemPromptSuffix",
              fitness_score AS "fitnessScore", generation_count AS "generationCount",
              wins, losses, created_at AS "createdAt"
       FROM prompt_variants
       WHERE agent_id = $1
       ORDER BY fitness_score DESC
       LIMIT 10`,
      [agentId],
    );

    if (rows.length < 2) {
      const seed = MUTATION_POOL[Math.floor(Math.random() * MUTATION_POOL.length)];
      await pool.query(
        `INSERT INTO prompt_variants (agent_id, system_prompt_suffix, fitness_score, generation_count, wins, losses)
         VALUES ($1, $2, 0.5, 0, 0, 0)`,
        [agentId, seed],
      );
      logger.info(`[GEPA] Seeded initial variant for agent "${agentId}"`);
      return;
    }

    // Recalculate fitness scores
    const scored = rows.map(v => ({ ...v, fitnessScore: computeFitness(v) }));

    // Crossover top-2 high-fitness → child
    const [parent1, parent2] = scored;
    let childSuffix = crossover(parent1, parent2);

    // Mutation: 60% chance
    if (Math.random() < 0.6) {
      childSuffix = mutate(childSuffix);
    }

    // Pareto filter existing variants
    const pareto = paretoFilter(scored);
    const toRetire = scored.filter(v => !pareto.find(p => p.id === v.id));
    if (toRetire.length > 0) {
      await pool.query(
        `DELETE FROM prompt_variants WHERE id = ANY($1::uuid[])`,
        [toRetire.map(v => v.id)],
      );
    }

    // Save new child variant
    const maxGen = Math.max(...scored.map(v => v.generationCount));
    await pool.query(
      `INSERT INTO prompt_variants (agent_id, system_prompt_suffix, fitness_score, generation_count, wins, losses)
       VALUES ($1, $2, $3, $4, 0, 0)`,
      [agentId, childSuffix, 0.5, maxGen + 1],
    );

    logger.info(`[GEPA] Optimizer ran for agent "${agentId}" — ${toRetire.length} retired, 1 new child created (gen ${maxGen + 1})`);
  } catch (err: any) {
    logger.error(`[GEPA] Optimizer error for agent "${agentId}": ${err?.message}`);
  }
}

export async function getBestVariant(agentId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT system_prompt_suffix FROM prompt_variants
       WHERE agent_id = $1
       ORDER BY fitness_score DESC, wins DESC
       LIMIT 1`,
      [agentId],
    );
    return rows[0]?.system_prompt_suffix ?? null;
  } catch {
    return null;
  }
}
