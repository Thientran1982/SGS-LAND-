import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { TrackingEventType } from '@prisma/client';

/**
 * Payload sent by the tracking SDK beacon for a single behavioral event.
 * The service layer must silently drop this unless the visitor currently has
 * an active BEHAVIORAL consent grant — per Nghi dinh 13/2023, behavioral
 * tracking can never be on-by-default.
 */
export class CreateVisitorEventDto {
  @IsString()
  visitorKey!: string;

  @IsEnum(TrackingEventType)
  type!: TrackingEventType;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  scrollDepthPct?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
