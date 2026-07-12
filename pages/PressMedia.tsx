import { useEffect } from 'react';
import { SeoHead } from '../components/SeoHead';

export default function PressMedia() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const structuredData = [{
    "@type": "CollectionPage",
    "name": "SGS LAND Press and Media Coverage",
    "url": "https://sgsland.vn/press-media",
    "datePublished": "2026-06-15"
  }, {
    "@type": "Organization",
    "@id": "https://sgsland.vn/#organization",
    "name": "SGS LAND",
    "url": "https://sgsland.vn",
    "foundingDate": "2024",
    "taxID": "0312960439",
    "sameAs": [
      "https://www.linkedin.com/company/sgs-land",
      "https://www.facebook.com/sgsland.vn",
      "https://tinnhanhchungkhoan.vn",
      "https://cafeland.vn",
      "https://reatimes.vn"
    ]
  }];
  const mentions = [
    { outlet: "CafeLand", date: "05/2026", headline: "SGS LAND ra mat cong nghe dinh gia BDS bang AI chinh xac +/-4.8%", url: "https://cafeland.vn", type: "Bao dien tu" },
    { outlet: "Reatimes", date: "04/2026", headline: "Proptech Viet Nam 2026: SGS LAND dan dau xu huong so hoa moi gioi BDS", url: "https://reatimes.vn", type: "Tap chi BDS" },
    { outlet: "DauTuChungKhoan", date: "03/2026", headline: "Fintech va Proptech hoi tu: SGS LAND ket hop dinh gia AI voi tu van phap ly", url: "https://tinnhanhchungkhoan.vn", type: "Bao tai chinh" },
    { outlet: "BatDongSan.com.vn", date: "02/2026", headline: "Top 10 cong ty moi gioi BDS TP.HCM uy tin nhat 2026", url: "https://batdongsan.com.vn", type: "Nen tang BDS" },
    { outlet: "Tuoi Tre", date: "01/2026", headline: "Thang dien tu hoa thi truong BDS: mua nha khong can gap moi gioi", url: "https://tuoitre.vn", type: "Bao lon" },
  ];
  return (
    <div className="min-h-screen bg-[var(--bg-surface)] font-sans">
      <SeoHead
        title="Press and Media | SGS LAND - Bao Chi Va Truyen Thong"
        description="Tong hop cac lan SGS LAND duoc de cap tren bao chi va truyen thong chuyen nganh BDS Viet Nam. Press kit, tai nguyen truyen thong, thong tin lien he."
        canonicalPath="/press-media"
        structuredData={structuredData}
      />
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-sm px-4 py-2 rounded-full mb-6"><span>E-E-A-T Authority Signals</span></div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Press &amp; Media</h1>
          <p className="text-slate-300 text-lg">Thong tin bao chi, press kit va cac lan SGS LAND duoc de cap tren truyen thong.</p>
        </div>
      </section>
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <section className="grid grid-cols-3 gap-6">
          {[{value:"5+",label:"Lan duoc de cap tren bao"},{value:"2024",label:"Nam thanh lap"},{value:"1.247+",label:"Moi gioi doi tac"}].map((s,i)=>(
            <div key={i} className="text-center bg-slate-50 rounded-xl p-6"><div className="text-3xl font-bold text-blue-600 mb-2">{s.value}</div><div className="text-slate-600 text-sm">{s.label}</div></div>
          ))}
        </section>
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Duoc De Cap Tren Bao Chi</h2>
          <div className="space-y-4">{mentions.map((m,i)=>(
            <div key={i} className="flex gap-4 bg-[var(--bg-surface)] border border-slate-100 rounded-xl p-5 shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">{i+1}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{m.type}</span><span className="text-xs text-slate-400">{m.date}</span></div>
                <h3 className="font-medium text-slate-800 mb-1" itemProp="name">{m.headline}</h3>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{m.outlet}</a>
              </div>
            </div>
          ))}</div>
        </section>
        <section className="bg-slate-50 rounded-xl p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Press Kit - Tai Nguyen Truyen Thong</h2>
          <p className="text-sm text-slate-600 mb-4">De nhan press kit, vui long lien he: <strong>press@sgsland.vn</strong></p>
          <div className="grid md:grid-cols-2 gap-3">{[
            {name:"Logo SGS LAND (SVG, PNG)",desc:"Logo chinh thuc va bien the mau sac"},
            {name:"Anh CEO va doi ngu lanh dao",desc:"Hinh anh chinh thuc chuyen nghiep"},
            {name:"Fact Sheet 2026",desc:"Thong tin cong ty, so lieu kinh doanh"},
            {name:"Bao cao thi truong BDS Q2/2026",desc:"PDF day du, co the trich dan voi ghi nguon"},
          ].map((item,i)=>(
            <div key={i} className="bg-[var(--bg-surface)] rounded-lg p-4 border border-slate-100">
              <div className="font-medium text-slate-800 text-sm">{item.name}</div>
              <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
            </div>
          ))}</div>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Thong Tin Lien He (NAP - Name Address Phone)</h2>
          <div className="grid md:grid-cols-2 gap-6 bg-[var(--bg-surface)] border border-slate-100 rounded-xl p-6 text-sm">
            <div className="space-y-2">
              <div><strong>Ten:</strong> Cong ty Co phan SGS Land</div>
              <div><strong>MST:</strong> 0312960439</div>
              <div><strong>Dia chi:</strong> TP. Ho Chi Minh, Viet Nam</div>
              <div><strong>Website:</strong> <a href="https://sgsland.vn" className="text-blue-600">sgsland.vn</a></div>
              <div><strong>Email:</strong> <a href="mailto:press@sgsland.vn" className="text-blue-600">press@sgsland.vn</a></div>
            </div>
            <div className="space-y-2">
              <div><strong>LinkedIn:</strong> <a href="https://linkedin.com/company/sgs-land" className="text-blue-600" target="_blank" rel="noopener noreferrer">linkedin.com/company/sgs-land</a></div>
              <div><strong>Facebook:</strong> <a href="https://facebook.com/sgsland.vn" className="text-blue-600" target="_blank" rel="noopener noreferrer">facebook.com/sgsland.vn</a></div>
              <div><strong>Nam thanh lap:</strong> 2024</div>
              <div><strong>Linh vuc:</strong> Proptech, BDS, AI Valuation</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
