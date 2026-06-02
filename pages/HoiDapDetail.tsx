import React, { useEffect } from "react";
// Using window.location for routing (no external dependency)
import { FAQ_MAP, AUTHORS } from "../server/seo/faqData";

function AuthorBox({ authorKey }: { authorKey: string }) {
  const author = AUTHORS[authorKey];
  if (!author) return null;
  return (
    <div className="author-box mt-8 p-5 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {author.name.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{author.name}</p>
          <p className="text-blue-700 font-medium text-sm">{author.title}</p>
          <p className="text-gray-500 text-xs mt-1">{author.license}</p>
          <p className="text-gray-600 text-sm mt-1">{author.experience}</p>
          <a href={`tel:${author.phone.replace(/\s/g, '')}`} className="inline-block mt-2 text-blue-600 hover:text-blue-800 font-medium text-sm">
            Tel: {author.phone}
          </a>
        </div>
      </div>
    </div>
  );
}

function FAQAccordion({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-lg font-bold text-gray-800">Câu hỏi thường gặp</h3>
      {items.map((item, i) => (
        <details key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <summary className="p-4 font-medium text-gray-800 cursor-pointer hover:bg-gray-50">{item.q}</summary>
          <div className="p-4 bg-gray-50 text-gray-700 border-t border-gray-200">{item.a}</div>
        </details>
      ))}
    </div>
  );
}

function RelatedQs({ slugs }: { slugs: string[] }) {
  if (!slugs.length) return null;
  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-gray-800 mb-3">Câu hỏi liên quan</h3>
      <ul className="space-y-2">
        {slugs.map(slug => {
          const e = FAQ_MAP.get(slug);
          if (!e) return null;
          return (
            <li key={slug}>
              <a href={`/hoi-dap/${slug}`} className="text-blue-600 hover:underline">
                {e.question}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const PROJECT_NAMES: Record<string, string> = {
  'vinhomes-hoc-mon': 'Vinhomes Hóc Môn',
  'vinhomes-grand-park': 'Vinhomes Grand Park',
  'masteri-cosmo-central': 'Masteri Cosmo Central',
  'vinhomes-central-park': 'Vinhomes Central Park',
  'van-phuc-city': 'Van Phúc City',
  'manhattan': 'Grand Manhattan',
};

export default function HoiDapDetail({ slug }: { slug?: string }) {
  const location = window.location.pathname;
  const pageSlug = slug || location.split('/').pop() || '';
  const entry = FAQ_MAP.get(pageSlug);
  useEffect(() => {
    if (entry) document.title = `${entry.question} – SGS LAND`;
  }, [entry]);
  if (!entry) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><h1 className="text-2xl font-bold">Không tìm thấy</h1>
        <a href="/hoi-dap" className="mt-4 inline-block text-blue-600 hover:underline">Xem tất cả câu hỏi</a>
      </div></div>
  );
  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <article className="max-w-3xl mx-auto px-4 py-8" itemScope itemType="https://schema.org/FAQPage">
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-blue-600">Trang chủ</a>
        <span className="mx-1">/</span>
        <a href="/hoi-dap" className="hover:text-blue-600">Hỏi đáp</a>
        <span className="mx-1">/</span>
        <span>{entry.question}</span>
      </nav>
      <div className="mb-4">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{entry.category}</span>
        <span className="ml-3 text-xs text-gray-400">Cập nhật: {today}</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{entry.question}</h1>
      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg mb-6">
        <p className="text-gray-800 font-medium" itemProp="speakable">{entry.shortAnswer}</p>
      </div>
      {entry.relatedProjects.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="font-bold text-green-800 mb-2">Dự án liên quan:</p>
          <div className="flex flex-wrap gap-2">
            {entry.relatedProjects.map(p => (
              <a key={p} href={`/du-an/${p}`} className="px-3 py-1 bg-green-600 text-white rounded-full text-sm hover:bg-green-700">
                {PROJECT_NAMES[p] || p}
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="prose max-w-none mt-6">
        {entry.content.split('\n').map((line, i) => {
          if (line.startsWith('### ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(4)}</h2>;
          if (line.startsWith('## ')) return <h3 key={i} className="text-lg font-semibold mt-5 mb-2 text-blue-800">{line.slice(3)}</h3>;
          if (line.startsWith('- ')) return <li key={i} className="ml-4 text-gray-700">{line.slice(2)}</li>;
          if (!line.trim()) return <br key={i} />;
          return <p key={i} className="text-gray-700 leading-relaxed mb-2">{line}</p>;
        })}
      </div>
      <FAQAccordion items={entry.faqItems} />
      <AuthorBox authorKey={entry.authorKey} />
      <RelatedQs slugs={entry.relatedQuestions} />
      <div className="mt-10 p-6 bg-blue-600 text-white rounded-xl text-center">
        <h3 className="text-xl font-bold mb-2">Tư vấn miễn phí từ chuyên gia SGS LAND</h3>
        <div className="flex justify-center gap-4 flex-wrap mt-4">
          <a href="tel:18006665" className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold">Hotline 1800 6665</a>
          <a href="/du-an" className="px-6 py-3 bg-blue-800 text-white rounded-lg font-bold">Xem dự án</a>
        </div>
      </div>
    </article>
  );
}