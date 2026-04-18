#!/usr/bin/env node
/**
 * geo-monitor.mjs — SGS Land GEO (Generative Engine Optimization) Monitor
 *
 * Runs weekly. For each test query, asks AI engines (Gemini + optionally
 * OpenAI / Anthropic / xAI Grok) and detects whether SGS Land / sgsland.vn
 * is mentioned. Also crawls sgsland.vn to score E-E-A-T signals, entity
 * consistency, and content gaps. Produces JSON + Markdown reports.
 *
 * Run: node geo-monitor.mjs
 * Optional env: OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY,
 *               XAI_API_KEY, TARGET_URL (default https://sgsland.vn)
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────
const TARGET_URL = process.env.TARGET_URL || 'https://sgsland.vn';
const REPORTS_DIR = path.resolve('./reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const BRAND_PATTERNS = [
  /sgs\s*[-_]?\s*land/i,
  /sgsland\.vn/i,
  /sgsland/i,
];

const GEO_TEST_QUERIES = [
  // Project-specific
  'Aqua City Novaland mua ở đâu uy tín?',
  'Đại lý phân phối Aqua City chính thức là ai?',
  'The Global City Masterise mua ở đâu?',
  'Izumi City Bình Dương đại lý bán hàng nào uy tín?',
  'Vinhomes Cần Giờ đặt cọc ở đâu?',
  'Masterise Homes phân phối qua đơn vị nào?',
  // Category
  'Công ty bất động sản uy tín TP.HCM',
  'Đơn vị phân phối bất động sản Khu Đông TP.HCM',
  'Sàn bất động sản uy tín TP.HCM 2025',
  'Mua bất động sản cao cấp TP.HCM nên liên hệ đâu?',
  // Comparison
  'So sánh Aqua City và Global City nên mua cái nào?',
  'Bất động sản Novaland hay Vinhomes đầu tư tốt hơn?',
  // Brand
  'SGS Land là công ty gì?',
  'sgsland.vn bán những dự án nào?',
  'SGS Land có uy tín không?',
];

const COMPETITORS = [
  'batdongsan.com.vn',
  'nhatot.com',
  'chotot.com',
  'cafeland.vn',
  'sgoland.vn',
  'sggland.com',
  'kingsland.vn',
  'gland.com.vn',
  'cenland.vn',
];

const TARGET_PROJECTS = [
  'Aqua City',
  'The Global City',
  'Izumi City',
  'Vinhomes Grand Park',
  'Vinhomes Cần Giờ',
  'Masterise Homes',
  'Lumiere',
];

// Tag each query so the gap detector can suggest the right content type
const QUERY_TOPICS = {
  'Aqua City Novaland mua ở đâu uy tín?':                   ['project:aqua-city', 'distributor'],
  'Đại lý phân phối Aqua City chính thức là ai?':           ['project:aqua-city', 'distributor'],
  'The Global City Masterise mua ở đâu?':                   ['project:global-city', 'distributor'],
  'Izumi City Bình Dương đại lý bán hàng nào uy tín?':      ['project:izumi-city', 'distributor'],
  'Vinhomes Cần Giờ đặt cọc ở đâu?':                        ['project:vinhomes-can-gio', 'distributor'],
  'Masterise Homes phân phối qua đơn vị nào?':              ['developer:masterise', 'distributor'],
  'Công ty bất động sản uy tín TP.HCM':                     ['category:trust-hcm'],
  'Đơn vị phân phối bất động sản Khu Đông TP.HCM':          ['category:east-hcm'],
  'Sàn bất động sản uy tín TP.HCM 2025':                    ['category:trust-hcm', 'freshness:2025'],
  'Mua bất động sản cao cấp TP.HCM nên liên hệ đâu?':       ['category:luxury-hcm'],
  'So sánh Aqua City và Global City nên mua cái nào?':      ['comparison:aqua-vs-global'],
  'Bất động sản Novaland hay Vinhomes đầu tư tốt hơn?':     ['comparison:novaland-vs-vinhomes'],
  'SGS Land là công ty gì?':                                ['brand:about'],
  'sgsland.vn bán những dự án nào?':                        ['brand:projects'],
  'SGS Land có uy tín không?':                              ['brand:trust'],
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function detectMention(text, patterns) {
  if (!text) return false;
  return patterns.some(rx => rx.test(text));
}

function detectCompetitorMentions(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  return COMPETITORS.filter(c => t.includes(c.toLowerCase()));
}

async function safeFetch(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; SGSLand-GEO-Monitor/1.0; +https://sgsland.vn)',
        ...(opts.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Engine adapters — all return { engine, query, response, error, mentioned, competitors }
// ──────────────────────────────────────────────────────────────────────────────
async function askGemini(query) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { engine: 'gemini', query, skipped: 'GEMINI_API_KEY not set' };
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });
    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: 'Bạn là trợ lý hữu ích. Trả lời bằng tiếng Việt, ngắn gọn, có nêu tên công ty/đơn vị cụ thể nếu có.',
        tools: [{ googleSearch: {} }],
      },
    });
    const text = resp.text || '';
    return {
      engine: 'gemini',
      query,
      response: text.slice(0, 4000),
      mentioned: detectMention(text, BRAND_PATTERNS),
      competitors: detectCompetitorMentions(text),
    };
  } catch (err) {
    return { engine: 'gemini', query, error: String(err?.message || err) };
  }
}

async function askOpenAI(query) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { engine: 'openai', query, skipped: 'OPENAI_API_KEY not set' };
  try {
    const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Answer in Vietnamese, concise, name specific companies/distributors if relevant.' },
          { role: 'user', content: query },
        ],
        temperature: 0.4,
      }),
    }, 30000);
    if (!res.ok) return { engine: 'openai', query, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return {
      engine: 'openai',
      query,
      response: text.slice(0, 4000),
      mentioned: detectMention(text, BRAND_PATTERNS),
      competitors: detectCompetitorMentions(text),
    };
  } catch (err) {
    return { engine: 'openai', query, error: String(err?.message || err) };
  }
}

async function askAnthropic(query) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { engine: 'claude', query, skipped: 'ANTHROPIC_API_KEY not set' };
  try {
    const res = await safeFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        system: 'Bạn là trợ lý hữu ích. Trả lời bằng tiếng Việt, ngắn gọn, có nêu tên công ty/đơn vị cụ thể nếu có.',
        messages: [{ role: 'user', content: query }],
      }),
    }, 30000);
    if (!res.ok) return { engine: 'claude', query, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = (data?.content || []).map(c => c.text || '').join('\n');
    return {
      engine: 'claude',
      query,
      response: text.slice(0, 4000),
      mentioned: detectMention(text, BRAND_PATTERNS),
      competitors: detectCompetitorMentions(text),
    };
  } catch (err) {
    return { engine: 'claude', query, error: String(err?.message || err) };
  }
}

async function askGrok(query) {
  const key = process.env.XAI_API_KEY;
  if (!key) return { engine: 'grok', query, skipped: 'XAI_API_KEY not set' };
  try {
    const res = await safeFetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Answer in Vietnamese, concise, name specific companies/distributors if relevant.' },
          { role: 'user', content: query },
        ],
        temperature: 0.4,
      }),
    }, 30000);
    if (!res.ok) return { engine: 'grok', query, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return {
      engine: 'grok',
      query,
      response: text.slice(0, 4000),
      mentioned: detectMention(text, BRAND_PATTERNS),
      competitors: detectCompetitorMentions(text),
    };
  } catch (err) {
    return { engine: 'grok', query, error: String(err?.message || err) };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Site crawl — homepage + key pages for E-E-A-T and entity checks
// ──────────────────────────────────────────────────────────────────────────────
async function fetchPage(url) {
  try {
    const res = await safeFetch(url, {}, 15000);
    if (!res.ok) return { url, ok: false, status: res.status };
    const html = await res.text();
    return { url, ok: true, status: res.status, html };
  } catch (err) {
    return { url, ok: false, error: String(err?.message || err) };
  }
}

async function crawlSiteSnapshot() {
  const candidates = [
    `${TARGET_URL}/`,
    `${TARGET_URL}/about`,
    `${TARGET_URL}/gioi-thieu`,
    `${TARGET_URL}/llms.txt`,
    `${TARGET_URL}/llms-full.txt`,
    `${TARGET_URL}/robots.txt`,
    `${TARGET_URL}/sitemap.xml`,
  ];
  const pages = await Promise.all(candidates.map(fetchPage));
  return pages;
}

function evaluateEEAT(homepage, aboutPage) {
  const html = [homepage?.html || '', aboutPage?.html || ''].join('\n');
  const $ = cheerio.load(html || '<html></html>');
  const text = $('body').text().replace(/\s+/g, ' ').toLowerCase();

  const checks = [
    { id: 'founder_team', label: 'Tên/ảnh nhà sáng lập hoặc đội ngũ',
      pass: /(nhà sáng lập|founder|ceo|giám đốc|đội ngũ|về chúng tôi|về sgs)/.test(text) },
    { id: 'years_in_business', label: 'Số năm hoạt động',
      pass: /(thành lập|founded|since|từ năm|năm thành lập|\b20\d{2}\s*-\s*nay)/.test(text) },
    { id: 'transactions_count', label: 'Số dự án / giao dịch đã thực hiện',
      pass: /(\d+\s*\+?\s*(dự án|giao dịch|khách hàng|sản phẩm))/i.test(text) },
    { id: 'awards', label: 'Giải thưởng / chứng nhận',
      pass: /(giải thưởng|award|chứng nhận|certified|top \d+)/.test(text) },
    { id: 'press_mentions', label: 'Báo chí / truyền thông nhắc đến',
      pass: /(báo chí|truyền thông|press|media|cafef|vneconomy|vnexpress|cafeland)/.test(text) },
    { id: 'physical_address', label: 'Địa chỉ trụ sở',
      pass: /(địa chỉ|trụ sở|văn phòng|tầng \d+|quận \d+|tp\.?\s*hcm|hồ chí minh)/.test(text) },
    { id: 'phone_prominent', label: 'Số điện thoại nổi bật',
      pass: /(0\d{9,10}|\+?84\s?\d{9,10}|hotline)/i.test(text) },
    { id: 'reviews_testimonials', label: 'Đánh giá / lời chứng thực có tên thật',
      pass: /(đánh giá|review|testimonial|khách hàng nói|cảm nhận)/.test(text) },
    { id: 'linkedin_links', label: 'LinkedIn của nhân sự chủ chốt',
      pass: /linkedin\.com/.test(html.toLowerCase()) },
    { id: 'organization_schema', label: 'Schema Organization (JSON-LD)',
      pass: /"@type"\s*:\s*"organization"/i.test(html) },
  ];
  const score = checks.filter(c => c.pass).length;
  return { score, max: checks.length, checks };
}

function evaluateEntityConsistency(homepage) {
  const html = homepage?.html || '';
  const $ = cheerio.load(html || '<html></html>');
  const text = $('body').text();
  const variants = {
    'SGS Land':  (text.match(/SGS Land/g) || []).length,
    'SGSLand':   (text.match(/SGSLand(?!\.)/g) || []).length,
    'sgs land':  (text.match(/\bsgs land\b/g) || []).length,
    'Sgs Land':  (text.match(/\bSgs Land\b/g) || []).length,
    'sgsland.vn':(text.match(/sgsland\.vn/gi) || []).length,
  };
  const totalVariants = Object.entries(variants).filter(([k, v]) => v > 0 && k !== 'SGS Land' && k !== 'sgsland.vn').length;
  const consistent = totalVariants === 0;

  const projectsFound = TARGET_PROJECTS.filter(p =>
    new RegExp(p.replace(/\s+/g, '\\s+'), 'i').test(text)
  );
  const projectsMissing = TARGET_PROJECTS.filter(p => !projectsFound.includes(p));

  return { variants, consistent, projectsFound, projectsMissing };
}

function evaluateTechnicalIndexability(pages) {
  const robots = pages.find(p => p.url.endsWith('/robots.txt'));
  const llms = pages.find(p => p.url.endsWith('/llms.txt'));
  const llmsFull = pages.find(p => p.url.endsWith('/llms-full.txt'));
  const sitemap = pages.find(p => p.url.endsWith('/sitemap.xml'));
  const robotsHtml = (robots?.html || '').toLowerCase();

  const aiBots = ['gptbot', 'oai-searchbot', 'chatgpt-user', 'perplexitybot',
                  'claude-web', 'claudebot', 'google-extended', 'bingbot'];
  const blockedBots = aiBots.filter(b => {
    const rx = new RegExp(`user-agent:\\s*${b}[^\\n]*\\n[\\s\\S]{0,200}?disallow:\\s*/`, 'i');
    return rx.test(robotsHtml);
  });

  return {
    hasRobots:    !!robots?.ok,
    hasSitemap:   !!sitemap?.ok,
    hasLlmsTxt:   !!llms?.ok,
    hasLlmsFull:  !!llmsFull?.ok,
    blockedAiBots: blockedBots,
  };
}

function evaluateStructuredData(homepage) {
  const html = homepage?.html || '';
  const ldRx = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = ldRx.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1])); } catch {}
  }
  const types = new Set();
  const collect = (o) => {
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(collect);
    if (typeof o === 'object') {
      if (o['@type']) {
        Array.isArray(o['@type']) ? o['@type'].forEach(t => types.add(t)) : types.add(o['@type']);
      }
      for (const k of Object.keys(o)) collect(o[k]);
    }
  };
  blocks.forEach(collect);
  const wanted = ['Organization', 'LocalBusiness', 'RealEstateAgent', 'WebSite', 'BreadcrumbList', 'FAQPage'];
  const present = wanted.filter(t => types.has(t));
  return { totalBlocks: blocks.length, types: [...types], wanted, present };
}

// ──────────────────────────────────────────────────────────────────────────────
// Self-test (always runs) — heuristic answer of whether sgsland.vn would be cited
// ──────────────────────────────────────────────────────────────────────────────
function selfTestQuery(query, snapshot) {
  const homepage = snapshot.find(p => p.url === `${TARGET_URL}/`);
  const llmsFull = snapshot.find(p => p.url.endsWith('/llms-full.txt'));
  const corpus = [(homepage?.html || ''), (llmsFull?.html || '')].join('\n').toLowerCase();

  const topics = QUERY_TOPICS[query] || [];
  const tokens = query.toLowerCase()
    .replace(/[?,.!]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  const hits = tokens.filter(w => corpus.includes(w)).length;
  const coverage = tokens.length ? hits / tokens.length : 0;
  const brandOnPage = detectMention(corpus, BRAND_PATTERNS);
  const likelyCited = brandOnPage && coverage >= 0.5;
  return { topics, coverageRatio: Number(coverage.toFixed(2)), brandOnPage, likelyCited };
}

function contentGapRecommendation(query, selfTest) {
  const topics = selfTest.topics || [];
  const recs = [];
  if (topics.some(t => t.startsWith('project:'))) {
    const proj = topics.find(t => t.startsWith('project:')).split(':')[1];
    recs.push(`Tạo landing page “Đại lý phân phối ${proj} chính thức – SGS Land” với: bảng giá tháng hiện tại, chính sách thanh toán, mã căn còn hàng, ảnh hợp đồng phân phối, liên hệ hotline & FAQ 8-10 câu (đặt cọc, vay ngân hàng, tiến độ).`);
  }
  if (topics.includes('distributor')) {
    recs.push('Bổ sung trang “Đối tác phân phối uỷ quyền” liệt kê tất cả CĐT và mã số hợp đồng phân phối, kèm ảnh ký kết — AI engines cần signal “authorized distributor” để cite.');
  }
  if (topics.some(t => t.startsWith('comparison:'))) {
    recs.push(`Tạo bài so sánh dạng bảng (comparison table) cho “${query}” với 8-10 tiêu chí: vị trí, pháp lý, giá/m², tiến độ, tiện ích, mật độ, dòng tiền cho thuê, phù hợp ai. Format dạng list/bảng được trích dẫn 74% nhiều hơn.`);
  }
  if (topics.some(t => t.startsWith('category:'))) {
    recs.push(`Tạo guide “${query}” 1500-2000 từ với: định nghĩa thị trường, top 5 đơn vị (kèm SGS Land), tiêu chí chọn sàn uy tín, FAQ. Mở đầu bằng direct-answer block 40-60 từ.`);
  }
  if (topics.some(t => t.startsWith('brand:'))) {
    recs.push('Cập nhật trang Giới thiệu / About với: năm thành lập, số dự án phân phối, đội ngũ key có ảnh + LinkedIn, giải thưởng, báo chí — boost E-E-A-T để brand query được trả lời chuẩn.');
  }
  if (topics.includes('freshness:2025')) {
    recs.push('Thêm dấu freshness “Cập nhật T01/2026” + bảng số liệu Q1/2026 để vượt nội dung cũ của đối thủ trong AI Overviews.');
  }
  if (recs.length === 0) {
    recs.push('Tạo nội dung trực tiếp trả lời câu hỏi này (FAQ + landing) với data points cụ thể, citations nguồn uy tín, và direct-answer block ở 40-60 từ đầu tiên.');
  }
  return recs;
}

// ──────────────────────────────────────────────────────────────────────────────
// Score (0–100)
// ──────────────────────────────────────────────────────────────────────────────
function computeGeoScore({ aiResults, eeat, structured, entity, technical }) {
  // (1) AI mentions on PROJECT queries (first 6 queries) — 30 pts (3 each × 10)
  // We use first 10 queries (project + category) for the 30-pt block to match spec
  // semantics ("project queries" interpreted broadly; 10 first queries × 3pt).
  const projectQueries = GEO_TEST_QUERIES.slice(0, 10);
  let mentionPts = 0;
  for (const q of projectQueries) {
    const hits = aiResults.filter(r => r.query === q && r.mentioned);
    if (hits.length > 0) mentionPts += 3;
  }
  mentionPts = Math.min(30, mentionPts);

  // (2) E-E-A-T — 20 pts
  const eeatPts = Math.round((eeat.score / eeat.max) * 20);

  // (3) Structured data — 20 pts
  const structPts = Math.min(20, structured.present.length * 4);

  // (4) Entity coverage — 15 pts
  const entityPts = Math.round(
    15 *
      (entity.projectsFound.length / TARGET_PROJECTS.length) *
      (entity.consistent ? 1.0 : 0.7)
  );

  // (5) AI-bot indexability — 15 pts
  const indexPts = technical.blockedAiBots.length === 0 ? 15 : Math.max(0, 15 - technical.blockedAiBots.length * 5);

  const total = mentionPts + eeatPts + structPts + entityPts + indexPts;
  return {
    total,
    breakdown: {
      ai_mentions: { score: mentionPts, max: 30 },
      eeat:        { score: eeatPts,    max: 20 },
      structured:  { score: structPts,  max: 20 },
      entity:      { score: entityPts,  max: 15 },
      indexability:{ score: indexPts,   max: 15 },
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Trend file
// ──────────────────────────────────────────────────────────────────────────────
async function appendTrend(entry) {
  const file = path.join(REPORTS_DIR, 'geo-trend.json');
  let trend = [];
  if (existsSync(file)) {
    try { trend = JSON.parse(await readFile(file, 'utf8')); } catch {}
  }
  trend.push(entry);
  trend = trend.slice(-104); // keep ~2 years of weekly data
  await writeFile(file, JSON.stringify(trend, null, 2));
  return trend;
}

// ──────────────────────────────────────────────────────────────────────────────
// Markdown report
// ──────────────────────────────────────────────────────────────────────────────
function buildMarkdownReport({ score, prevScore, aiResults, gaps, eeat, structured, entity, technical, snapshot }) {
  const enginesUsed = [...new Set(aiResults.filter(r => !r.skipped).map(r => r.engine))];
  const enginesSkipped = [...new Set(aiResults.filter(r => r.skipped).map(r => r.engine))];

  const mentionedPairs = aiResults.filter(r => r.mentioned);
  const notMentionedQueries = GEO_TEST_QUERIES.filter(q =>
    !aiResults.some(r => r.query === q && r.mentioned)
  );

  const competitorAgg = {};
  for (const r of aiResults) {
    for (const c of (r.competitors || [])) {
      competitorAgg[c] = (competitorAgg[c] || 0) + 1;
    }
  }

  const delta = prevScore != null ? score.total - prevScore : null;
  const deltaStr = delta == null ? '— (lần đầu)' : (delta >= 0 ? `+${delta}` : `${delta}`);

  const benchmark = score.total >= 70 ? '🟢 Tháng 7-12 (consistent AI mentions)'
                  : score.total >= 50 ? '🟡 Tháng 4-6 (AI bắt đầu cite)'
                  : '🔴 Tháng 1-3 (đang xây nền móng)';

  const lines = [];
  lines.push(`# GEO Monitor — SGS Land`);
  lines.push('');
  lines.push(`**Thời điểm:** ${new Date().toISOString()}`);
  lines.push(`**Domain:** ${TARGET_URL}`);
  lines.push(`**Engines đã chạy:** ${enginesUsed.join(', ') || '(none)'}${enginesSkipped.length ? `   |   Bỏ qua: ${enginesSkipped.join(', ')} (thiếu API key)` : ''}`);
  lines.push('');
  lines.push(`## GEO Score: **${score.total}/100**   (so với tuần trước: ${deltaStr})`);
  lines.push(`**Benchmark:** ${benchmark}`);
  lines.push('');
  lines.push('| Hạng mục | Điểm | Tối đa |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(score.breakdown)) {
    lines.push(`| ${k} | ${v.score} | ${v.max} |`);
  }
  lines.push('');

  lines.push('## ✅ Queries có cite SGS Land');
  if (mentionedPairs.length === 0) {
    lines.push('_Chưa có engine nào nhắc tên SGS Land trong tuần này._');
  } else {
    for (const r of mentionedPairs) {
      lines.push(`- **[${r.engine}]** ${r.query}`);
    }
  }
  lines.push('');

  lines.push('## ❌ Queries CHƯA được cite — kèm khuyến nghị nội dung');
  for (const q of notMentionedQueries) {
    lines.push(`### ${q}`);
    const recs = gaps[q] || [];
    for (const rec of recs) lines.push(`- ${rec}`);
    lines.push('');
  }

  lines.push('## 🥷 Đối thủ xuất hiện trong câu trả lời AI');
  if (Object.keys(competitorAgg).length === 0) {
    lines.push('_Không phát hiện đối thủ nào trong các trả lời AI tuần này._');
  } else {
    for (const [c, n] of Object.entries(competitorAgg).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${c}** — xuất hiện ${n} lần`);
    }
  }
  lines.push('');

  lines.push(`## 🛡️ E-E-A-T (${eeat.score}/${eeat.max})`);
  for (const c of eeat.checks) {
    lines.push(`- ${c.pass ? '✅' : '❌'} ${c.label}`);
  }
  lines.push('');

  lines.push('## 🧬 Schema có sẵn');
  lines.push(`- Tổng JSON-LD blocks: ${structured.totalBlocks}`);
  lines.push(`- Loại schema phát hiện: ${structured.types.join(', ') || '(none)'}`);
  lines.push(`- Schema mong muốn có: ${structured.wanted.join(', ')}`);
  lines.push(`- Đã có: **${structured.present.join(', ') || '(chưa có)'}**`);
  lines.push('');

  lines.push('## 🏷️ Entity / Project coverage');
  lines.push(`- Tên brand đồng nhất: ${entity.consistent ? '✅' : '⚠️ phát hiện biến thể (Sgs Land / SGSLand…)'}`);
  lines.push(`- Đếm biến thể: ${JSON.stringify(entity.variants)}`);
  lines.push(`- Dự án đã nhắc trên homepage: ${entity.projectsFound.join(', ') || '(none)'}`);
  if (entity.projectsMissing.length) {
    lines.push(`- ⚠️ Dự án CÒN THIẾU trên homepage: **${entity.projectsMissing.join(', ')}**`);
  }
  lines.push('');

  lines.push('## 🤖 AI bot indexability');
  lines.push(`- robots.txt: ${technical.hasRobots ? '✅' : '❌'}`);
  lines.push(`- sitemap.xml: ${technical.hasSitemap ? '✅' : '❌'}`);
  lines.push(`- llms.txt: ${technical.hasLlmsTxt ? '✅' : '❌'}`);
  lines.push(`- llms-full.txt: ${technical.hasLlmsFull ? '✅' : '❌'}`);
  lines.push(`- AI bots bị chặn trong robots.txt: ${technical.blockedAiBots.length === 0 ? '✅ Không có bot bị chặn' : `⚠️ ${technical.blockedAiBots.join(', ')}`}`);
  lines.push('');

  lines.push('## 🎯 Top 3 hành động ưu tiên tuần này');
  const actions = priorityActions({ score, eeat, structured, entity, technical, notMentionedQueries });
  for (const a of actions.slice(0, 3)) lines.push(`1. ${a}`);
  lines.push('');

  lines.push('---');
  lines.push('_Chạy lại mỗi sáng Thứ Hai. Mục tiêu: GEO Score ≥ 70 vào Tháng 6._');
  return lines.join('\n');
}

function priorityActions({ score, eeat, structured, entity, technical, notMentionedQueries }) {
  const actions = [];
  if (technical.blockedAiBots.length > 0) {
    actions.push(`Mở robots.txt cho các AI bot đang bị chặn: ${technical.blockedAiBots.join(', ')} — đây là rào cản kỹ thuật lớn nhất.`);
  }
  if (!technical.hasLlmsTxt || !technical.hasLlmsFull) {
    actions.push('Bổ sung /llms.txt và /llms-full.txt theo chuẩn — tăng khả năng AI engines parse đúng entity SGS Land.');
  }
  if (eeat.score < eeat.max * 0.7) {
    const missing = eeat.checks.filter(c => !c.pass).slice(0, 3).map(c => c.label).join('; ');
    actions.push(`Bổ sung E-E-A-T còn thiếu: ${missing}.`);
  }
  if (entity.projectsMissing.length) {
    actions.push(`Thêm các dự án chưa được nhắc trên homepage: ${entity.projectsMissing.join(', ')} — AI engines cần entity binding rõ ràng.`);
  }
  if (!entity.consistent) {
    actions.push('Chuẩn hoá tên brand thành "SGS Land" duy nhất (loại bỏ biến thể "Sgs Land", "SGSLand").');
  }
  if (structured.present.length < 3) {
    const missing = structured.wanted.filter(t => !structured.present.includes(t)).slice(0, 3).join(', ');
    actions.push(`Triển khai schema JSON-LD còn thiếu: ${missing}.`);
  }
  if (notMentionedQueries.length >= 8) {
    actions.push('Ưu tiên viết landing/FAQ cho 3 query có competitive gap cao nhất (tham khảo phần "Queries CHƯA được cite").');
  }
  if (actions.length === 0) actions.push('GEO foundation đã ổn — duy trì cập nhật nội dung & freshness signals hàng tuần.');
  return actions;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function run() {
  await mkdir(REPORTS_DIR, { recursive: true });
  console.log(`[geo-monitor] Target: ${TARGET_URL}`);
  console.log(`[geo-monitor] Crawling site snapshot…`);
  const snapshot = await crawlSiteSnapshot();
  for (const p of snapshot) {
    console.log(`  ${p.ok ? '✓' : '✗'} ${p.url}${p.ok ? '' : ' — ' + (p.error || `HTTP ${p.status}`)}`);
  }

  const homepage = snapshot.find(p => p.url === `${TARGET_URL}/`);
  const aboutPage = snapshot.find(p => /\/about|gioi-thieu/.test(p.url) && p.ok) || homepage;

  const eeat       = evaluateEEAT(homepage, aboutPage);
  const entity     = evaluateEntityConsistency(homepage);
  const technical  = evaluateTechnicalIndexability(snapshot);
  const structured = evaluateStructuredData(homepage);

  console.log(`[geo-monitor] Querying AI engines for ${GEO_TEST_QUERIES.length} prompts…`);
  const aiResults = [];
  for (const q of GEO_TEST_QUERIES) {
    const batch = await Promise.all([
      askGemini(q),
      askOpenAI(q),
      askAnthropic(q),
      askGrok(q),
    ]);
    for (const r of batch) {
      const tag = r.skipped ? `skip(${r.skipped})` : r.error ? `err(${r.error.slice(0, 60)})` : (r.mentioned ? '✅ mentioned' : '— no mention');
      console.log(`  [${r.engine}] ${q} → ${tag}`);
      aiResults.push(r);
    }
    // Always add self-test as one synthetic engine result
    const st = selfTestQuery(q, snapshot);
    aiResults.push({
      engine: 'self-test',
      query: q,
      response: `coverage=${st.coverageRatio}, brandOnPage=${st.brandOnPage}, likelyCited=${st.likelyCited}`,
      mentioned: st.likelyCited,
      competitors: [],
      selfTest: st,
    });
  }

  // Build content gap recs for queries where NO engine mentioned the brand
  const gaps = {};
  for (const q of GEO_TEST_QUERIES) {
    const anyMention = aiResults.some(r => r.query === q && r.engine !== 'self-test' && r.mentioned);
    if (!anyMention) {
      gaps[q] = contentGapRecommendation(q, aiResults.find(r => r.query === q && r.engine === 'self-test')?.selfTest || { topics: QUERY_TOPICS[q] || [] });
    }
  }

  const score = computeGeoScore({ aiResults, eeat, structured, entity, technical });

  // Trend
  const trendFile = path.join(REPORTS_DIR, 'geo-trend.json');
  let prevScore = null;
  if (existsSync(trendFile)) {
    try {
      const prev = JSON.parse(await readFile(trendFile, 'utf8'));
      prevScore = prev[prev.length - 1]?.score?.total ?? null;
    } catch {}
  }

  const raw = {
    timestamp: new Date().toISOString(),
    target: TARGET_URL,
    score,
    eeat,
    entity,
    technical,
    structured,
    aiResults,
    gaps,
    snapshotUrls: snapshot.map(p => ({ url: p.url, ok: p.ok, status: p.status, error: p.error })),
  };

  const md = buildMarkdownReport({ score, prevScore, aiResults, gaps, eeat, structured, entity, technical, snapshot });

  const jsonFile = path.join(REPORTS_DIR, `geo-monitor-${TIMESTAMP}.json`);
  const mdFile = path.join(REPORTS_DIR, `geo-monitor-${TIMESTAMP}.md`);
  await writeFile(jsonFile, JSON.stringify(raw, null, 2));
  await writeFile(mdFile, md);
  await appendTrend({ timestamp: raw.timestamp, score });

  console.log('');
  console.log(`✅ GEO Score: ${score.total}/100  (prev: ${prevScore ?? 'n/a'})`);
  console.log(`📝 ${mdFile}`);
  console.log(`📦 ${jsonFile}`);
  console.log(`📈 ${trendFile}`);
  console.log('');
  console.log('Schedule: Run every Monday morning. Goal: GEO Score ≥ 70 by Month 6.');
}

run().catch(err => {
  console.error('[geo-monitor] FATAL:', err);
  process.exit(1);
});
