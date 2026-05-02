/**
 * Tenant white-label settings (task #28).
 *
 * 3 sub-sections:
 *   • Branding fields (logo, favicon, primaryColor, displayName, hotline, zalo, messenger)
 *   • Subdomain `<slug>.sgsland.vn`
 *   • Custom domain (TXT verify flow)
 *
 * Backed by `tenantApi`. ADMIN/SUPER_ADMIN of tenant only — backend cũng enforce RBAC.
 */

import React, { useCallback, useEffect, useState } from 'react';
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

const FIELD_LABELS: { key: keyof TenantBrandingFields; label: string; placeholder: string; help?: string }[] = [
  { key: 'displayName',    label: 'Tên hiển thị (CĐT)', placeholder: 'VD: Công ty CP Bất động sản ABC', help: 'Hiển thị trên mini-site, footer email lead.' },
  { key: 'logoUrl',        label: 'Logo URL',           placeholder: 'https://cdn.example.com/logo.png', help: 'PNG nền trong tốt nhất, cao ~64px.' },
  { key: 'faviconUrl',     label: 'Favicon URL',        placeholder: 'https://cdn.example.com/favicon.ico', help: '.ico hoặc .png 32×32.' },
  { key: 'primaryColor',   label: 'Màu thương hiệu',    placeholder: '#4F46E5', help: 'Mã hex 6 ký tự, ví dụ #4F46E5.' },
  { key: 'hotline',        label: 'Hotline (số)',       placeholder: '0901234567', help: 'Chỉ chữ số. Dùng cho `tel:` link.' },
  { key: 'hotlineDisplay', label: 'Hotline (hiển thị)', placeholder: '0901 234 567' },
  { key: 'zalo',           label: 'Link Zalo',          placeholder: 'https://zalo.me/0901234567 hoặc số' },
  { key: 'messenger',      label: 'Link Messenger',     placeholder: 'https://m.me/yourpage' },
];

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

  const handleSaveBranding = async () => {
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
      if (res.verified) notify('✅ Custom domain đã verify thành công!', 'success');
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELD_LABELS.map(({ key, label, placeholder, help }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
              <input
                type={key === 'primaryColor' ? 'text' : 'text'}
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
            style={{ backgroundColor: form.primaryColor || '#4F46E5' }}
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
            ✅ Đang hoạt động:{' '}
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
                ? '✅ Đã xác thực — tên miền đang hoạt động.'
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
