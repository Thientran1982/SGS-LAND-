import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { LeadSource } from '@prisma/client';

/**
 * Fired at the moment of "identity resolution": the anonymous visitor calls
 * the hotline, opens Zalo OA, submits a contact form, or requests an AI
 * valuation with their phone number. This is the progressive-profiling
 * merge point — the visitor's prior anonymous history becomes attached to a
 * real CRM Lead without ever having forced a signup.
 */
export class IdentifyVisitorDto {
  @IsString()
  visitorKey!: string;

  @IsString()
  customerName!: string;

  @IsString()
  customerPhone!: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}
