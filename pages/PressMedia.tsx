import { useEffect } from 'react';
import { SeoHead } from '../components/SeoHead';

// -----------------------------------------------------------------------------
// SGS LAND — Đối tác phân phối chính thức
// Trang này công bố quan hệ đối tác phân phối chính thức của SGS LAND.
// (Đã gỡ bỏ các tuyên bố "được báo chí tham khảo" do chưa có bằng chứng dẫn nguồn.)
// -----------------------------------------------------------------------------

const OFFICE_ADDRESS =
  '122 - 124 B2, Khu đô thị Sala, Phường An Khánh, TP.HCM, Việt Nam';

// Đối tác phát triển / phân phối chính thức
const partners = [
  { name: 'Novaland', role: 'Chủ đầu tư · Đối tác phân phối' },
  { name: 'Masterise Homes', role: 'Chủ đầu tư · Đối tác phân phối' },
  { name: 'Vinhomes', role: 'Chủ đầu tư · Đối tác phân phối' },
  { name: 'Nam Long', role: 'Chủ đầu tư · Đối tác phân phối' },
];

export default function PressMedia() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const structuredData = [{
    "@type": "Organization",
    "@id": "https://sgsland.vn/#organization",
    "name": "SGS LAND",
    "legalName": "Công ty Cổ phần SGS Land",
    "url": "https://sgsland.vn",
    "foundingDate": "2019",
    "taxID": "0312960439",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "122 - 124 B2, Khu đô thị Sala, Phường An Khánh",
      "addressLocality": "TP. Hồ Chí Minh",
      "addressRegion": "TP.HCM",
      "addressCountry": "VN"
    },
    "sameAs": [
      "https://www.linkedin.com/company/sgs-land",
      "https://www.facebook.com/sgsland.vn",
    ],
  }];
  return (
    <div className="min-h-screen bg-[var(--bg-surface)] font-sans">
      <SeoHead
        title="Đối Tác Phân Phối | SGS LAND"
        description="SGS LAND là đối tác phân phối chính thức của Novaland, Masterise Homes, Vinhomes và Nam Long. Thông tin liên hệ và hồ sơ doanh nghiệp."
        canonicalPath="/press-media"
        structuredData={structuredData}
      />
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-sm px-4 py-2 rounded-full mb-6"><span>Đối tác phân phối chính thức</span></div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Đối tác của SGS LAND</h1>
          <p className="text-slate-300 text-lg">SGS LAND là đối tác phân phối chính thức của Novaland, Masterise Homes, Vinhomes và Nam Long.</p>
        </div>
      </section>
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <section className="grid md:grid-cols-2 gap-6">
          {partners.map((p, i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-lg p-6 border border-slate-100">
              <div className="font-semibold text-slate-800 text-lg">{p.name}</div>
              <div className="text-sm text-slate-500 mt-1">{p.role}</div>
            </div>
          ))}
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Thông Tin Liên Hệ (NAP - Name Address Phone)</h2>
          <div className="grid md:grid-cols-2 gap-6 bg-[var(--bg-surface)] border border-slate-100 rounded-xl p-6 text-sm">
            <div className="space-y-2">
              <div><strong>Tên:</strong> Công ty Cổ phần SGS Land</div>
              <div><strong>MST:</strong> 0312960439</div>
              <div><strong>Địa chỉ:</strong> {OFFICE_ADDRESS}</div>
              <div><strong>Website:</strong> <a href="https://sgsland.vn" className="text-blue-600">sgsland.vn</a></div>
              <div><strong>Email:</strong> <a href="mailto:info@sgsland.vn" className="text-blue-600">info@sgsland.vn</a></div>
            </div>
            <div className="space-y-2">
              <div><strong>LinkedIn:</strong> <a href="https://linkedin.com/company/sgs-land" className="text-blue-600" target="_blank" rel="noopener noreferrer">linkedin.com/company/sgs-land</a></div>
              <div><strong>Facebook:</strong> <a href="https://facebook.com/sgsland.vn" className="text-blue-600" target="_blank" rel="noopener noreferrer">facebook.com/sgsland.vn</a></div>
              <div><strong>Năm thành lập:</strong> 2024</div>
              <div><strong>Lĩnh vực:</strong> Proptech, BĐS, AI Valuation</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
