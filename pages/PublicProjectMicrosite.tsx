import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  publicProjectApi,
  type PublicListing,
  type PublicProjectPayload,
} from '../services/api/publicProjectApi';
import { NO_IMAGE_URL } from '../utils/constants';

interface Props {
  projectCode: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  OPENING:   { label: 'Mở bán',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  BOOKING:   { label: 'Booking',    cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  AVAILABLE: { label: 'Còn hàng',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return 'Liên hệ';
  const cur = currency || 'VND';
  if (cur === 'VND') {
    if (price >= 1_000_000_000) {
      const v = price / 1_000_000_000;
      return `${v.toFixed(v >= 10 ? 0 : 2).replace(/\.?0+$/, '')} tỷ`;
    }
    if (price >= 1_000_000) return `${Math.round(price / 1_000_000)} triệu`;
    return price.toLocaleString('vi-VN') + ' đ';
  }
  return `${price.toLocaleString('vi-VN')} ${cur}`;
}

function formatArea(area: number | null): string {
  if (!area) return '—';
  return `${area} m²`;
}

const PublicProjectMicrosite: React.FC<Props> = ({ projectCode }) => {
  const [data, setData]     = useState<PublicProjectPayload | null>(null);
  const [error, setError]   = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const qrRef = useRef<HTMLDivElement | null>(null);

  // Lead form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', interest: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef  = useRef<string | null>(null);

  const code = projectCode.trim().toUpperCase();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    publicProjectApi
      .fetchProject(code)
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((err: any) => {
        if (cancelled) return;
        const status = err?.status === 404 ? 404 : 500;
        setError({ status, message: err?.message || 'Không thể tải dữ liệu' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  // Update <title> + <meta description> client-side cho user (server đã inject sẵn cho crawler)
  useEffect(() => {
    if (!data?.project) return;
    const original = document.title;
    document.title = `${data.project.name} — Mini-site SGS Land`;
    return () => { document.title = original; };
  }, [data]);

  const gallery = useMemo<string[]>(() => {
    if (!data) return [];
    const out: string[] = [];
    if (data.project.coverImage) out.push(data.project.coverImage);
    for (const url of data.project.metadata.gallery || []) {
      if (url && !out.includes(url)) out.push(url);
    }
    for (const l of data.listings) {
      if (Array.isArray(l.images)) {
        for (const img of l.images.slice(0, 2)) {
          if (img && !out.includes(img) && out.length < 24) out.push(img);
        }
      }
    }
    if (out.length === 0) out.push(NO_IMAGE_URL);
    return out;
  }, [data]);

  // Reset active image when gallery changes
  useEffect(() => { setActiveImageIdx(0); }, [gallery.length]);

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${code}`
    : `https://sgsland.vn/p/${code}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: data?.project.name || code, url: fullUrl });
      } else {
        await navigator.clipboard.writeText(fullUrl);
        setSubmitMsg({ ok: true, text: 'Đã copy đường dẫn vào clipboard.' });
        setTimeout(() => setSubmitMsg(null), 3000);
      }
    } catch { /* user dismissed */ }
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setSubmitMsg({ ok: false, text: 'Vui lòng nhập Họ tên và Số điện thoại.' });
      return;
    }
    if (data?.captcha && !captchaToken) {
      setSubmitMsg({ ok: false, text: 'Vui lòng xác nhận captcha trước khi gửi.' });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await publicProjectApi.submitLead(code, {
        ...form,
        captchaToken: captchaToken || undefined,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      });
      if (res.ok) {
        setSubmitMsg({ ok: true, text: res.message || 'Cảm ơn bạn! Chuyên viên sẽ liên hệ sớm.' });
        setForm({ name: '', phone: '', email: '', interest: '', note: '' });
        // Reset Turnstile sau submit thành công để user có thể submit lại lần sau
        try {
          const w = (window as any).turnstile;
          if (w && turnstileWidgetIdRef.current) w.reset(turnstileWidgetIdRef.current);
          setCaptchaToken('');
        } catch { /* noop */ }
      } else {
        setSubmitMsg({ ok: false, text: res.error || 'Có lỗi xảy ra. Vui lòng thử lại.' });
      }
    } catch (err: any) {
      setSubmitMsg({ ok: false, text: err?.message || 'Lỗi kết nối. Vui lòng thử lại.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Turnstile loader (chỉ inject khi server bật captcha)
  useEffect(() => {
    if (!data?.captcha?.siteKey) return;
    const SCRIPT_ID = 'cf-turnstile-script';
    const render = () => {
      const w = (window as any).turnstile;
      if (!w || !turnstileContainerRef.current) return;
      if (turnstileWidgetIdRef.current) return; // đã render
      try {
        turnstileWidgetIdRef.current = w.render(turnstileContainerRef.current, {
          sitekey: data!.captcha!.siteKey,
          callback: (token: string) => setCaptchaToken(token),
          'error-callback': () => setCaptchaToken(''),
          'expired-callback': () => setCaptchaToken(''),
          theme: 'light',
        });
      } catch { /* noop */ }
    };
    if ((window as any).turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      // Script đang load → poll nhẹ
      const t = setInterval(() => { if ((window as any).turnstile) { render(); clearInterval(t); } }, 200);
      setTimeout(() => clearInterval(t), 8000);
    }
    return () => {
      try {
        const w = (window as any).turnstile;
        if (w && turnstileWidgetIdRef.current) w.remove(turnstileWidgetIdRef.current);
      } catch { /* noop */ }
      turnstileWidgetIdRef.current = null;
    };
  }, [data?.captcha?.siteKey]);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-3 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm">Đang tải mini-site dự án…</p>
        </div>
      </div>
    );
  }

  // ─── Error / Not Found ──────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
          <div className="text-5xl mb-4">🏗️</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {error?.status === 404 ? 'Dự án chưa công khai' : 'Không thể tải dự án'}
          </h1>
          <p className="text-slate-600 text-sm mb-6">
            {error?.status === 404
              ? 'Mini-site cho dự án này chưa được kích hoạt hoặc đã tạm ẩn. Vui lòng liên hệ hotline để được tư vấn trực tiếp.'
              : error?.message || 'Đã xảy ra lỗi trong quá trình tải.'}
          </p>
          <a href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition">
            ← Về trang chủ
          </a>
        </div>
      </div>
    );
  }

  const { project, listings, tenantContact } = data;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-900 text-white">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={gallery[activeImageIdx] || NO_IMAGE_URL}
            alt={project.name}
            className="w-full h-full object-cover opacity-50"
            loading="eager"
            onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex items-center gap-2 text-xs text-indigo-200 font-mono uppercase tracking-widest mb-3">
            <span>SGS LAND</span>
            <span className="opacity-50">/</span>
            <span>{project.code}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-3">{project.name}</h1>
          {project.location && (
            <p className="text-base sm:text-lg text-slate-200 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {project.location}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mb-6">
            <a href={`tel:${tenantContact.hotline}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm transition shadow-lg shadow-indigo-500/30">
              📞 Hotline {tenantContact.hotlineDisplay}
            </a>
            <a href={tenantContact.zalo} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition border border-white/20">
              💬 Chat Zalo
            </a>
            <button type="button" onClick={handleShare}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition border border-white/20">
              🔗 Chia sẻ
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
              <div className="text-xs text-indigo-200 uppercase">Sản phẩm công khai</div>
              <div className="text-xl font-bold mt-1">{data.listingCount}</div>
            </div>
            {project.totalUnits != null && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="text-xs text-indigo-200 uppercase">Tổng số căn</div>
                <div className="text-xl font-bold mt-1">{project.totalUnits.toLocaleString('vi-VN')}</div>
              </div>
            )}
            {project.openDate && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="text-xs text-indigo-200 uppercase">Mở bán</div>
                <div className="text-sm font-bold mt-1">{new Date(project.openDate).toLocaleDateString('vi-VN')}</div>
              </div>
            )}
            {project.handoverDate && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="text-xs text-indigo-200 uppercase">Bàn giao</div>
                <div className="text-sm font-bold mt-1">{new Date(project.handoverDate).toLocaleDateString('vi-VN')}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── GALLERY ──────────────────────────────────────────────────── */}
      {gallery.length > 1 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Thư viện ảnh</h2>
              <span className="text-xs text-slate-500">{activeImageIdx + 1}/{gallery.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {gallery.map((img, i) => (
                <button key={i} type="button"
                  onClick={() => setActiveImageIdx(i)}
                  className={`shrink-0 rounded-xl overflow-hidden border-2 transition ${i === activeImageIdx ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent hover:border-slate-300'}`}>
                  <img src={img} alt={`${project.name} ${i + 1}`}
                    className="w-24 h-16 sm:w-32 sm:h-20 object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── DESCRIPTION + AMENITIES ─────────────────────────────────── */}
      {(project.description || project.metadata.amenities.length || project.metadata.highlights.length) && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold mb-4">Giới thiệu dự án</h2>
              {project.description ? (
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{project.description}</p>
              ) : (
                <p className="text-slate-500 italic">Đang cập nhật mô tả chi tiết.</p>
              )}
              {project.metadata.highlights.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-3">Điểm nổi bật</h3>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {project.metadata.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-emerald-500 mt-0.5">✓</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              {project.metadata.amenities.length > 0 ? (
                <>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-3">Tiện ích</h3>
                  <ul className="space-y-2">
                    {project.metadata.amenities.slice(0, 12).map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />{a}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-3">QR Code</h3>
                  <div ref={qrRef} className="flex flex-col items-center gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <QRCodeCanvas value={fullUrl} size={160} level="M" includeMargin={false} />
                    </div>
                    <button type="button" onClick={handleDownloadQR}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">
                      Tải QR (PNG)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── LISTINGS TABLE ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Sản phẩm đang mở bán</h2>
          <span className="text-sm text-slate-500">{listings.length} sản phẩm</span>
        </div>
        {listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            <p className="text-base mb-2">Hiện chưa có sản phẩm công khai cho dự án này.</p>
            <p className="text-sm">Vui lòng để lại thông tin bên dưới — chuyên viên sẽ gửi bảng hàng riêng cho bạn.</p>
          </div>
        ) : (
          <ListingsTable listings={listings} />
        )}
      </section>

      {/* ── LEAD FORM ──────────────────────────────────────────────── */}
      <section id="lead-form" className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 mb-12">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-2">Nhận tư vấn miễn phí</h2>
              <p className="text-indigo-100 text-sm mb-4">
                Để lại thông tin — chuyên viên SGS Land sẽ gửi bảng giá, chính sách và tư vấn 1-1 trong vòng 30 phút.
              </p>
              <ul className="text-sm text-indigo-100 space-y-2 mb-4">
                <li className="flex items-center gap-2">📞 Hotline: <strong className="text-white">{tenantContact.hotlineDisplay}</strong></li>
                <li className="flex items-center gap-2">💬 Zalo: <a href={tenantContact.zalo} className="text-white underline">{tenantContact.hotlineDisplay}</a></li>
                <li className="flex items-center gap-2">🔒 Cam kết bảo mật thông tin theo Nghị định 13/2023</li>
              </ul>
            </div>
            <form onSubmit={handleSubmit} className="lg:col-span-3 grid sm:grid-cols-2 gap-3">
              <input
                type="text" required value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Họ và tên *"
                className="px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                autoComplete="name" />
              <input
                type="tel" required value={form.phone} inputMode="tel"
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Số điện thoại *"
                className="px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                autoComplete="tel" />
              <input
                type="email" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email (không bắt buộc)"
                className="sm:col-span-2 px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                autoComplete="email" />
              <select value={form.interest}
                onChange={(e) => setForm(f => ({ ...f, interest: e.target.value }))}
                className="sm:col-span-2 px-4 py-3 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Tôi quan tâm tới…</option>
                <option value="Bảng giá">Bảng giá & chính sách</option>
                <option value="Xem nhà mẫu">Đặt lịch xem nhà mẫu</option>
                <option value="Đầu tư">Tư vấn đầu tư cho thuê</option>
                <option value="Pháp lý">Pháp lý & hỗ trợ vay</option>
                <option value="Khác">Khác</option>
              </select>
              <textarea value={form.note} rows={3}
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ghi chú thêm (không bắt buộc)"
                className="sm:col-span-2 px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              {data?.captcha && (
                <div ref={turnstileContainerRef}
                  className="sm:col-span-2 flex justify-center"
                  data-testid="turnstile-container" />
              )}
              {submitMsg && (
                <div className={`sm:col-span-2 px-3 py-2 rounded-lg text-sm ${submitMsg.ok ? 'bg-emerald-500/20 text-emerald-50 border border-emerald-300/30' : 'bg-rose-500/20 text-rose-50 border border-rose-300/30'}`}>
                  {submitMsg.text}
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="sm:col-span-2 px-6 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 disabled:opacity-60 transition shadow-lg">
                {submitting ? 'Đang gửi…' : 'Gửi yêu cầu tư vấn'}
              </button>
              <p className="sm:col-span-2 text-xs text-indigo-200 text-center">
                Gửi đi nghĩa là bạn đồng ý SGS Land lưu trữ và liên hệ tư vấn theo Chính sách bảo mật.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
          <div>
            © {tenantContact.brandName} — Mini-site dự án <strong>{project.name}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleDownloadQR} className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold">
              Tải QR
            </button>
            <a href={`tel:${tenantContact.hotline}`} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              📞 {tenantContact.hotlineDisplay}
            </a>
          </div>
        </div>
        {/* Off-screen QR for footer download (when amenities present, qrRef above is replaced) */}
        {project.metadata.amenities.length > 0 && (
          <div ref={qrRef} className="sr-only" aria-hidden>
            <QRCodeCanvas value={fullUrl} size={256} level="M" includeMargin={false} />
          </div>
        )}
      </footer>
    </div>
  );
};

const ListingsTable: React.FC<{ listings: PublicListing[] }> = ({ listings }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Mã / Tên</th>
            <th className="text-left px-4 py-3">Loại</th>
            <th className="text-right px-4 py-3">Diện tích</th>
            <th className="text-right px-4 py-3">PN/WC</th>
            <th className="text-right px-4 py-3">Giá</th>
            <th className="text-center px-4 py-3">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {listings.map((l) => {
            const status = STATUS_LABELS[l.status] || { label: l.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
            const orient = l.attributes?.orientation || l.attributes?.view || '';
            return (
              <tr key={l.id} className="hover:bg-indigo-50/30 transition">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-slate-500">{l.code || '—'}</div>
                  <div className="font-semibold text-slate-900 line-clamp-1">{l.title || '—'}</div>
                  {orient && <div className="text-xs text-slate-500 mt-0.5">{String(orient)}</div>}
                </td>
                <td className="px-4 py-3 text-slate-700">{l.type || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatArea(l.area)}</td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {(l.bedrooms ?? '—')} / {(l.bathrooms ?? '—')}
                </td>
                <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatPrice(l.price, l.currency)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${status.cls}`}>
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-center">
      <a href="#lead-form" className="text-sm text-indigo-700 font-semibold hover:underline">
        Cần bảng giá đầy đủ? Để lại thông tin tư vấn ↓
      </a>
    </div>
  </div>
);

export default PublicProjectMicrosite;
export { PublicProjectMicrosite };
