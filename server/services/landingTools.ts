import { v4 as uuidv4 } from 'uuid';
import { withTenantContext } from '../db';
import { agentAuditRepository } from '../repositories/agentAuditRepository';

/**
 * Landing-builder tool: dung trang landing cho du an (kem brochure dinh kem).
 * Quota: 2 trang mien phi / user / thang. Qua muc -> PAYWALL.
 * Token budget: moi phan trang co gia token rieng, ghi vao tokens_used.
 * Audit moi thao tac vao agent_audit_events.
 */

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const FREE_LANDING_PAGES = 2;

const SECTION_TOKEN_COST: Record<string, number> = {
    hero: 260,
    gallery: 420,
    legal: 420,
    price: 300,
    amenities: 260,
    contact: 200,
};

export type LandingSection = {
    stage: string;
    title?: string;
    body?: string;
    items?: string[];
    images?: string[];
    tokens: number;
};

function slugify(name: string): string {
    const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u0110\u0111]/g, 'd').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);
    return (base || 'du-an') + '-' + uuidv4().slice(0, 8);
}

async function auditLanding(tenantId: string, action: string, input: Record<string, any>, output: Record<string, any>): Promise<void> {
    try {
        const safeInput = {
            hasBrief: typeof input?.brief === 'string' && input.brief.length > 0,
            briefLength: typeof input?.brief === 'string' ? input.brief.length : 0,
            hasBrochure: typeof input?.brochureText === 'string' && input.brochureText.length > 0,
            language: input?.language === 'en' ? 'en' : 'vi',
        };
        const safeOutput = {
            status: output?.status === 'CREATED' || output?.status === 'PAYWALL' ? output.status : 'UNKNOWN',
            draftCreated: output?.status === 'CREATED',
            hasPageId: Boolean(output?.pageId),
            hasSlug: Boolean(output?.slug),
            quotaUsed: Number.isFinite(Number(output?.quotaUsed)) ? Number(output.quotaUsed) : null,
            quotaLimit: Number.isFinite(Number(output?.quotaLimit)) ? Number(output.quotaLimit) : null,
        };
        await agentAuditRepository.record(tenantId, {
            eventKey: 'landing-tool:' + action + ':' + uuidv4(),
            eventType: 'TOOL_EXECUTION',
            direction: 'OUTBOUND',
            toolName: 'landing_builder',
            entityType: 'landing_page',
           entityId: String(output?.id || ''),
            status: 'SUCCESS',
            input: safeInput,
            output: safeOutput,
            metadata: { surface: 'landing_builder_tool', privacy: 'content-free', schemaVersion: 'v1' },
    });
    } catch (err) {
        console.warn('[landingTools] audit failed:', (err as Error).message);
    }
}

function extractFromBrief(brief: string, brochureText?: string): Record<string, any> {
    const src = (brochureText || '') + '\n' + (brief || '');
    const pick = (re: RegExp): string => {
        const m = src.match(re);
        return m ? m[1].trim() : '';
    };
    const area = pick(/(\d+(?:[.,]\d+)?\s*(?:ha|hecta))/i);
    const price = pick(/(\d+(?:[.,]\d+)?\s*(?:t\u1ef7|ty))/i);
    const amenities: string[] = [];
    const amenMap: Array<[RegExp, string]> = [
        [/bi\u1ec3n|beach/i, 'Cong vien bien'],
        [/tr\u01b0\u1eddng|school/i, 'Truong lien cap'],
        [/du thuy\u1ec1n|marina/i, 'Ben du thuyen'],
        [/qu\u1ea3ng tr\u01b0\u1eddng|plaza/i, 'Quang truong trung tam'],
        [/h\u1ed3 b\u01a1i|pool/i, 'Ho boi'],
        [/th\u1ec3 thao|gym/i, 'Khu the thao'],
    ];
    for (const [re, label] of amenMap) {
        if (re.test(src) && !amenities.includes(label)) amenities.push(label);
    }
    return {
        projectName: pick(/(?:d\u1ef1 \u00e1n|du an)[:\s]+([^\n,]{2,80})/i) || '',
   location: pick(/(?:t\u1ea1i|\u1edf|khu v\u1ef1c)[:\s]+([^\n,]{2,60})/i),
        area: area || '45 ha',
        priceFrom: price || '',
        amenities: amenities.length ? amenities : ['Cong vien bien', 'Truong lien cap', 'Ben du thuyen'],
        hasLegalDoc: /(s\u1ed5 \u0111\u1ecf|gi\u1ea5y ph\u00e9p|ph\u00e1p l\u00fd|1\/500)/i.test(src),
    };
}

function buildSections(brief: Record<string, any>, lang: string): LandingSection[] {
    const vi = lang !== 'en';
    const sections: LandingSection[] = [];
    const add = (stage: string, data: Partial<LandingSection>) => {
        sections.push({ stage, tokens: SECTION_TOKEN_COST[stage], ...data } as LandingSection);
    };
    add('hero', {
        title: brief.projectName || (vi ? 'Du an bat dong san' : 'Real estate project'),
        body: [brief.location || (vi ? 'Vi tri dang cap nhat' : 'Location updating'), brief.area].filter(Boolean).join(' \u00b7 '),
    });
    add('gallery', {
        title: vi ? 'Hinh anh du an' : 'Project gallery',
        items: [vi ? 'Chinh canh du an' : 'Main view', vi ? 'Tien ich' : 'Amenities', vi ? 'Mat bang' : 'Master plan'],
        images: [],
    });
    add('legal', {
        title: vi ? 'Phap ly' : 'Legal',
        body: brief.hasLegalDoc
            ? (vi ? 'Thong tin phap ly trich tu tai lieu kem theo.' : 'Legal info extracted from attached document.')
            : (vi ? 'Chua co thong tin xac thuc - muc de trong cho kiem dinh.' : 'No verified legal info yet.'),
    });
    add('price', {
        title: vi ? 'Gia & thanh toan' : 'Price & payment',
        body: brief.priceFrom
            ? (vi ? 'Tu ' + brief.priceFrom + ' - thanh toan theo tien do' : 'From ' + brief.priceFrom)
            : (vi ? 'Gia dang cap nhat' : 'Price updating'),
    });
    add('amenities', { title: vi ? 'Tien ich' : 'Amenities', items: brief.amenities });
    add('contact', { title: vi ? 'Lien he moi gioi' : 'Contact broker', body: 'SGS LAND' });
    return sections;
}

export interface LandingBuilderResult {
    status: 'CREATED' | 'PAYWALL';
    pageId?: string;
    slug?: string;
    projectName?: string;
    sections?: LandingSection[];
    tokensUsed?: number;
    tokenBudgetPer?: number;
    quotaUsed?: number;
    quotaLimit?: number;
    viewUrl?: string;
    editUrl?: string;
    paywall?: { reason: string; message: string; upgradeUrl: string };
}

export async function handle_landing_builder(args: Record<string, any>): Promise<LandingBuilderResult> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const visitorKey = String(args.visitorKey || args.userId || 'anonymous-widget');
    const projectName = String(args.projectName || args.project_name || '').trim()
        || String(args.brief || '').slice(0, 60)
        || (args.language === 'en' ? 'New project' : 'Du an moi');
    const brief = String(args.brief || '');
    const brochureText = args.brochureText ? String(args.brochureText) : undefined;
    const brochureName = args.brochureName ? String(args.brochureName) : undefined;
    const lang = String(args.language || 'vi');

    const row = await withTenantContext(tenantId, async (client: any) => {
        const quotaRes = await client.query(
            'SELECT count(*) AS used FROM landing_pages WHERE tenant_id = $1 AND visitor_key = $2 AND created_at >= date_trunc(\'month\', CURRENT_DATE)',
            [tenantId, visitorKey],
        );
        const used = Number(quotaRes.rows[0]?.used || 0);

        if (used >= FREE_LANDING_PAGES) {
            return {
                status: 'PAYWALL' as const,
                quotaUsed: used,
                quotaLimit: FREE_LANDING_PAGES,
                paywall: {
                    reason: 'QUOTA_EXCEEDED',
                message: lang === 'en'
                        ? 'You have used your ' + FREE_LANDING_PAGES + ' free landing pages this month. Upgrade to SGS LAND Pro to keep building.'
                        : 'Ban da dung het ' + FREE_LANDING_PAGES + ' trang landing mien phi trong thang nay. Nang cap SGS LAND Pro de dung them.',
                    upgradeUrl: '/billing',
                },
            };
        }

        const extracted = extractFromBrief(brief, brochureText);
        const sections = buildSections(extracted, lang);
        const tokensUsed = sections.reduce((sum, s) => sum + s.tokens, 0);
        const slug = slugify(extracted.projectName || projectName);

        const ins = await client.query(
            'INSERT INTO landing_pages (tenant_id, visitor_key, project_name, slug, brochure_name, brochure_text, sections, tokens_used, language) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) RETURNING id, slug, project_name, sections, tokens_used',
            [tenantId, visitorKey, extracted.projectName || projectName, slug,
             brochureName || null, brochureText || null,
             JSON.stringify(sections), tokensUsed, lang],
        );
        const page = ins.rows[0];
        return {
            status: 'CREATED' as const,
            pageId: page.id,
            slug: page.slug,
            projectName: page.project_name,
            sections: page.sections,
            tokensUsed: page.tokens_used,
            tokenBudgetPer: 4000,
            viewUrl: "/landing/" + page.slug + "?visitorKey=" + encodeURIComponent(visitorKey),
            editUrl: "/landing-ai/chinh-sua/" + page.slug + "?k=" + visitorKey,
            quotaUsed: used + 1,
            quotaLimit: FREE_LANDING_PAGES,
        };
    });

    await auditLanding(tenantId, 'landing_builder', args, row as Record<string, any>);
    return row;
}

export async function handle_landing_quota(args: Record<string, any>): Promise<Record<string, any>> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const visitorKey = String(args.visitorKey || args.userId || 'anonymous-widget');
    const lang = String(args.language || 'vi');

    const row = await withTenantContext(tenantId, async (client: any) => {
        const r = await client.query(
            'SELECT count(*) AS used, COALESCE(SUM(tokens_used), 0) AS tokens FROM landing_pages WHERE tenant_id = $1 AND visitor_key = $2 AND created_at >= date_trunc(\'month\', CURRENT_DATE)',
            [tenantId, visitorKey],
        );
        const used = Number(r.rows[0]?.used || 0);
        return {
            quotaUsed: used,
            quotaLimit: FREE_LANDING_PAGES,
            tokensUsedTotal: Number(r.rows[0]?.tokens || 0),
            remaining: Math.max(0, FREE_LANDING_PAGES - used),
            needsUpgrade: used >= FREE_LANDING_PAGES,
            upgradeUrl: '/billing',
            message: used >= FREE_LANDING_PAGES ? (lang === 'en' ? 'Free quota exhausted.' : 'Da het luot mien phi.') : undefined,
        };
    });

    await auditLanding(tenantId, 'landing_quota', args, row);
    return row;
}
