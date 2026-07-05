import { Injectable, NotFoundException } from '@nestjs/common';
import { Property } from '@prisma/client';
import { PropertiesRepository } from './properties.repository';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertyDto } from './dto/query-property.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Business logic for Property. Pure orchestration — no direct Prisma calls
 * here, everything persistence-related goes through PropertiesRepository.
 */
@Injectable()
export class PropertiesService {
  constructor(private readonly repo: PropertiesRepository) {}

  async search(tenantId: string, query: QueryPropertyDto): Promise<PaginatedResult<Property>> {
    const { items, total } = await this.repo.findMany(tenantId, query);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(tenantId: string, id: string): Promise<Property> {
    const property = await this.repo.findById(tenantId, id);
    if (!property) {
      throw new NotFoundException(`Property ${id} not found`);
    }
    return property;
  }

  async create(tenantId: string, brokerId: string | null, dto: CreatePropertyDto): Promise<Property> {
    return this.repo.create({
      tenant: { connect: { id: tenantId } },
      ...(brokerId ? { broker: { connect: { id: brokerId } } } : {}),
      ...(dto.projectId ? { project: { connect: { id: dto.projectId } } } : {}),
      ...(dto.provinceId ? { province: { connect: { id: dto.provinceId } } } : {}),
      ...(dto.districtId ? { district: { connect: { id: dto.districtId } } } : {}),
      ...(dto.wardId ? { ward: { connect: { id: dto.wardId } } } : {}),
      title: dto.title,
      slug: slugify(dto.title),
      description: dto.description,
      type: dto.type,
      listingType: dto.listingType ?? 'SALE',
      price: dto.price,
      area: dto.area,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      direction: dto.direction,
      legalStatus: dto.legalStatus ?? 'UNKNOWN',
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isFeatured: dto.isFeatured ?? false,
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePropertyDto): Promise<Property> {
    await this.getById(tenantId, id); // ensures existence + tenant scoping
    return this.repo.update(tenantId, id, { ...dto });
  }

  async archive(tenantId: string, id: string): Promise<Property> {
    await this.getById(tenantId, id);
    return this.repo.softDelete(tenantId, id);
  }
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36)
  );
}
