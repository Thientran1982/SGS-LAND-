/**
 * svgSanitizer.ts
 *
 * Server-side SVG sanitizer + data-code extractor for the Sa bàn (interactive
 * floor plan) feature.
 *
 * Implementation: DOMPurify (SVG profile) running on top of a JSDOM window.
 * DOMPurify is the project standard for HTML/SVG sanitization; using its SVG
 * profile means we get the same well-audited element/attribute allow-lists
 * the browser-side sanitization uses, and we benefit from CVE updates without
 * maintaining a hand-rolled list.
 *
 * Hardening on top of DOMPurify:
 *   - reject empty / oversized input (defense-in-depth — multer also caps).
 *   - reject DOCTYPE / ENTITY before parsing (XXE).
 *   - require a root <svg> element.
 *   - explicitly forbid <foreignObject> and any 'on*' attribute even though
 *     DOMPurify's SVG profile already does — no harm in saying it twice.
 *   - extract distinct `data-code` values from the sanitized output (not the
 *     raw input), guaranteeing what we store matches what we serve.
 */

import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// jsdom's DOMWindow is structurally compatible with the browser Window that
// DOMPurify expects; keep the cast scoped to this single statement.
const jsdomWindow = new JSDOM('').window;
const DOMPurify = createDOMPurify(jsdomWindow as unknown as Window & typeof globalThis);

// Force the SVG profile + tighten the allow-list further.
// We KEEP `data-*` attributes (we need `data-code`).
// We do NOT allow scripts, foreignObject, image, animate*, set, switch — the
// SVG profile already drops these, but DOMPurify's defaults can be overridden
// by future config changes; making the deny list explicit guards against that.
const PURIFY_CONFIG: any = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Explicitly list the tags we forbid even within the SVG profile.
  FORBID_TAGS: [
    'foreignObject',
    'foreignobject',
    'script',
    'iframe',
    'object',
    'embed',
    'video',
    'audio',
    'image',
    'animate',
    'animateMotion',
    'animateTransform',
    'set',
    'handler',
  ],
  // Drop event handlers + javascript: URIs.
  FORBID_ATTR: [
    'onload',
    'onclick',
    'onerror',
    'onmouseover',
    'onmouseout',
    'onmousemove',
    'onfocus',
    'onblur',
    'onkeyup',
    'onkeydown',
  ],
  // Make sure data-* survives the sanitizer.
  ALLOW_DATA_ATTR: true,
  // We will inject as inline SVG via dangerouslySetInnerHTML — keep it as XML.
  RETURN_TRUSTED_TYPE: false,
};

// CSS-in-style-attr / <style> rejection patterns (defense-in-depth).
const DANGEROUS_CSS_RE = /(expression\s*\(|url\s*\(\s*['"]?\s*javascript:|@import|behaviou?r\s*:)/i;

export interface SanitizeResult {
  /** Sanitized SVG markup (XML serialized, includes <svg> root). */
  svg: string;
  /** Distinct `data-code` values found (uppercased + trimmed). */
  codes: string[];
  /** Removed element / attribute counts (debug only). */
  removed: {
    tags: number;
    attrs: number;
    refs: number;
  };
}

/**
 * Sanitize SVG markup and extract distinct `data-code` values.
 * Throws if input does not contain a root <svg> or violates the structural
 * pre-checks (empty / too large / DOCTYPE / non-SVG).
 */
export function sanitizeAndParseSvg(rawSvg: string): SanitizeResult {
  if (typeof rawSvg !== 'string' || rawSvg.length === 0) {
    throw new Error('SVG_EMPTY');
  }
  if (rawSvg.length > 2 * 1024 * 1024) {
    throw new Error('SVG_TOO_LARGE');
  }
  // Quick sniff: must look like XML/SVG, not HTML/JS/binary.
  const head = rawSvg.slice(0, 1024).toLowerCase();
  if (!head.includes('<svg')) {
    throw new Error('SVG_INVALID_ROOT');
  }
  // Reject obvious DOCTYPE / ENTITY (XXE) before parsing.
  if (/<!doctype|<!entity|<!\[cdata\[/i.test(head)) {
    throw new Error('SVG_DOCTYPE_NOT_ALLOWED');
  }

  // Count what DOMPurify removes for the admin "diff" surface.
  let removedTags = 0;
  let removedAttrs = 0;
  let removedRefs = 0;
  const onTag = (data: any) => {
    if (data?.tagName) removedTags += 1;
  };
  const onAttr = (data: any) => {
    if (!data) return;
    const name = String(data.attrName || '').toLowerCase();
    if (name === 'href' || name === 'xlink:href') removedRefs += 1;
    else removedAttrs += 1;
  };
  // STRICT: any href / xlink:href whose value is NOT a local fragment (#…)
  // is rejected. The SVG is injected inline into the DOM so the response-
  // level CSP does not apply — we must scrub external refs at the bytes.
  // This blocks data:, http(s):, javascript:, and any other absolute URL.
  const onAttrBeforeAccept = (_node: any, data: any) => {
    if (!data) return;
    const name = String(data.attrName || '').toLowerCase();
    if (name === 'href' || name === 'xlink:href') {
      const v = String(data.attrValue ?? '').trim();
      if (!v.startsWith('#') || v.length < 2) {
        // Force DOMPurify to drop this attribute.
        data.keepAttr = false;
        data.forceKeepAttr = false;
        removedRefs += 1;
      }
    }
  };
  DOMPurify.addHook('uponSanitizeElement', onTag);
  DOMPurify.addHook('uponSanitizeAttribute', onAttr);
  DOMPurify.addHook('uponSanitizeAttribute', onAttrBeforeAccept);

  let sanitized: string;
  try {
    // DOMPurify returns the inner HTML of the sanitized fragment as a string.
    sanitized = DOMPurify.sanitize(rawSvg, PURIFY_CONFIG) as unknown as string;
  } finally {
    DOMPurify.removeHook('uponSanitizeElement');
    DOMPurify.removeHook('uponSanitizeAttribute');
  }

  if (!sanitized || !sanitized.toLowerCase().includes('<svg')) {
    throw new Error('SVG_INVALID_ROOT');
  }

  // Re-parse the sanitized output so we (a) extract data-codes from the
  // bytes we will actually serve, and (b) can scrub <style> blocks and any
  // dangerous-looking style attribute values DOMPurify may have allowed.
  const doc = new jsdomWindow.DOMParser().parseFromString(sanitized, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') {
    throw new Error('SVG_INVALID_ROOT');
  }

  // Strip dangerous <style> bodies + style="…" attributes (defense-in-depth
  // for CSS-side XSS like url(javascript:)).
  const styleNodes = doc.getElementsByTagName('style');
  for (let i = 0; i < styleNodes.length; i++) {
    const s = styleNodes[i];
    if (s.textContent && DANGEROUS_CSS_RE.test(s.textContent)) {
      s.textContent = '';
      removedAttrs += 1;
    }
  }
  const all = doc.getElementsByTagName('*');
  const codeSet = new Set<string>();
  for (let i = 0; i < all.length; i++) {
    const el: Element = all[i];
    const styleVal = el.getAttribute('style');
    if (styleVal && DANGEROUS_CSS_RE.test(styleVal)) {
      el.removeAttribute('style');
      removedAttrs += 1;
    }
    // Belt-and-suspenders: re-validate href / xlink:href on the SERIALIZED
    // tree as well — if anything external slipped past the DOMPurify hook
    // (e.g. via a future config change), strip it here too.
    for (const refAttr of ['href', 'xlink:href']) {
      const rv = el.getAttribute(refAttr);
      if (typeof rv === 'string') {
        const t = rv.trim();
        if (!t.startsWith('#') || t.length < 2) {
          el.removeAttribute(refAttr);
          removedRefs += 1;
        }
      }
    }
    const code = el.getAttribute('data-code');
    if (typeof code === 'string') {
      const norm = code.trim().toUpperCase();
      if (norm.length > 0 && norm.length <= 64) codeSet.add(norm);
    }
  }

  const finalSvg = new jsdomWindow.XMLSerializer().serializeToString(root);

  return {
    svg: finalSvg,
    codes: Array.from(codeSet).sort(),
    removed: { tags: removedTags, attrs: removedAttrs, refs: removedRefs },
  };
}
