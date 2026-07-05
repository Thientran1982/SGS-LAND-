import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Data-subject access/erasure request intake. The service layer stamps
 * dueAt = requestedAt + 72h, matching the 72-hour handling requirement.
 */
export class RequestErasureDto {
  @IsOptional()
  @IsString()
  visitorKey?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
