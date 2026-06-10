import React, { useState } from "react";
import { FAQ_DATA, getFaqsByCategory } from "../server/seo/faqData";

const CATEGORIES = [
  { key: 'all', label: 'Tất cả' },
  { key: 'gia-ca', label: 'Giá cả' },
  { key: 'dau-tu', label: 'Đầu tư' },
  { key: 'vay-von', label: 'Vay vốn' },
  { key: 'phap-ly', label: 'Pháp lý' },
  { key: 'tien-do', label: 'Tiến độ' },
  { key: 'tien-ich', label: 'Tiện ích' },
];

export default function HoiDap() {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = FAQ_DATA.filter(f => {
    if (cat !== 'all' && f.category !== cat) return false;
    if (search && !f.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Hỏi Đáp Bất Động Sản 2026</h1>
      <p className="text-gray-500 mb-6">60 câu hỏi thường gặp được chuyên gia SGS LAND giải đáp chi tiết với số liệu thực tế</p>
      <input
        type="search"
        placeholder="Tìm kiếm câu hỏi..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]0"
      />
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${cat === c.key ? 'bg-[#C9A84C] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-4">Hiển thị {filtered.length} câu hỏi</p>
      <div className="space-y-3">
        {filtered.map(entry => (
          <a key={entry.slug} href={`/hoi-dap/${entry.slug}`}
            className="block p-5 bg-white border border-gray-200 rounded-xl hover:border-[#C9A84C] hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">{entry.question}</p>
                <p className="text-sm text-gray-500 line-clamp-2">{entry.shortAnswer}</p>
              </div>
              <span className="flex-shrink-0 px-2 py-1 bg-[#FDF6E3] text-[#C9A84C] rounded text-xs">{entry.category}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}