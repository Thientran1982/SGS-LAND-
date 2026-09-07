import { useEffect, useState } from 'react';


type LandingSection = { stage: string; title?: string; body?: string; items?: string[]; tokens?: number };
type LandingPageData = {
  id: string; project_name: string; slug: string; status: string;
  language?: string; sections?: LandingSection[]; visitor_key?: string; created_at?: string;
};

const STAGE_ICONS: Record<string, string> = {
  hero: '★', gallery: '▤', legal: '⚖', price: '₫', amenities: '✦', contact: '✉',
};

export default function LandingPageView({ slug }: { slug: string }) {
  const navigate = (p: string) => { window.location.href = p; };
  const [page, setPage] = useState<LandingPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/landing-pages/${encodeURIComponent(slug)}`)
      .then(r => { if (!r.ok) throw new Error(r.status === 404 ? 'NOT_FOUND' : 'LOAD_FAILED'); return r.json(); })
      .then(d => { if (alive) { setPage(d.page || null); setLoading(false); } })
      .catch(e => { if (alive) { setError(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app,#faf7f0)]">
        <div className="w-10 h-10 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error === 'NOT_FOUND' || (!page && error)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg-app,#faf7f0)] px-6 text-center">
        <div className="text-5xl">✂</div>
        <h1 className="text-2xl font-bold text-stone-800">Không tìm thấy trang landing</h1>
        <p className="text-stone-500">Trang «{slug}» không tồn tại hoặc chưa được công bố.</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => navigate('/livechat')} className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition">➕ Dựng trang landing mới</button>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 transition">Về trang chủ</button>
        </div>
      </div>
    );
  }

  if (!page) return null;

  const sections = page.sections || [];
  const hero = sections.find(s => s.stage === 'hero');
  const rest = sections.filter(s => s.stage !== 'hero');

  return (
    <div className="min-h-screen bg-[var(--bg-app,#faf7f0)]">
      {page.status !== 'published' && (
        <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 text-center font-medium">
          ✏ Bản nháp — trang chưa công bố, chỉ bạn thấy
        </div>
      )}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <p className="text-amber-300 tracking-widest text-xs uppercase mb-3">SGS LAND · Trang dự án</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">{hero?.title || page.project_name}</h1>
          {hero?.body && <p className="text-stone-300 text-lg max-w-2xl mx-auto">{hero.body}</p>}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        {rest.map((s, i) => (
          <section key={i} className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-lg">{STAGE_ICONS[s.stage] || '●'}</span>
              <h2 className="text-xl font-bold text-stone-800">{s.title || s.stage}</h2>
            </div>
            {s.body && <p className="text-stone-600 leading-relaxed whitespace-pre-line">{s.body}</p>}
            {s.items && s.items.length > 0 && (
              <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                {s.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-2 text-stone-600"><span className="text-amber-600 mt-0.5">✓</span>{it}</li>
                ))}
              </ul>
            )}
            {s.stage === 'contact' && (
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="tel:+84379281445" className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition">☎ Gọi tư vấn</a>
                <button onClick={() => navigate('/livechat')} className="px-5 py-2.5 rounded-xl border border-amber-300 text-amber-800 hover:bg-amber-50 transition">Chat với chuyên viên Minh</button>
              </div>
            )}
          </section>
        ))}
        <p className="text-center text-xs text-stone-400 pt-4">© 2026 SGS LAND · Trang do AI dựng · <button onClick={() => navigate('/livechat')} className="underline hover:text-amber-700">Dựng trang tương tự</button></p>
      </div>
    </div>
  );
}
