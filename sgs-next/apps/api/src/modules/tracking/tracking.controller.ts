import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TrackingService } from './tracking.service';
import { CreateVisitorEventDto } from './dto/create-visitor-event.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { IdentifyVisitorDto } from './dto/identify-visitor.dto';
import { RequestErasureDto } from './dto/request-erasure.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

function extractUserAgent(req: Request): string | undefined {
  const value = req.headers['user-agent'];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Public, unauthenticated surface consumed by the anonymous tracking SDK
 * (see packages/tracking-sdk). A rate limiter / bot filter should sit in
 * front of this in production — out of scope for this scaffold.
 */
@Controller('tracking')
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Post('events')
  trackEvent(@CurrentTenant() tenantId: string, @Body() dto: CreateVisitorEventDto) {
    return this.service.trackEvent(tenantId, dto);
  }

  @Post('consent')
  recordConsent(@CurrentTenant() tenantId: string, @Body() dto: RecordConsentDto, @Req() req: Request) {
    return this.service.recordConsent(tenantId, dto, req.ip, extractUserAgent(req));
  }

  @Get('consent/:visitorKey')
  getConsentState(@CurrentTenant() tenantId: string, @Param('visitorKey') visitorKey: string) {
    return this.service.getConsentState(tenantId, visitorKey);
  }

  @Post('identify')
  identifyVisitor(@CurrentTenant() tenantId: string, @Body() dto: IdentifyVisitorDto) {
    return this.service.identifyVisitor(tenantId, dto);
  }

  @Post('erasure-requests')
  requestErasure(@CurrentTenant() tenantId: string, @Body() dto: RequestErasureDto) {
    return this.service.requestErasure(tenantId, dto);
  }
}
