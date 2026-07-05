import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RecommendationsRepository } from './recommendations.repository';

type PropertyWithFeatures = Prisma.PropertyGetPayload<{
  include: {
    project: { include: { developer: true } };
    media: true;
    valuations: true;
  };
}>;

export interface SimilarPropertyResult {
  property: PropertyWithFeatures;
  score: number;
  matchReasons: string[];
}

/**
 * Phase 1 (content-based) recommendation engine — reuses the same feature
 * dimensions as the AI Valuation module (price, area, bedrooms/bathrooms,
 * property type, direction, legal status, project/developer) so a second
 * similarity model does not need to be built and maintained from scratch.
 *
 * TODO(Phase 4, per roadmap): once 2-3 months of TrackingEvent history is
 * available, blend in collaborative filtering — boost properties that
 * visitors with similar view/contact patterns also viewed or contacted.
 * That needs real production traffic data first, so it is intentionally
 * left as a follow-up rather than faked here.
 */
@Injectable()
export class RecommendationsService {
  constructor(private readonly repo: RecommendationsRepository) {}

  async getSimilarProperties(tenantId: string, propertyId: string, limit: number): Promise<SimilarPropertyResult[]> {
    const source = await this.repo.findSourceProperty(tenantId, propertyId);
    const candidates = await this.repo.findCandidates(tenantId, propertyId, source.type, source.provinceId);

    if (candidates.length === 0) return [];

    const priceMax = Math.max(source.price.toNumber(), ...candidates.map((c) => c.price.toNumber()), 1);
    const areaMax = Math.max(source.area, ...candidates.map((c) => c.area), 1);

    const sourceVector = this.buildVector(source, priceMax, areaMax);

    const scored = candidates.map((candidate) => {
      const candidateVector = this.buildVector(candidate, priceMax, areaMax);
      const baseSimilarity = this.cosineSimilarity(sourceVector, candidateVector);

      const matchReasons: string[] = [];
      let boost = 0;

      if (candidate.projectId && candidate.projectId === source.projectId) {
        boost += 0.2;
        matchReasons.push('Cùng dự án');
      }
      const sourceDeveloperId = source.project?.developerId;
      const candidateDeveloperId = candidate.project?.developerId;
      if (sourceDeveloperId && sourceDeveloperId === candidateDeveloperId) {
        boost += 0.15;
        matchReasons.push('Cùng chủ đầu tư');
      }
      if (source.districtId && source.districtId === candidate.districtId) {
        boost += 0.1;
        matchReasons.push('Cùng khu vực');
      }
      if (this.priceBandMatches(source.price.toNumber(), candidate.price.toNumber())) {
        matchReasons.push('Cùng phân khúc giá');
      }

      return {
        property: candidate,
        score: Math.min(1, baseSimilarity + boost),
        matchReasons,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private buildVector(
    property: Pick<PropertyWithFeatures, 'price' | 'area' | 'bedrooms' | 'bathrooms' | 'type' | 'direction' | 'legalStatus'>,
    priceMax: number,
    areaMax: number,
  ): number[] {
    return [
      property.price.toNumber() / priceMax,
      property.area / areaMax,
      (property.bedrooms ?? 0) / 10,
      (property.bathrooms ?? 0) / 10,
    ];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  /** Same "price band" = within +/-20% of each other, a cheap proxy for segment match. */
  private priceBandMatches(priceA: number, priceB: number): boolean {
    if (priceA === 0) return false;
    const ratio = priceB / priceA;
    return ratio >= 0.8 && ratio <= 1.2;
  }
}
