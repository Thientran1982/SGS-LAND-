import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsentCategory, LeadSource, Prisma, TrackingEventType } from '@prisma/client';
import { TrackingRepository } from './tracking.repository';
import { CreateVisitorEventDto } from './dto/create-visitor-event.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { IdentifyVisitorDto } from './dto/identify-visitor.dto';
import { RequestErasureDto } from './dto/request-erasure.dto';

const HOT_LEAD_REVISIT_THRESHOLD = 3;
const HOT_LEAD_WINDOW_HOURS = 48;
const ERASURE_SLA_HOURS = 72;
const CONSENT_CATEGORIES = [ConsentCategory.ESSENTIAL, ConsentCategory.BEHAVIORAL, ConsentCategory.ADVERTISING];

/**
 * Behavioral tracking, consent ledger, identity resolution (anonymous
 * visitor -> CRM Lead) and data-subject erasure requests.
 *
 * Legal note (Nghi dinh 13/2023/ND-CP + Luat 91/2025/QH15): BEHAVIORAL and
 * ADVERTISING tracking must never run before an explicit, freely-given
 * opt-in. This service enforces that at the write path (trackEvent refuses
 * to persist anything until a granted BEHAVIORAL ConsentRecord exists) so
 * the rule cannot be bypassed by a misconfigured frontend.
 */
@Injectable()
export class TrackingService {
  constructor(private readonly repo: TrackingRepository) {}

  async trackEvent(tenantId: string, dto: CreateVisitorEventDto) {
    const visitor = await this.repo.findOrCreateVisitor(tenantId, dto.visitorKey);

    const consent = await this.repo.latestConsent(visitor.id, ConsentCategory.BEHAVIORAL);
    if (!consent?.granted) {
      return { tracked: false as const, reason: 'behavioral_consent_not_granted' as const };
    }

    await this.repo.createEvent({
      tenant: { connect: { id: tenantId } },
      visitorProfile: { connect: { id: visitor.id } },
      ...(dto.propertyId ? { property: { connect: { id: dto.propertyId } } } : {}),
      type: dto.type,
      durationSeconds: dto.durationSeconds,
      scrollDepthPct: dto.scrollDepthPct,
      source: dto.source,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    });

    let isHotLead = false;
    if (dto.type === TrackingEventType.PROPERTY_VIEW && dto.propertyId) {
      const revisits = await this.repo.countRecentPropertyViews(visitor.id, dto.propertyId, HOT_LEAD_WINDOW_HOURS);
      isHotLead = revisits >= HOT_LEAD_REVISIT_THRESHOLD;
      // TODO(Phase 2): push isHotLead=true to the multi-channel CRM via
      // webhook (bump Lead.score, flag for priority broker follow-up).
      // Needs a real CRM webhook URL/credentials from the client first.
    }

    return { tracked: true as const, isHotLead };
  }

  async recordConsent(tenantId: string, dto: RecordConsentDto, ipAddress?: string, userAgent?: string) {
    if (dto.category === ConsentCategory.ESSENTIAL && dto.granted === false) {
      throw new BadRequestException('ESSENTIAL consent cannot be withdrawn — required for site operation');
    }
    const visitor = await this.repo.findOrCreateVisitor(tenantId, dto.visitorKey);
    const record = await this.repo.createConsentRecord({
      tenantId,
      visitorProfile: { connect: { id: visitor.id } },
      category: dto.category,
      granted: dto.granted,
      consentVersion: dto.consentVersion ?? 'v1',
      ipAddress,
      userAgent,
    });
    return { visitorProfileId: visitor.id, category: record.category, granted: record.granted };
  }

  async getConsentState(tenantId: string, visitorKey: string) {
    const visitor = await this.repo.findOrCreateVisitor(tenantId, visitorKey);
    const entries = await Promise.all(
      CONSENT_CATEGORIES.map(async (category) => {
        if (category === ConsentCategory.ESSENTIAL) return [category, true] as const;
        const record = await this.repo.latestConsent(visitor.id, category);
        return [category, record?.granted ?? false] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<ConsentCategory, boolean>;
  }

  async identifyVisitor(tenantId: string, dto: IdentifyVisitorDto) {
    const visitor = await this.repo.findOrCreateVisitor(tenantId, dto.visitorKey);
    const existingLead = await this.repo.findLeadByPhone(tenantId, dto.customerPhone);

    const lead =
      existingLead ??
      (await this.repo.createLead({
        tenant: { connect: { id: tenantId } },
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        source: dto.source ?? LeadSource.WEBSITE,
        ...(dto.propertyId ? { property: { connect: { id: dto.propertyId } } } : {}),
      }));

    await this.repo.linkVisitorToLead(visitor.id, lead.id);
    return { visitorProfileId: visitor.id, leadId: lead.id, isNewLead: !existingLead };
  }

  async requestErasure(tenantId: string, dto: RequestErasureDto) {
    const requestedAt = new Date();
    const dueAt = new Date(requestedAt.getTime() + ERASURE_SLA_HOURS * 60 * 60 * 1000);

    let visitorProfileId: string | undefined;
    if (dto.visitorKey) {
      const visitor = await this.repo.findOrCreateVisitor(tenantId, dto.visitorKey);
      visitorProfileId = visitor.id;
    }

    const request = await this.repo.createErasureRequest({
      tenantId,
      ...(visitorProfileId ? { visitorProfile: { connect: { id: visitorProfileId } } } : {}),
      requestedEmail: dto.email,
      requestedPhone: dto.phone,
      notes: dto.notes,
      requestedAt,
      dueAt,
    });

    return { id: request.id, dueAt: request.dueAt };
  }
}
