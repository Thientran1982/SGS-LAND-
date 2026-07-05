import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ConsentCategory } from '@prisma/client';

/**
 * One row per grant/withdrawal action (append-only consent ledger).
 * ESSENTIAL cannot be withdrawn — the service layer rejects granted:false
 * for that category, since it is required for basic site operation and is
 * not a "choice" category under Nghi dinh 13/2023 (only BEHAVIORAL /
 * ADVERTISING require an explicit opt-in, off by default).
 */
export class RecordConsentDto {
  @IsString()
  visitorKey!: string;

  @IsEnum(ConsentCategory)
  category!: ConsentCategory;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsString()
  consentVersion?: string;
}
