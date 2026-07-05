import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { PropertyType, ListingType, LegalStatus, Direction } from '@prisma/client';

/**
 * Payload for creating a new Property listing.
 * tenantId/brokerId are injected server-side from the authenticated
 * request context, never trusted from client input.
 */
export class CreatePropertyDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PropertyType)
  type!: PropertyType;

  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  area!: number;

  @IsOptional()
  @IsNumber()
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction;

  @IsOptional()
  @IsEnum(LegalStatus)
  legalStatus?: LegalStatus;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
