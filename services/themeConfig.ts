
export interface CustomThemeConfig {
  primaryColor: string;
  fontFamily: string;
  fontScale: 'compact' | 'default' | 'large';
  bgApp: string;
  bgSidebar: string;
  bgSurface: string;
}

export const CUSTOM_THEME_STORAGE_KEY = 'sgs_custom_theme';

export function tenantThemeKey(tenantId?: string): string {
  return tenantId ? `sgs_custom_theme:${tenantId}` : CUSTOM_THEME_STORAGE_KEY;
}

export const FONT_FAMILIES: { value: string; label: string; url?: string }[] = [
  { value: 'Inter', label: 'Inter (Mặc định)' },
  { value: 'Be Vietnam Pro', label: 'Be Vietnam Pro', url: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap' },
  { value: 'Roboto', label: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' },
  { value: 'Open Sans', label: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap' },
];

export const FONT_SCALE_OPTIONS: { value: CustomThemeConfig['fontScale']; label: string; size: string }[] = [
  { value: 'compact', label: 'Nhỏ gọn', size: '13px' },
  { value: 'default', label: 'Mặc định', size: '15px' },
  { value: 'large', label: 'Rộng rãi', size: '17px' },
];

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  primaryColor: '#4F46E5',
  fontFamily: 'Inter',
  fontScale: 'default',
  bgApp: '',
  bgSidebar: '',
  bgSurface: '',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

function darkenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, rgb.r - amount);
  const g = Math.max(0, rgb.g - amount);
  const b = Math.max(0, rgb.b - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, rgb.r + amount);
  const g = Math.min(255, rgb.g + amount);
  const b = Math.min(255, rgb.b + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

let _loadedFontUrls = new Set<string>();

function loadGoogleFont(fontFamily: string) {
  const font = FONT_FAMILIES.find(f => f.value === fontFamily);
  if (!font?.url || _loadedFontUrls.has(font.url)) return;
  _loadedFontUrls.add(font.url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = font.url;
  document.head.appendChild(link);
}

const STYLE_TAG_ID = 'sgs-custom-theme-bg';

function applyBgColors(bgApp: string, bgSidebar: string, bgSurface: string) {
  let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  const hasBg = bgApp || bgSidebar || bgSurface;
  if (!hasBg) {
    if (styleEl) styleEl.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_TAG_ID;
    document.head.appendChild(styleEl);
  }
  const HEX_RE = /^#[a-fA-F0-9]{6}$/;
  const rules: string[] = [];
  if (bgApp && HEX_RE.test(bgApp)) rules.push(`--bg-app: ${bgApp};`);
  if (bgSidebar && HEX_RE.test(bgSidebar)) rules.push(`--bg-sidebar: ${bgSidebar};`);
  if (bgSurface && HEX_RE.test(bgSurface)) rules.push(`--bg-surface: ${bgSurface};`);
  styleEl.textContent = `:root.light { ${rules.join(' ')} }`;
}

export function applyCustomTheme(config: Partial<CustomThemeConfig>) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (config.primaryColor && /^#[a-fA-F0-9]{6}$/.test(config.primaryColor)) {
    const primary = config.primaryColor;
    const hover = darkenHex(primary, 28);
    const subtle = lightenHex(primary, 170);
    root.style.setProperty('--primary-600', primary);
    root.style.setProperty('--primary-hover', hover);
    root.style.setProperty('--primary-subtle', subtle);
  }

  if (config.fontFamily !== undefined) {
    if (config.fontFamily && config.fontFamily !== 'Inter') {
      loadGoogleFont(config.fontFamily);
      root.style.setProperty('--custom-font', `'${config.fontFamily}', sans-serif`);
    } else {
      root.style.removeProperty('--custom-font');
    }
  }

  if (config.fontScale !== undefined) {
    const scale = FONT_SCALE_OPTIONS.find(s => s.value === config.fontScale);
    if (scale && scale.value !== 'default') {
      root.style.setProperty('--custom-font-size', scale.size);
    } else {
      root.style.removeProperty('--custom-font-size');
    }
  }

  if (config.bgApp !== undefined || config.bgSidebar !== undefined || config.bgSurface !== undefined) {
    applyBgColors(config.bgApp ?? '', config.bgSidebar ?? '', config.bgSurface ?? '');
  }
}

export function clearCustomTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('--primary-600');
  root.style.removeProperty('--primary-hover');
  root.style.removeProperty('--primary-subtle');
  root.style.removeProperty('--custom-font');
  root.style.removeProperty('--custom-font-size');
  const styleEl = document.getElementById(STYLE_TAG_ID);
  if (styleEl) styleEl.remove();
  try { localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY); } catch (_) {}
}

export function getGlobalCachedTheme(): CustomThemeConfig | null {
  try {
    const r = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
