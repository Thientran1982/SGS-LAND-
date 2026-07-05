import { Injectable } from '@nestjs/common';
import { ConsentCategory, Prisma, TrackingEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateVisitor(tenantId: string, visitorKey: string) {
    const existing = await this.prisma.visitorProfile.findUnique({
      where: { tenantId_visitorKey: { tenantId, visitorKey } },
    });
    if (existing) {
      return this.prisma.visitorProfile.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    }
    return this.prisma.visitorProfile.create({ data: { tenantId, visitorKey } });
  }

  async latestConsent(visitorProfileId: string, category: ConsentCategory) {
    return this.prisma.consentRecord.findFirst({
      where: { visitorProfileId, category },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConsentRecord(data: Prisma.ConsentRecordCreateInput) {
    return this.prisma.consentRecord.create({ data });
  }

  async createEvent(data: Prisma.TrackingEventCreateInput) {
    return this.prisma.trackingEvent.create({ data });
  }

  async countRecentPropertyViews(visitorProfileId: string, propertyId: string, sinceHours: number) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return this.prisma.trackingEvent.count({
      where: {
        visitorProfileId,
        propertyId,
        type: TrackingEventType.PROPERTY_VIEW,
        createdAt: { gte: since },
      },
    });
  }

  async findLeadByPhone(tenantId: string, phone: string) {
    return this.prisma.lead.findFirst({ where: { tenantId, customerPhone: phone } });
  }

  async createLead(data: Prisma.LeadCreateInput) {
    return this.prisma.lead.create({ data });
  }

  async linkVisitorToLead(visitorProfileId: string, leadId: string) {
    return this.prisma.visitorProfile.update({
      where: { id: visitorProfileId },
      data: { leadId, isIdentified: true, mergedAt: new Date() },
    });
  }

  async createErasureRequest(data: Prisma.DataErasureRequestCreateInput) {
    return this.prisma.dataErasureRequest.create({ data });
  }
}
