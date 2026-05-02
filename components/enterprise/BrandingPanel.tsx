/**
 * Tenant white-label settings (task #28).
 *
 * 3 sub-sections:
 *   • Branding fields (logo, favicon, primaryColor, displayName, hotline, zalo, messenger)
 *     - Logo & favicon: tải file trực tiếp (multipart) qua /api/upload
 *     - primaryColor: native <input type="color"> kèm hex text input
 *   • Subdomain `<slug>.sgsland.vn`
 *   • Custom domain (TXT verify flow)
 *
 * Backed by `tenantApi`. ADMIN/SUPER_ADMIN of tenant only — backend cũng enforce RBAC.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  tenantApi,
  type TenantBrandingFields,
  type TenantBrandingResponse,
} from '../../services/api/tenantApi';

interface Props {
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const EMPTY: TenantBrandingFields = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  displayName: null,
  hotline: null,
  hotlineDisplay: null,
  zalo: null,
  messenger: null,
};

const TEXT_FIELDS: { key: keyof TenantBrandingFields; label: string; placeholder: string; help?: string }[] = [
  { key: 'displayName',    label: 'Tên hiển thị (CĐT)', placeholder: 'VD: Công ty CP Bất động sản ABC', help: 'Hiển thị trên mini-site, footer email lead.' },
  { key: 'hotline',        label: 'Hotline (số)',       placeholder: '0901234567', help: 'Chỉ chữ số. Dùng cho `tel:` link.' },
  { key: 'hotlineDisplay', label: 'Hotline (hiển thị)', placeholder: '0901 234 567' },
  { key: 'zalo',           label: 'Link Zalo',          placeholder: 'https://zalo.me/0901234567 hoặc số' },
  { key: 'messenger',      label: 'Link Messenger',     placeholder: 'https://m.me/yourpage' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const BrandingPanel: React.FC<Props> = ({ notify }) => {
  const [data, setData]       = useState<TenantBrandingResponse | null>(null);
  const [form, setForm]       = useState<TenantBrandingFields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [slugInput, setSlugInput] = useState('');
  const [slugBusy, setSlugBusy]   = useState(false);

  const [hostInput, setHostInput] = useState('');
  const [hostBusy, setHostBusy]   = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  // Upload state per asset key
  const [uploading, setUploading] = useState<Partial<Record<'logoUrl' | 'faviconUrl', boolean>>>({});
  const logoInputRef    = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.getBranding();
      setData(res);
      setForm({ ...EMPTY, ...res.branding });
      setSlugInput(res.binding.subdomainSlug || '');
      setHostInput(res.binding.customDomain || '');
    } catch (err: any) {
      notify(err?.message || 'Không tải được cấu hình thương hiệu', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const updateField = (key: keyof TenantBrandingFields, value: string) => {
    setForm((f) => ({ ...f, [key]: value.trim() === '' ? null : value }));
  };

  // Upload ảnh trực tiếp qua multipart endpoint /api/upload (auth bằng JWT
  // hiện tại — apiClient tự gắn token). Server đã compress/resize ảnh & trả URL.
  const handleUploadAsset = async (key: 'logoUrl' | 'faviconUrl', file: File) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      notify('Vui lòng chọn file ảnh (PNG, JPG, WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Ảnh tối đa 5MB.', 'error');
      return;
    }
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('files', file, file.name);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Tải ảnh thất bại');
      const url: string | undefined = body?.files?.[0]?.url;
      if (!url) throw new Error('Server không trả URL ảnh');
      setForm((f) => ({ ...f, [key]: url }));
      notify('Đã tải ảnh. Nhớ bấm "Lưu thương hiệu" để áp dụng.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Tải ảnh thất bại', 'error');
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const handleSaveBranding = async () => {
    // Normalize primaryColor: nếu nhập sai format thì không lưu
    if (form.primaryColor && !HEX_RE.test(form.primaryColor)) {
      notify('Màu thương hiệu phải là mã hex 6 ký tự, ví dụ #4F46E5.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await tenantApi.updateBranding(form);
      setData(res);
      setForm({ ...EMPTY, ...res.branding });
      notify('Đã lưu thương hiệu. Mini-site sẽ cập nhật trong vòng 30s.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetSubdomain = async () => {
    if (!slugInput.trim()) return;
    setSlugBusy(true);
    try {
      const res = await tenantApi.setSubdomain(slugInput.trim());
      setData(res);
      notify(`Đã đăng ký subdomain ${res.binding.subdomainSlug}.${res.binding.apexDomain}`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Đăng ký subdomain thất bại', 'error');
    } finally {
      setSlugBusy(false);
    }
  };

  const handleRemoveSubdomain = async () => {
    if (!confirm('Gỡ subdomain? Mini-site sẽ chỉ truy cập được qua sgsland.vn.')) return;
    setSlugBusy(true);
    try {
      const res = await tenantApi.removeSubdomain();
      setData(res);
      setSlugInput('');
      notify('Đã gỡ subdomain', 'success');
    } catch (err: any) {
      notify(err?.message || 'Gỡ subdomain thất bại', 'error');
    } finally {
      setSlugBusy(false);
    }
  };

  const handleSetCustomDomain = async () => {
    if (!hostInput.trim()) return;
    setHostBusy(true);
    try {
      const res = await tenantApi.setCustomDomain(hostInput.trim());
      setData(res);
      notify('Đã lưu custom domain. Vui lòng tạo bản ghi TXT theo hướng dẫn.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Lưu custom domain thất bại', 'error');
    } finally {
      setHostBusy(false);
    }
  };

  const handleVerifyCustomDomain = async () => {
    setVerifyBusy(true);
    try {
      const res = await tenantApi.verifyCustomDomain();
      setData(res);
      if (res.verified) notify('Custom domain đã verify thành công.', 'success');
      else notify('Chưa thấy bản ghi TXT. Đợi DNS propagate (5–30 phút) rồi thử lại.', 'error');
    } catch (err: any) {
      notify(err?.message || 'Verify thất bại', 'error');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleRemoveCustomDomain = async () => {
    if (!confirm('Gỡ custom domain?')) return;
    setHostBusy(true);
    try {
      const res = await tenantApi.removeCustomDomain();
      setData(res);
      setHostInput('');
      notify('Đã gỡ custom domain', 'success');
    } catch (err: any) {
      notify(err?.message || 'Gỡ thất bại', 'error');
    } finally {
      setHostBusy(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">Đang tải…</div>;
  }
  if (!data) {
    return <div className="p-10 text-center text-rose-600">Không tải được dữ liệu thương hiệu.</div>;
  }

  const apex = data.binding.apexDomain;
  const txt  = data.binding.customDomainTxtRecord;
  const verified = !!data.binding.customDomainVerifiedAt;
  const colorValue = (form.primaryColor && HEX_RE.test(form.primaryColor)) ? form.primaryColor : '#4F46E5';

  return (
    <div className="space-y-6">
      {/* ── BRANDING FIELDS ───────────────────────────────────────────── */}
      <section className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Thương hiệu mini-site</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Logo, màu, hotline & link Zalo/Messenger sẽ được áp dụng trên trang công khai <code className="font-mono">/p/&lt;mã dự án&gt;</code>.
            Cập nhật có hiệu lực trong vòng 30 giây.
          </p>
        </header>

        {/* Logo & favicon — upload trực tiếp */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* LOGO */}
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-elevated)]/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-secondary)]">Logo</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">PNG/JPG/WebP, ≤ 5MB</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-28 rounded bg-white border border-[var(--glass-border)] flex items-center justify-center overflow-hidden">
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="logo" className="max-h-full max-w-full object-contain" />
                  : <span className="text-[10px] text-slate-400">chưa có</span>}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={!!uploading.logoUrl}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 self-start"
                >
                  {uploading.logoUrl ? 'Đang tải…' : (form.logoUrl ? 'Thay logo' : 'Tải logo lên')}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAsset('logoUrl', f);
                    e.target.value = '';
                  }}
                />
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => updateField('logoUrl', '')}
                    className="text-[11px] text-rose-600 hover:underline self-start"
                  >Gỡ logo</button>
                )}
              </div>
            </div>
          </div>

          {/* FAVICON */}
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-elevated)]/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-secondary)]">Favicon</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">PNG 32×32 hoặc .ico</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-white border border-[var(--glass-border)] flex items-center justify-center overflow-hidden">
                {form.faviconUrl
                  ? <img src={form.faviconUrl} alt="favicon" className="max-h-full max-w-full object-contain" />
                  : <span className="text-[10px] text-slate-400">—</span>}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={!!uploading.faviconUrl}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 self-start"
                >
                  {uploading.faviconUrl ? 'Đang tải…' : (form.faviconUrl ? 'Thay favicon' : 'Tải favicon lên')}
                </button>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAsset('faviconUrl', f);
                    e.target.value = '';
                  }}
                />
                {form.faviconUrl && (
                  <button
                    type="button"
                    onClick={() => updateField('faviconUrl', '')}
                    className="text-[11px] text-rose-600 hover:underline self-start"
                  >Gỡ favicon</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Color picker + text fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-[var(--text-secondary)]">Màu thương hiệu</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorValue}
                onChange={(e) => updateField('primaryColor', e.target.value.toUpperCase())}
                className="h-10 w-14 rounded border border-[var(--glass-border)] bg-transparent cursor-pointer"
                aria-label="Màu thương hiệu"
              />
              <input
                type="text"
                value={form.primaryColor || ''}
                placeholder="#4F46E5"
                maxLength={7}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono text-sm uppercase"
              />
            </div>
            <span className="text-xs text-[var(--text-tertiary)]">Mã hex 6 ký tự, ví dụ #4F46E5.</span>
          </label>

          {TEXT_FIELDS.map(({ key, label, placeholder, help }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
              <input
                type="text"
                value={(form[key] as string) || ''}
                placeholder={placeholder}
                onChange={(e) => updateField(key, e.target.value)}
                className="px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {help && <span className="text-xs text-[var(--text-tertiary)]">{help}</span>}
            </label>
          ))}
        </div>

        {/* Live preview */}
        <div className="mt-5 p-4 rounded-xl border border-dashed border-[var(--glass-border)] flex items-center gap-3">
          <div className="text-xs text-[var(--text-tertiary)] uppercase font-bold tracking-wider">Xem nhanh:</div>
          {form.logoUrl ? (
            <img src={form.logoUrl} alt={form.displayName || ''} className="h-8 w-auto bg-white rounded px-2 py-1 max-w-[160px] object-contain" />
          ) : (
            <span className="font-bold text-[var(--text-primary)]">{form.displayName || data.tenantName}</span>
          )}
          <span
            className="px-3 py-1 rounded text-white text-xs font-bold"
            style={{ backgroundColor: colorValue }}
          >
            {form.hotlineDisplay || form.hotline || 'Hotline'}
          </span>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveBranding}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Đang lưu…' : 'Lưu thương hiệu'}
          </button>
        </div>
      </section>

      {/* ── SUBDOMAIN ─────────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Subdomain riêng</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Đăng ký <code className="font-mono">&lt;tên-bạn-chọn&gt;.{apex}</code> — wildcard SSL có sẵn, không cần cấu hình DNS thêm.
            Mini-site có thể mở qua URL ngắn <code className="font-mono">https://&lt;slug&gt;.{apex}/&lt;mã dự án&gt;</code>.
          </p>
        </header>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="flex flex-1 items-stretch rounded-lg border border-[var(--glass-border)] bg-[var(--bg-elevated)] overflow-hidden">
            <input
              type="text"
              value={slugInput}
              placeholder="my-brand"
              onChange={(e) => setSlugInput(e.target.value.toLowerCase())}
              className="flex-1 px-3 py-2 bg-transparent focus:outline-none text-sm"
            />
            <span className="px-3 py-2 bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] text-sm border-l border-[var(--glass-border)] font-mono">
              .{apex}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSetSubdomain}
            disabled={slugBusy || !slugInput.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
          >
            {slugBusy ? '…' : 'Đăng ký / Cập nhật'}
          </button>
          {data.binding.subdomainSlug && (
            <button
              type="button"
              onClick={handleRemoveSubdomain}
              disabled={slugBusy}
              className="px-4 py-2 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-sm font-bold disabled:opacity-50"
            >
              Gỡ
            </button>
          )}
        </div>
        {data.binding.subdomainUrl && (
          <p className="mt-3 text-sm">
            Đang hoạt động:{' '}
            <a href={data.binding.subdomainUrl} target="_blank" rel="noopener noreferrer"
               className="font-mono text-indigo-600 hover:underline">
              {data.binding.subdomainUrl}
            </a>
          </p>
        )}
      </section>

      {/* ── CUSTOM DOMAIN ─────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Tên miền riêng (Custom domain)</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Trỏ tên miền của bạn về server SGS Land và xác thực quyền sở hữu qua bản ghi TXT.
          </p>
        </header>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <input
            type="text"
            value={hostInput}
            placeholder="brand.example.com"
            onChange={(e) => setHostInput(e.target.value.toLowerCase())}
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
          />
          <button
            type="button"
            onClick={handleSetCustomDomain}
            disabled={hostBusy || !hostInput.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
          >
            {hostBusy ? '…' : 'Lưu tên miền'}
          </button>
          {data.binding.customDomain && (
            <button
              type="button"
              onClick={handleRemoveCustomDomain}
              disabled={hostBusy}
              className="px-4 py-2 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-sm font-bold disabled:opacity-50"
            >
              Gỡ
            </button>
          )}
        </div>

        {txt && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className={`text-sm font-bold ${verified ? 'text-emerald-700' : 'text-amber-700'}`}>
              {verified
                ? 'Đã xác thực — tên miền đang hoạt động.'
                : 'Bước 1: Tạo bản ghi TXT để xác thực'}
            </div>
            {!verified && (
              <>
                <div className="text-xs text-amber-700">
                  Vào trang quản lý DNS của tên miền <strong className="font-mono">{data.binding.customDomain}</strong>, tạo bản ghi TXT:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1 text-xs font-mono bg-white p-3 rounded border border-amber-200">
                  <div className="text-slate-500">Loại:</div><div>TXT</div>
                  <div className="text-slate-500">Tên:</div><div className="break-all">{txt.name}</div>
                  <div className="text-slate-500">Giá trị:</div><div className="break-all">{txt.value}</div>
                  <div className="text-slate-500">TTL:</div><div>3600 (hoặc Auto)</div>
                </div>
                <div className="text-xs text-amber-700">
                  Sau đó trỏ A/CNAME của <strong className="font-mono">{data.binding.customDomain}</strong> về SGS Land theo hướng dẫn quản trị viên cung cấp.
                  Hệ thống tự kiểm tra mỗi 5 phút — hoặc nhấn nút bên dưới để check ngay.
                </div>
                <button
                  type="button"
                  onClick={handleVerifyCustomDomain}
                  disabled={verifyBusy}
                  className="mt-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {verifyBusy ? 'Đang kiểm tra…' : 'Kiểm tra TXT ngay'}
                </button>
              </>
            )}
            {verified && data.binding.customDomain && (
              <p className="text-sm">
                Mở:{' '}
                <a href={`https://${data.binding.customDomain}`} target="_blank" rel="noopener noreferrer"
                   className="font-mono text-indigo-600 hover:underline">
                  https://{data.binding.customDomain}
                </a>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default BrandingPanel;
