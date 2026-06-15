import React from "react";
import { Helmet } from "react-helmet-async";

const REPORT_DATA = {
  title: "Chi so gia Bat dong san Dong Nam Bo Q2/2026",
  subtitle: "SGS LAND Research — Bao cao thi truong thang 6/2026",
  publishedAt: "2026-06-15",
  methodology: "Du lieu tu 2.847 giao dich thuc te Q2/2026, so sanh Q1/2026 va Q2/2025, loai tru cac giao dich ngoai gia thi truong.",
  summary: "Thi truong BDS Dong Nam Bo Q2/2026 cho thay su phuc hoi ro net voi gia dat nen Long Thanh tang 8.3% so quy truoc, can ho TP.HCM on dinh. San bay Long Thanh tien do dung han la dong luc chinh.",
  segments: [
    {
      area: "Long Thanh — Dong Nai",
      type: "Dat nen du an",
      priceQ1: 22500000,
      priceQ2: 24370000,
      change: 8.3,
      volume: 312,
      note: "Tang manh nho san bay Long Thanh Q3/2026 hoan thanh giai doan 1"
    },
    {
      area: "Thu Duc — TP.HCM",
      type: "Can ho hang A",
      priceQ1: 68000000,
      priceQ2: 70200000,
      change: 3.2,
      volume: 1247,
      note: "Khu cong nghe cao thu hut nhan luc, nhu cau thue manh"
    },
    {
      area: "Bien Hoa — Dong Nai",
      type: "Nha pho / Shophouse",
      priceQ1: 35000000,
      priceQ2: 36050000,
      change: 3.0,
      volume: 428,
      note: "Ha tang Vành dai 3 TP.HCM hoan thanh tang lien ket vung"
    },
    {
      area: "Phu My — Ba Ria Vung Tau",
      type: "Dat cong nghiep",
      priceQ1: 3800000,
      priceQ2: 4180000,
      change: 10.0,
      volume: 18,
      note: "FDI tu Samsung, LG tang von mo rong cang khu vuc"
    },
    {
      area: "Quan 7 — TP.HCM",
      type: "Can ho trung cap",
      priceQ1: 52000000,
      priceQ2: 53040000,
      change: 2.0,
      volume: 623,
      note: "Khu Nam on dinh, nhu cau thue tot tu chuyen gia nuoc ngoai"
    },
    {
      area: "Aqua City — Novaland",
      type: "Biet thu / Lien ke",
      priceQ1: 45000000,
      priceQ2: 48150000,
      change: 7.0,
      volume: 156,
      note: "Novaland hoan tat thu tuc phap ly 90% du an, khoi phuc giao dich"
    },
  ],
  forecast: {
    q3_2026: "Gia dat nen Long Thanh du kien tang them 5-7% khi san bay chinh thuc khai truong. Can ho TP.HCM on dinh 2-3%.",
    risk: "Lai suat vay mua nha du kien giu muc 7.5-8.5%/nam. Rui ro thanh khoan tap trung vao condotel chua ro phap ly.",
    opportunity: "Dat nen Long Thanh, Nhon Trach co tiem nang tang gia manh nhat khu vuc Dong Nam Bo trong 12-18 thang toi."
  }
};

function fmt(n: number) { return n.toLocaleString("vi-VN") + " d/m2"; }

export default function MarketReport() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": REPORT_DATA.title,
    "description": REPORT_DATA.summary,
    "url": "https://sgsland.vn/bao-cao-thi-truong",
    "datePublished": REPORT_DATA.publishedAt,
    "dateModified": REPORT_DATA.publishedAt,
    "creator": { "@type": "Organization", "name": "SGS LAND Research", "url": "https://sgsland.vn" },
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "distribution": [
      { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://sgsland.vn/market-report-q2-2026.json" }
    ],
    "keywords": ["bat dong san", "Long Thanh", "Dong Nai", "TP.HCM", "Q2 2026", "gia dat"],
    "spatialCoverage": { "@type": "Place", "name": "Dong Nam Bo, Viet Nam" },
    "temporalCoverage": "2026-04-01/2026-06-30",
    "variableMeasured": "Gia bat dong san (VND/m2), Volume giao dich (so luong)",
    "measurementTechnique": REPORT_DATA.methodology
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Bao cao Thi truong BDS Dong Nam Bo Q2/2026 — SGS LAND Research</title>
        <meta name="description" content="Bao cao gia bat dong san Dong Nam Bo Q2/2026: Long Thanh tang 8.3%, can ho Thu Duc tang 3.2%. Du lieu tu 2.847 giao dich thuc te." />
        <link rel="canonical" href="https://sgsland.vn/bao-cao-thi-truong" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full font-bold">RESEARCH</span>
            <span className="text-blue-300 text-sm">SGS LAND Market Intelligence</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{REPORT_DATA.title}</h1>
          <p className="text-blue-200 text-lg mb-2">{REPORT_DATA.subtitle}</p>
          <p className="text-blue-300 text-sm">Ngay phat hanh: {REPORT_DATA.publishedAt} | Du lieu: 2.847 giao dich Q2/2026</p>
          <div className="mt-6 flex gap-3">
            <a href="/market-report-q2-2026.json" download className="bg-white text-blue-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-50">
              Download JSON
            </a>
            <a href="#methodology" className="border border-white text-white px-4 py-2 rounded-lg text-sm hover:bg-white/10">
              Xem Methodology
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Summary */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-6 mb-10">
          <h2 className="font-bold text-blue-900 mb-2">Tom tat thi truong Q2/2026</h2>
          <p className="text-blue-800">{REPORT_DATA.summary}</p>
        </div>

        {/* Data table */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dien bien gia theo phan khuc</h2>
        <div className="overflow-x-auto mb-10">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Khu vuc</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Loai hinh</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Q1/2026</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Q2/2026</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Bien dong</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">GD</th>
              </tr>
            </thead>
            <tbody>
              {REPORT_DATA.segments.map((s, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.area}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{s.type}</td>
                  <td className="px-4 py-3 text-right text-gray-600 text-sm">{fmt(s.priceQ1)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(s.priceQ2)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${s.change > 5 ? "text-green-600" : s.change > 0 ? "text-blue-600" : "text-red-500"}`}>
                      +{s.change}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-sm">{s.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Ghi chu phan khuc</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {REPORT_DATA.segments.map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="font-semibold text-gray-900 text-sm mb-1">{s.area} — {s.type}</p>
              <p className="text-gray-600 text-sm">{s.note}</p>
            </div>
          ))}
        </div>

        {/* Forecast */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Du bao Q3/2026</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-green-50 rounded-xl p-5 border border-green-100">
            <h3 className="font-bold text-green-800 mb-2">Co hoi</h3>
            <p className="text-green-700 text-sm">{REPORT_DATA.forecast.opportunity}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-2">Du bao Q3/2026</h3>
            <p className="text-blue-700 text-sm">{REPORT_DATA.forecast.q3_2026}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
            <h3 className="font-bold text-orange-800 mb-2">Rui ro can luu y</h3>
            <p className="text-orange-700 text-sm">{REPORT_DATA.forecast.risk}</p>
          </div>
        </div>

        {/* Methodology */}
        <div id="methodology" className="bg-gray-100 rounded-xl p-6 mb-10">
          <h2 className="font-bold text-gray-900 mb-3">Methodology</h2>
          <p className="text-gray-700 text-sm mb-3">{REPORT_DATA.methodology}</p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Nguon: SGS LAND Transaction Database (2.847 giao dich)</li>
            <li>Ky thu thap: 01/04/2026 - 30/06/2026</li>
            <li>Pham vi: Long Thanh, Thu Duc, Bien Hoa, Phu My, Q7, Aqua City</li>
            <li>Loai tru: Giao dich noi bo, giao dich cach gia thi truong &gt;30%</li>
            <li>Don vi: VND/m2 (gia niêm yet cuoi quy)</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="bg-blue-700 text-white rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Can dinh gia BDS chinh xac hon?</h2>
          <p className="text-blue-200 mb-6">AI SGS LAND phan tich hon 100.000 giao dich de cho ban biet gia thi truong hien tai.</p>
          <a href="/ai-valuation" className="bg-white text-blue-700 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 inline-block">
            Thu Dinh gia AI Mien phi
          </a>
        </div>
      </div>
    </div>
  );
}
