import { Injectable, NotFoundException } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const CANDIDATE_POOL_SIZE = 300;

const RECOMMENDATION_INCLUDE = {
  project: { include: { developer: true } },
  media: { take: 1, orderBy: { createdAt: 'asc' as const } },
  valuations: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

@Injectable()
export class RecommendationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSourceProperty(tenantId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      include: RECOMMENDATION_INCLUDE,
    });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }
    return property;
  }

  /**
   * Content-based candidate pool: same tenant + same property type, published,
   * excluding the source property itself. Same-province candidates are
   * fetched first (better matches for "cùng khu vực"); if that pool is too
   * small the province filter is dropped so we always return *something*.
   */
  async findCandidates(tenantId: string, excludePropertyId: string, type: string, provinceId: string | null) {
    const whereBase = {
      tenantId,
      status: PropertyStatus.PUBLISHED,
      type: type as never,
      id: { not: excludePropertyId },
    };

    if (provinceId) {
      const sameProvince = await this.prisma.property.findMany({
        where: { ...whereBase, provinceId },
        include: RECOMMENDATION_INCLUDE,
        take: CANDIDATE_POOL_SIZE,
        orderBy: { viewCount: 'desc' },
      });
      if (sameProvince.length >= 20) return sameProvince;
    }

    return this.prisma.property.findMany({
      where: whereBase,
      include: RECOMMENDATION_INCLUDE,
      take: CANDIDATE_POOL_SIZE,
      orderBy: { viewCount: 'desc' },
    });
  }
}
