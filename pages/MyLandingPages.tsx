import { useEffect, useState } from 'react';
import { db } from '../services/dbApi';

type LandingRow = {
  id: string; project_name: string; slug: string; status: string;
  tokens_used?: number; language?: string; created_at?: string;
};

export default function MyLandingPages() {
  const [pages, setPages] = useState<LandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await db.getCurrentUser();
        if (!alive || !u?.id) { setLoading(false); return; }
        setUserId(u.id);
        const res = await fetch(`/api/landing-pages?visitorKey=${encodeURIComponent(u.id)}`);
        const d = await res.json();
        if (alive) setPages(d.pages || []);
      } catch { /* best-effort */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const openCreate = () => { window.location.href = '/livechat?prefill=' + encodeURIComponent('Em muốn dựng trang landing cho dự án '); };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Trang Landing của tôi</h1>
          <p className="text-sm text-stone-500 mt-1">Các trang landing do AI (Minh) dựng cho bạn — quota miễn phí 2 trang.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition whitespace-nowrap">+ Tạo trang landing</button>
      </div>

      {loading && <div className="py-20 text-center text-stone-400">Đang tải…</div>}

      {!loading && pages.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-stone-600 font-medium">Bạn chưa có trang landing nào.</p>
          <p className="text-sm text-stone-400 mt-1 mb-4">Nhấn nút tạo và trò chuyện với chuyên viên Minh — AI sẽ dựng giúp bạn trong vài phút.</p>
          <button onClick={openCreate} className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition">Dựng trang đầu tiên</button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="space-y-3">
          {pages.map(pg => (
            <div key={pg.id} className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-wrap items-center gap-4 justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-stone-800 truncate">{pg.project_name}</p>
                <p className="text-xs text-stone-400 mt-0.5">/landing-ai/{pg.slug} · {new Date(pg.created_at || '').toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pg.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {pg.status === 'published' ? 'Đã công bố' : 'Bản nháp'}
                </span>
                <a href={`/landing-ai/${pg.slug}`} className="px-4 py-2 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 transition">Xem</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
