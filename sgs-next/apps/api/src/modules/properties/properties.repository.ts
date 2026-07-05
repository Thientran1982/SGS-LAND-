import { Injectable } from '@nestjs/common';
import { Prisma, Property } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryPropertyDto } from './dto/query-property.dto';

/**
 * Data-access layer for Property. Owns all Prisma query construction so the
 * service layer stays persistence-agnostic (Clean Architecture boundary).
 */
@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(tenantId: string, query: QueryPropertyDto): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = { tenantId };

    if (query.provinceId) where.provinceId = query.provinceId;
    if (query.districtId) where.districtId = query.districtId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.type) where.type = query.type;
    if (query.listingType) where.listingType = query.listingType;
    if (query.status) where.status = query.status;
    if (query.bedrooms) where.bedrooms = query.bedrooms;

    if (query.priceMin || query.priceMax) {
      where.price = {
        ...(query.priceMin ? { gte: query.priceMin } : {}),
        ...(query.priceMax ? { lte: query.priceMax } : {}),
      };
    }

    if (query.areaMin || query.areaMax) {
      where.area = {
        ...(query.areaMin ? { gte: query.areaMin } : {}),
        ...(query.areaMax ? { lte: query.areaMax } : {}),
      };
    }

    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { description: { contains: query.keyword, mode: 'insensitive' } },
        { address: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async findMany(
    tenantId: string,
    query: QueryPropertyDto,
  ): Promise<{ items: Property[]; total: number }> {
    const where = this.buildWhere(tenantId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { media: true, project: true },
      }),
      this.prisma.property.count({ where }),
    ]);
    return { items, total };
  }

  async findById(tenantId: string, id: string): Promise<Property | null> {
    return this.prisma.property.findFirst({
      where: { id, tenantId },
      include: { media: true, project: true, broker: true, reviews: true },
    });
  }

  async create(data: Prisma.PropertyCreateInput): Promise<Property> {
    return this.prisma.property.create({ data });
  }

  async update(tenantId: string, id: string, data: Prisma.PropertyUpdateInput): Promise<Property> {
    return this.prisma.property.update({
      where: { id },
      data,
    });
  }

  async softDelete(tenantId: string, id: string): Promise<Property> {
    return this.prisma.property.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }
}
