/**
 * svgSanitizer.ts
 *
 * Server-side SVG sanitizer + data-code extractor for the Sa bàn (interactive
 * floor plan) feature. Uses cheerio in XML mode (already a project dependency).
 *
 * Sanitization strategy = strict element + attribute whitelist:
 *  - Allowed tags: a hard list of presentational SVG elements only.
 *    Anything else (script, foreignObject, iframe, video, audio, ...) is dropped.
 *  - Allowed attributes: structural + presentational + namespaced (xmlns:*).
 *    `on*` event handlers, `style` declarations containing `expression(`/`url(javascript:)`,
 *    and any attribute whose value starts with `javascript:` or `data:` (except images)
 *    are stripped.
 *  - `<use href|xlink:href>` must reference local fragments (#…) only — external
 *    refs are dropped (prevents SSRF + XXE-like exfil through SVG <use>).
 *  - `data-*` attributes are preserved (we need `data-code` for the mapping).
 */

import * as cheerio from 'cheerio';

// Hard allow-list of SVG elements we accept. Everything else is dropped.
// Includes the structural + most presentational shape/text/gradient elements.
// Deliberately excludes: script, foreignObject, iframe, video, audio, animate*,
// set, switch, image (kept off — disallow embedded raster/external URIs), use
// is allowed but only with local fragment refs (validated separately).
const ALLOWED_TAGS = new Set<string>([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'metadata',
  'style', // style content is sanitized (CSS only, no @import / expression)
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'text',
  'tspan',
  'textPath',
  'lineargradient',
  'radialgradient',
  'stop',
  'pattern',
  'mask',
  'clippath',
  'filter',
  'fegaussianblur',
  'feoffset',
  'feblend',
  'femerge',
  'femergenode',
  'fecolormatrix',
  'fecomposite',
  'feflood',
  'marker',
]);

// Attribute allow-list. Anything not in this set is dropped (after lowercasing
// the attr name). Namespaced xmlns:* attributes are allowed via prefix check.
const ALLOWED_ATTRS = new Set<string>([
  // structural
  'id',
  'class',
  'viewbox',
  'width',
  'height',
  'x',
  'y',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'd',
  'points',
  'preserveaspectratio',
  'transform',
  'gradienttransform',
  'patterntransform',
  'fx',
  'fy',
  'spreadmethod',
  'gradientunits',
  'patternunits',
  'maskunits',
  'clippathunits',
  'markerunits',
  'markerwidth',
  'markerheight',
  'orient',
  'refx',
  'refy',
  'href',
  'xlink:href', // validated separately — must be local fragment
  // presentational
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'visibility',
  'display',
  'color',
  'cursor',
  'pointer-events',
  'shape-rendering',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'word-spacing',
  'text-decoration',
  'style',
  'offset',
  'stop-color',
  'stop-opacity',
  'in',
  'in2',
  'result',
  'mode',
  'stddeviation',
  'flood-color',
  'flood-opacity',
  'values',
  'type',
  // namespacing
  'version',
  'xmlns',
  // accessibility
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
]);

// CSS-in-style-attr rejection patterns
const DANGEROUS_CSS_RE = /(expression\s*\(|url\s*\(\s*['"]?\s*javascript:|@import|behaviou?r\s*:)/i;

export interface SanitizeResult {
  /** Sanitized SVG markup (XML serialized). */
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
 * Throws if input does not contain a root <svg>.
 */
export function sanitizeAndParseSvg(rawSvg: string): SanitizeResult {
  if (typeof rawSvg !== 'string' || rawSvg.length === 0) {
    throw new Error('SVG_EMPTY');
  }
  // Cap to 2 MB before parsing (defense-in-depth — multer also caps).
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

  const $ = cheerio.load(rawSvg, { xmlMode: true, decodeEntities: true });

  let removedTags = 0;
  let removedAttrs = 0;
  let removedRefs = 0;

  // Walk every element, drop disallowed tags, sanitize attributes.
  $('*').each((_i, el) => {
    if (el.type !== 'tag') return;
    const tagName = String((el as cheerio.Element).name || '').toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      $(el).remove();
      removedTags += 1;
      return;
    }

    const attribs = (el as cheerio.Element).attribs || {};
    for (const rawName of Object.keys(attribs)) {
      const name = rawName.toLowerCase();
      const val = attribs[rawName];

      // Always drop event handlers
      if (name.startsWith('on')) {
        $(el).removeAttr(rawName);
        removedAttrs += 1;
        continue;
      }
      // Allow xmlns:* namespacing
      if (name.startsWith('xmlns:')) continue;
      // Preserve data-* (we need data-code, and other data-* are inert).
      if (name.startsWith('data-')) continue;

      if (!ALLOWED_ATTRS.has(name)) {
        $(el).removeAttr(rawName);
        removedAttrs += 1;
        continue;
      }

      // href / xlink:href: only allow local fragment refs (#foo)
      if (name === 'href' || name === 'xlink:href') {
        const trimmed = (val ?? '').trim();
        if (!trimmed.startsWith('#')) {
          $(el).removeAttr(rawName);
          removedRefs += 1;
        }
        continue;
      }

      // style attribute: reject anything with expression() / javascript: / @import
      if (name === 'style' && val && DANGEROUS_CSS_RE.test(val)) {
        $(el).removeAttr(rawName);
        removedAttrs += 1;
        continue;
      }

      // Generic javascript:/vbscript: in any other attribute
      if (val && /^\s*(javascript|vbscript|data):/i.test(val)) {
        $(el).removeAttr(rawName);
        removedAttrs += 1;
      }
    }
  });

  // Sanitize <style> text content
  $('style').each((_i, el) => {
    const txt = $(el).text() || '';
    if (DANGEROUS_CSS_RE.test(txt)) {
      $(el).text(''); // wipe rather than remove (keeps structure)
      removedAttrs += 1;
    }
  });

  // Extract distinct data-code values (case-insensitive uniqueness).
  const codeSet = new Set<string>();
  $('[data-code]').each((_i, el) => {
    const v = $(el).attr('data-code');
    if (typeof v === 'string') {
      const norm = v.trim().toUpperCase();
      if (norm.length > 0 && norm.length <= 64) {
        codeSet.add(norm);
      }
    }
  });

  const sanitized = $.xml();

  return {
    svg: sanitized,
    codes: Array.from(codeSet).sort(),
    removed: { tags: removedTags, attrs: removedAttrs, refs: removedRefs },
  };
}
