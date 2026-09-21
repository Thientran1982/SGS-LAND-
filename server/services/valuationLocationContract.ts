/**
 * Canonical location hierarchy used by valuation readers.
 *
 * Location strings are user/provider input, so they are never an authorization
 * boundary and must not be matched by arbitrary token overlap. The matcher
 * below uses the strongest hierarchy that can be extracted and fails closed
 * when an explicit province, district, or project conflicts.
 */
import { createHash } from 'node:crypto';

export type ValuationLocationMatchLevel =
  | 'EXACT'
  | 'PROJECT'
  | 'DISTRICT'
  | 'PROVINCE'
  | 'CONTAINMENT'
  | 'UNKNOWN';

export interface ValuationLocationIdentity {
  normalized: string;
  province: string | null;
  district: string | null;
  project: string | null;
}

export interface ValuationLocationMatch {
  matches: boolean;
  level: ValuationLocationMatchLevel;
  target: ValuationLocationIdentity;
  candidate: ValuationLocationIdentity;
}

export type ValuationLocationAliasLevel = 'province' | 'district' | 'project';

export interface ValuationLocationAlias {
  level: ValuationLocationAliasLevel;
  canonical: string;
  alias: string;
}

const PROVINCE_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'ha noi', aliases: ['ha noi', 'hanoi'] },
  { canonical: 'ho chi minh', aliases: ['ho chi minh', 'hcm', 'saigon', 'sai gon', 'tphcm', 'tp hcm'] },
  { canonical: 'hai phong', aliases: ['hai phong'] },
  { canonical: 'da nang', aliases: ['da nang'] },
  { canonical: 'can tho', aliases: ['can tho'] },
  { canonical: 'dong nai', aliases: ['dong nai'] },
  { canonical: 'binh duong', aliases: ['binh duong'] },
  { canonical: 'ba ria vung tau', aliases: ['ba ria vung tau', 'vung tau', 'ba ria'] },
  { canonical: 'long an', aliases: ['long an'] },
  { canonical: 'tien giang', aliases: ['tien giang'] },
  { canonical: 'ben tre', aliases: ['ben tre'] },
  { canonical: 'tay ninh', aliases: ['tay ninh'] },
  { canonical: 'binh phuoc', aliases: ['binh phuoc'] },
  { canonical: 'lam dong', aliases: ['lam dong'] },
  { canonical: 'khanh hoa', aliases: ['khanh hoa'] },
  { canonical: 'ninh thuan', aliases: ['ninh thuan'] },
  { canonical: 'binh thuan', aliases: ['binh thuan'] },
  { canonical: 'phu yen', aliases: ['phu yen'] },
  { canonical: 'binh dinh', aliases: ['binh dinh'] },
  { canonical: 'quang ngai', aliases: ['quang ngai'] },
  { canonical: 'quang nam', aliases: ['quang nam'] },
  { canonical: 'thua thien hue', aliases: ['thua thien hue', 'hue'] },
  { canonical: 'quang tri', aliases: ['quang tri'] },
  { canonical: 'quang binh', aliases: ['quang binh'] },
  { canonical: 'ha tinh', aliases: ['ha tinh'] },
  { canonical: 'nghe an', aliases: ['nghe an'] },
  { canonical: 'thanh hoa', aliases: ['thanh hoa'] },
  { canonical: 'ninh binh', aliases: ['ninh binh'] },
  { canonical: 'nam dinh', aliases: ['nam dinh'] },
  { canonical: 'thai binh', aliases: ['thai binh'] },
  { canonical: 'ha nam', aliases: ['ha nam'] },
  { canonical: 'hung yen', aliases: ['hung yen'] },
  { canonical: 'hai duong', aliases: ['hai duong'] },
  { canonical: 'bac ninh', aliases: ['bac ninh'] },
  { canonical: 'bac giang', aliases: ['bac giang'] },
  { canonical: 'vinh phuc', aliases: ['vinh phuc'] },
  { canonical: 'phu tho', aliases: ['phu tho'] },
  { canonical: 'thai nguyen', aliases: ['thai nguyen'] },
  { canonical: 'lang son', aliases: ['lang son'] },
  { canonical: 'cao bang', aliases: ['cao bang'] },
  { canonical: 'bac kan', aliases: ['bac kan'] },
  { canonical: 'tuyen quang', aliases: ['tuyen quang'] },
  { canonical: 'ha giang', aliases: ['ha giang'] },
  { canonical: 'lao cai', aliases: ['lao cai'] },
  { canonical: 'yen bai', aliases: ['yen bai'] },
  { canonical: 'son la', aliases: ['son la'] },
  { canonical: 'dien bien', aliases: ['dien bien'] },
  { canonical: 'lai chau', aliases: ['lai chau'] },
  { canonical: 'hoa binh', aliases: ['hoa binh'] },
  { canonical: 'kon tum', aliases: ['kon tum'] },
  { canonical: 'gia lai', aliases: ['gia lai'] },
  { canonical: 'dak lak', aliases: ['dak lak'] },
  { canonical: 'dak nong', aliases: ['dak nong'] },
  { canonical: 'an giang', aliases: ['an giang'] },
  { canonical: 'kien giang', aliases: ['kien giang'] },
  { canonical: 'ca mau', aliases: ['ca mau'] },
  { canonical: 'bac lieu', aliases: ['bac lieu'] },
  { canonical: 'soc trang', aliases: ['soc trang'] },
  { canonical: 'tra vinh', aliases: ['tra vinh'] },
  { canonical: 'vinh long', aliases: ['vinh long'] },
  { canonical: 'hau giang', aliases: ['hau giang'] },
  { canonical: 'dong thap', aliases: ['dong thap'] },
];

const PROJECT_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'aqua city', aliases: ['aqua city', 'aquacity'] },
  { canonical: 'vinhomes grand park', aliases: ['vinhomes grand park', 'vinhome grand park', 'grand park'] },
];

const DISTRICT_NAME_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'binh thanh', aliases: ['binh thanh'] },
  { canonical: 'thu duc', aliases: ['thu duc', 'thu duc city'] },
  { canonical: 'bien hoa', aliases: ['bien hoa'] },
  { canonical: 'ninh kieu', aliases: ['ninh kieu'] },
  { canonical: 'hoan kiem', aliases: ['hoan kiem'] },
  { canonical: 'ba dinh', aliases: ['ba dinh'] },
  { canonical: 'dong da', aliases: ['dong da'] },
  { canonical: 'cau giay', aliases: ['cau giay'] },
  { canonical: 'tay ho', aliases: ['tay ho'] },
  { canonical: 'thanh xuan', aliases: ['thanh xuan'] },
  { canonical: 'hai chau', aliases: ['hai chau'] },
  { canonical: 'ngo quyen', aliases: ['ngo quyen'] },
];

function hasWordSequence(value: string, phrase: string): boolean {
  return new RegExp(`(^| )${phrase.replace(/ /g, ' ')}( |$)`).test(value);
}

export function normalizeValuationLocation(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(?:q|district)\s*([0-9]{1,2})\b/g, 'quan $1')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function extractProvince(normalized: string, approvedAliases: readonly ValuationLocationAlias[] = []): string | null {
  const matches = PROVINCE_ALIASES
    .flatMap(entry => entry.aliases.map(alias => ({ canonical: entry.canonical, alias })))
    .concat(approvedAliases
      .filter(entry => entry.level === 'province')
      .map(entry => ({ canonical: normalizeValuationLocation(entry.canonical), alias: normalizeValuationLocation(entry.alias) })))
    .filter(({ alias }) => hasWordSequence(normalized, alias))
    .sort((a, b) => b.alias.length - a.alias.length);
  return matches[0]?.canonical || null;
}

function extractDistrict(normalized: string, approvedAliases: readonly ValuationLocationAlias[] = []): string | null {
  const numbered = normalized.match(/\b(?:quan|q|district)\s*([0-9]{1,2})\b/);
  if (numbered) return `quan ${Number(numbered[1])}`;

  const named = DISTRICT_NAME_ALIASES
    .flatMap(entry => entry.aliases.map(alias => ({ canonical: entry.canonical, alias })))
    .concat(approvedAliases
      .filter(entry => entry.level === 'district')
      .map(entry => ({ canonical: normalizeValuationLocation(entry.canonical), alias: normalizeValuationLocation(entry.alias) })))
    .filter(({ alias }) => hasWordSequence(normalized, alias))
    .sort((a, b) => b.alias.length - a.alias.length);
  if (named[0]) return named[0].canonical;

  const administrative = normalized.match(/\b(?:huyen|thi xa)\s+([a-z]+(?: [a-z]+){0,2})\b/);
  return administrative?.[1]?.trim() || null;
}

function extractProject(normalized: string, approvedAliases: readonly ValuationLocationAlias[] = []): string | null {
  const matches = PROJECT_ALIASES
    .flatMap(entry => entry.aliases.map(alias => ({ canonical: entry.canonical, alias })))
    .concat(approvedAliases
      .filter(entry => entry.level === 'project')
      .map(entry => ({ canonical: normalizeValuationLocation(entry.canonical), alias: normalizeValuationLocation(entry.alias) })))
    .filter(({ alias }) => hasWordSequence(normalized, alias))
    .sort((a, b) => b.alias.length - a.alias.length);
  return matches[0]?.canonical || null;
}

export function parseValuationLocation(
  value: unknown,
  approvedAliases: readonly ValuationLocationAlias[] = [],
): ValuationLocationIdentity {
  const normalized = normalizeValuationLocation(value);
  return {
    normalized,
    province: extractProvince(normalized, approvedAliases),
    district: extractDistrict(normalized, approvedAliases),
    project: extractProject(normalized, approvedAliases),
  };
}

export function getValuationLocationUnknownLevels(
  identity: ValuationLocationIdentity,
): ValuationLocationAliasLevel[] {
  return (['province', 'district', 'project'] as const)
    .filter(level => !identity[level]);
}

/**
 * Report-safe key for unknown-location telemetry. Known hierarchy values remain
 * reviewable, while the unrecognized portion is a short one-way digest rather
 * than an address or price.
 */
export function buildValuationLocationObservationKey(
  value: unknown,
  approvedAliases: readonly ValuationLocationAlias[] = [],
): string {
  const identity = parseValuationLocation(value, approvedAliases);
  const known = [identity.province, identity.district, identity.project].filter(Boolean).join('|');
  const digest = createHash('sha256').update(identity.normalized).digest('hex').slice(0, 16);
  return `${known ? `${known}|` : ''}unknown:${digest}`;
}

export function buildValuationLocationCandidatePattern(
  value: unknown,
  approvedAliases: readonly ValuationLocationAlias[] = [],
): string {
  const identity = parseValuationLocation(value, approvedAliases);
  const anchor = identity.project || identity.district || identity.province;
  return `%${(anchor || identity.normalized).slice(0, 100)}%`;
}

export function matchValuationLocations(
  targetValue: unknown,
  candidateValue: unknown,
  approvedAliases: readonly ValuationLocationAlias[] = [],
): ValuationLocationMatch {
  const target = parseValuationLocation(targetValue, approvedAliases);
  const candidate = parseValuationLocation(candidateValue, approvedAliases);

  if (!target.normalized || !candidate.normalized) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }
  // An identical opaque string is not evidence of a location match. Without
  // at least one recognized hierarchy level it must remain UNKNOWN, otherwise
  // a regional fallback can be presented as an exact observation.
  if (target.normalized === candidate.normalized
    && (target.province || target.district || target.project)) {
    return { matches: true, level: 'EXACT', target, candidate };
  }
  if (target.province && candidate.province && target.province !== candidate.province) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }
  if (target.project && target.project !== candidate.project) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }
  if (target.project && !candidate.project) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }
  if (target.district && candidate.district && target.district !== candidate.district) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }
  if (target.district && !candidate.district) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }
  if (target.project) {
    return { matches: true, level: 'PROJECT', target, candidate };
  }
  if (target.district) {
    return { matches: true, level: 'DISTRICT', target, candidate };
  }
  if (target.province && candidate.province === target.province) {
    return { matches: true, level: 'PROVINCE', target, candidate };
  }

  if (!target.province && !target.district && !target.project
    && !candidate.province && !candidate.district && !candidate.project) {
    return { matches: false, level: 'UNKNOWN', target, candidate };
  }

  const containment =
    (target.normalized.length >= 8 && candidate.normalized.includes(target.normalized))
    || (candidate.normalized.length >= 8 && target.normalized.includes(candidate.normalized));
  return {
    matches: containment,
    level: containment ? 'CONTAINMENT' : 'UNKNOWN',
    target,
    candidate,
  };
}

export function isValuationLocationMatch(
  targetValue: unknown,
  candidateValue: unknown,
  approvedAliases: readonly ValuationLocationAlias[] = [],
): boolean {
  return matchValuationLocations(targetValue, candidateValue, approvedAliases).matches;
}