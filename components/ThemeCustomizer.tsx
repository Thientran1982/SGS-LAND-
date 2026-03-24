import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/dbApi';
import {
  CustomThemeConfig,
  FONT_FAMILIES,
  FONT_SCALE_OPTIONS,
  DEFAULT_CUSTOM_THEME,
  CUSTOM_THEME_STORAGE_KEY,
  applyCustomTheme,
  clearCustomTheme,
} from '../services/theme';

interface ThemeCustomizerProps {
  notify: (msg: string, type: 'success' | 'error') => void;
}

const PRESET_COLORS = [
  { value: '#4F46E5', label: 'Indigo' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#DB2777', label: 'Pink' },
  { value: '#0EA5E9', label: 'Sky' },
  { value: '#059669', label: 'Emerald' },
  { value: '#D97706', label: 'Amber' },
  { value: '#DC2626', label: 'Red' },
  { value: '#0D9488', label: 'Teal' },
];

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={color}
      className={`w-8 h-8 rounded-xl border-2 transition-all shrink-0 ${selected ? 'border-[var(--text-primary)] scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
      style={{ backgroundColor: color }}
    />
  );
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ notify }) => {
  const [config, setConfig] = useState<CustomThemeConfig>({ ...DEFAULT_CUSTOM_THEME });
  const [original, setOriginal] = useState<CustomThemeConfig>({ ...DEFAULT_CUSTOM_THEME });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const previewApplied = useRef(false);

  useEffect(() => {
    setLoading(true);
    db.getThemeConfig().then((data: any) => {
      if (data && data.primaryColor) {
        const cfg: CustomThemeConfig = {
          primaryColor: data.primaryColor ?? DEFAULT_CUSTOM_THEME.primaryColor,
          fontFamily: data.fontFamily ?? DEFAULT_CUSTOM_THEME.fontFamily,
          fontScale: data.fontScale ?? DEFAULT_CUSTOM_THEME.fontScale,
        };
        setConfig(cfg);
        setOriginal(cfg);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const updateConfig = useCallback((patch: Partial<CustomThemeConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      setIsDirty(true);
      applyCustomTheme(next);
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.saveThemeConfig(config);
      try { localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(config)); } catch (_) {}
      applyCustomTheme(config);
      setOriginal({ ...config });
      setIsDirty(false);
      notify('Đã lưu cấu hình giao diện', 'success');
    } catch (e: any) {
      notify(e.message || 'Không thể lưu giao diện', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await db.resetThemeConfig();
      clearCustomTheme();
      setConfig({ ...DEFAULT_CUSTOM_THEME });
      setOriginal({ ...DEFAULT_CUSTOM_THEME });
      setIsDirty(false);
      notify('Đã đặt lại giao diện về mặc định', 'success');
    } catch (e: any) {
      notify(e.message || 'Không thể đặt lại giao diện', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleDiscard = () => {
    setConfig({ ...original });
    applyCustomTheme(original);
    setIsDirty(false);
  };

  if (loading) {
    return (
      <div className="animate-enter max-w-4xl">
        <div className="h-48 flex items-center justify-center text-[var(--text-tertiary)] text-sm animate-pulse">Đang tải cấu hình giao diện...</div>
      </div>
    );
  }

  const previewFont = config.fontFamily === 'Inter' ? 'Inter, sans-serif' : `'${config.fontFamily}', sans-serif`;
  const previewSize = FONT_SCALE_OPTIONS.find(s => s.value === config.fontScale)?.size ?? '15px';

  return (
    <div className="animate-enter max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Tùy Chỉnh Giao Diện</h3>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Điều chỉnh màu sắc chủ đạo, kiểu chữ và kích thước phông để phù hợp với thương hiệu của bạn.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-5">

          {/* Primary color */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Màu chủ đạo</h4>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">Màu này áp dụng cho các nút, liên kết và điểm nhấn trong toàn bộ ứng dụng.</p>

            {/* Preset swatches */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map(p => (
                <ColorSwatch
                  key={p.value}
                  color={p.value}
                  selected={config.primaryColor.toLowerCase() === p.value.toLowerCase()}
                  onClick={() => updateConfig({ primaryColor: p.value })}
                />
              ))}
            </div>

            {/* Custom picker */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={e => updateConfig({ primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-[var(--glass-border)] cursor-pointer p-0.5 bg-transparent"
                  title="Chọn màu tùy chỉnh"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={config.primaryColor}
                  maxLength={7}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[a-fA-F0-9]{0,6}$/.test(v)) updateConfig({ primaryColor: v });
                  }}
                  onBlur={e => {
                    if (!/^#[a-fA-F0-9]{6}$/.test(e.target.value)) {
                      updateConfig({ primaryColor: original.primaryColor });
                    }
                  }}
                  className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm font-mono bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-600)]/20 focus:border-[var(--primary-600)]"
                  placeholder="#4F46E5"
                />
              </div>
              <div
                className="w-10 h-10 rounded-xl border border-[var(--glass-border)] shrink-0"
                style={{ backgroundColor: /^#[a-fA-F0-9]{6}$/.test(config.primaryColor) ? config.primaryColor : DEFAULT_CUSTOM_THEME.primaryColor }}
              />
            </div>
          </div>

          {/* Font Family */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Kiểu chữ</h4>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">Chọn phông chữ phù hợp với phong cách thương hiệu. Tất cả đều hỗ trợ tiếng Việt đầy đủ.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FONT_FAMILIES.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateConfig({ fontFamily: f.value })}
                  className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${config.fontFamily === f.value ? 'border-[var(--primary-600)] bg-[var(--primary-subtle)]' : 'border-[var(--glass-border)] hover:border-[var(--primary-600)]/40 bg-[var(--bg-surface)]'}`}
                >
                  <div
                    className="text-sm font-semibold text-[var(--text-primary)] leading-tight"
                    style={{ fontFamily: f.value === 'Inter' ? 'Inter, sans-serif' : `'${f.value}', sans-serif` }}
                  >
                    {f.label}
                  </div>
                  <div
                    className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-tight"
                    style={{ fontFamily: f.value === 'Inter' ? 'Inter, sans-serif' : `'${f.value}', sans-serif` }}
                  >
                    Bất động sản SGS Land
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Scale */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Kích thước chữ</h4>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">Điều chỉnh kích thước chữ toàn cục để phù hợp với mật độ thông tin mong muốn.</p>
            <div className="grid grid-cols-3 gap-3">
              {FONT_SCALE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => updateConfig({ fontScale: s.value })}
                  className={`py-3 px-4 rounded-xl border-2 text-center transition-all ${config.fontScale === s.value ? 'border-[var(--primary-600)] bg-[var(--primary-subtle)]' : 'border-[var(--glass-border)] hover:border-[var(--primary-600)]/40 bg-[var(--bg-surface)]'}`}
                >
                  <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: s.size }}>Aa</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-1 font-medium">{s.label}</div>
                  <div className="text-xs2 text-[var(--text-muted)] mt-0.5">{s.size}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-3">
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-4">Xem trước</h4>

              {/* Mini sidebar */}
              <div
                className="rounded-xl overflow-hidden border border-[var(--glass-border)] text-[var(--text-primary)]"
                style={{ fontFamily: previewFont, fontSize: previewSize }}
              >
                {/* Topbar */}
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: config.primaryColor, color: '#fff' }}
                >
                  <div className="w-3 h-3 rounded bg-white/30" />
                  <div className="text-xs font-bold flex-1 truncate">SGS Land CRM</div>
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                </div>

                {/* Body preview */}
                <div className="p-3 space-y-2" style={{ background: 'var(--bg-app)' }}>
                  {/* Nav item active */}
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: config.primaryColor + '22', borderLeft: `2px solid ${config.primaryColor}` }}
                  >
                    <div className="w-2.5 h-2.5 rounded" style={{ background: config.primaryColor }} />
                    <span className="text-xs font-bold" style={{ color: config.primaryColor, fontFamily: previewFont }}>Khách hàng</span>
                  </div>
                  {/* Nav item inactive */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'transparent' }}>
                    <div className="w-2.5 h-2.5 rounded bg-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-tertiary)]" style={{ fontFamily: previewFont }}>Bất động sản</span>
                  </div>
                  {/* Card */}
                  <div className="rounded-lg p-2.5 mt-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
                    <div className="text-xs font-bold text-[var(--text-primary)] mb-1" style={{ fontFamily: previewFont }}>Nguyễn Văn A</div>
                    <div className="text-xs2 text-[var(--text-tertiary)] mb-2" style={{ fontFamily: previewFont }}>0901 234 567 • Hồ Chí Minh</div>
                    <div className="flex gap-1.5">
                      <div
                        className="px-2 py-0.5 rounded text-xs2 font-bold text-white"
                        style={{ background: config.primaryColor, fontFamily: previewFont }}
                      >
                        Xem
                      </div>
                      <div
                        className="px-2 py-0.5 rounded text-xs2 font-bold"
                        style={{ background: config.primaryColor + '22', color: config.primaryColor, fontFamily: previewFont }}
                      >
                        Gọi
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs2 text-[var(--text-tertiary)] text-center">
                Xem trước trực tiếp với cấu hình hiện tại
              </div>
            </div>

            {/* Color info */}
            <div className="bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs2 text-[var(--text-tertiary)] font-bold">Màu chính</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: config.primaryColor }} />
                  <span className="text-xs2 font-mono text-[var(--text-secondary)]">{config.primaryColor.toUpperCase()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs2 text-[var(--text-tertiary)] font-bold">Phông chữ</span>
                <span className="text-xs2 font-bold text-[var(--text-secondary)]">{config.fontFamily}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs2 text-[var(--text-tertiary)] font-bold">Cỡ chữ</span>
                <span className="text-xs2 font-bold text-[var(--text-secondary)]">{previewSize}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-6 py-2.5 bg-[var(--primary-600)] text-white text-sm font-bold rounded-xl hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Lưu giao diện
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleDiscard}
            className="px-6 py-2.5 border-2 border-[var(--glass-border)] text-[var(--text-secondary)] text-sm font-bold rounded-xl hover:bg-[var(--glass-surface)] transition-colors"
          >
            Hủy thay đổi
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2.5 text-rose-600 text-sm font-bold rounded-xl hover:bg-rose-50 transition-colors border-2 border-rose-100 flex items-center gap-2"
        >
          {resetting && <div className="w-3.5 h-3.5 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin" />}
          Đặt lại mặc định
        </button>
      </div>

      {isDirty && (
        <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Bạn có thay đổi chưa lưu. Nhấn "Lưu giao diện" để áp dụng cho tất cả người dùng.
        </p>
      )}
    </div>
  );
};

export default ThemeCustomizer;
