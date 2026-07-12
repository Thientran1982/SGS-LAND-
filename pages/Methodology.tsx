import { useEffect } from 'react';
import { SeoHead } from '../components/SeoHead';

export default function Methodology() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const structuredData = [
    {
      "@type": "TechArticle",
      "@id": "https://sgsland.vn/methodology",
      "headline": "Phuong Phap Dinh Gia Bat Dong San AI — SGS-AVM 9 He So",
      "description": "Tai lieu ky thuat ve phuong phap dinh gia BDS tu dong SGS-AVM v2.1 su dung 9 he so hieu chinh theo chuan TDGVN/IVS. Do chinh xac +-4.8% MAPE.",
      "author": { "@type": "Organization", "name": "SGS LAND Research", "url": "https://sgsland.vn" },
      "publisher": { "@type": "Organization", "name": "SGS LAND", "url": "https://sgsland.vn" },
      "datePublished": "2026-01-01",
      "dateModified": "2026-06-15",
      "inLanguage": "vi-VN",
      "url": "https://sgsland.vn/methodology",
      "proficiencyLevel": "Expert",
      "dependencies": "Python, scikit-learn, TensorFlow, PostgreSQL",
      "wordCount": 2500
    },
    {
      "@type": "HowTo",
      "name": "Cach su dung SGS-AVM de dinh gia bat dong san",
      "description": "Huong dan tung buoc su dung cong cu dinh gia AI SGS-AVM de co ket qua chinh xac",
      "totalTime": "PT5M",
      "estimatedCost": { "@type": "MonetaryAmount", "currency": "VND", "value": "0" },
      "step": [
        { "@type": "HowToStep", "position": 1, "name": "Nhap dia chi BDS", "text": "Nhap dia chi chinh xac cua bat dong san: so nha, ten duong, phuong/xa, quan/huyen, tinh/thanh pho" },
        { "@type": "HowToStep", "position": 2, "name": "Chon loai hinh BDS", "text": "Chon loai BDS: can ho, nha pho, biet thu, dat nen, shophouse, van phong" },
        { "@type": "HowToStep", "position": 3, "name": "Dien thong tin chi tiet", "text": "Nhap dien tich san, so tang, nam xay dung, tinh trang phap ly (co so hong, chua co so...) va cac thong tin bo sung" },
        { "@type": "HowToStep", "position": 4, "name": "Nhan xet qua", "text": "He thong tra ve ket qua trong 2-5 giay: gia uoc tinh, khoang dao dong +-4.8%, bieu do so sanh khu vuc, lich su gia 24 thang" },
        { "@type": "HowToStep", "position": 5, "name": "Tai bao cao PDF", "text": "Tai bao cao dinh gia day du dang PDF (mien phi cho 3 luot/thang, khong gioi han cho goi Premium)" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-surface)] font-sans">
      <SeoHead
        title="Phuong Phap Dinh Gia AI SGS-AVM | 9 He So Hieu Chinh | Do Chinh Xac +-4.8%"
        description="Tai lieu ky thuat day du ve phuong phap dinh gia bat dong san tu dong SGS-AVM v2.1. Su dung 9 he so hieu chinh theo chuan TDGVN/IVS, do chinh xac +-4.8% MAPE, du lieu 45.000+ giao dich thuc te."
        canonicalPath="/methodology"
        structuredData={structuredData}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <span>Tai lieu ky thuat</span>
            <span>|</span>
            <span>SGS-AVM v2.1</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            Phuong Phap Dinh Gia AI<br />
            <span className="text-blue-400">SGS-AVM — 9 He So Hieu Chinh</span>
          </h1>
          <p className="text-lg text-blue-100 mb-8 max-w-3xl">
            He thong Automated Valuation Model (AVM) cua SGS LAND su dung 9 he so hieu chinh theo chuan
            TDGVN (Tieu chuan Tham Dinh Gia Viet Nam) va IVS (International Valuation Standards),
            dat do chinh xac ±4.8% MAPE tren tap test 2.400+ giao dich cong chung tai TP.HCM.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "±4.8%", label: "Do chinh xac MAPE" },
              { value: "2.400+", label: "Giao dich test" },
              { value: "9", label: "He so hieu chinh" },
              { value: "45.000+", label: "Giao dich du lieu" },
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-300">{stat.value}</div>
                <div className="text-sm text-blue-200 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16 space-y-16">

        {/* Section 1: Tong quan */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">1. Tong Quan Ve SGS-AVM</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600 leading-relaxed mb-4">
              SGS-AVM (SGS Automated Valuation Model) la he thong dinh gia bat dong san tu dong
              duoc phat trien boi doi ngu ky thuat SGS LAND tu nam 2023. He thong ket hop cac phuong phap
              thong ke nang cao (Gradient Boosting, Spatial Regression) voi du lieu giao dich thuc te
              tu nhiều nguon de tao ra mo hinh dinh gia co do chinh xac cao.
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              SGS-AVM v2.1 (cap nhat thang 3/2026) tuan theo chuan TDGVN 04:2014 (Tieu chuan Tham Dinh Gia
              Viet Nam) va IVS 105 — Valuation Approaches and Methods. Ket qua cua SGS-AVM duoc su dung
              nhu gia tri tham chieu, khong thay the tham dinh vien co chung chi cho muc dich vay ngan hang
              chinh thuc.
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 mt-6">
            <h3 className="font-bold text-blue-900 mb-3">Cong thuc dinh gia co ban:</h3>
            <div className="bg-[var(--bg-surface)] rounded-lg p-4 font-mono text-sm text-slate-700 border border-blue-200">
              <p className="font-bold">GiaTri_BDS = GiaCoSo × H1 × H2 × H3 × ... × H9</p>
              <p className="mt-2 text-slate-500">Trong do:</p>
              <p>GiaCoSo = Gia trung binh BDS tuong tu (per m2) × Dien tich</p>
              <p>H1...H9 = 9 he so hieu chinh (0.75 — 1.40 tuy tung he so)</p>
            </div>
          </div>
        </section>

        {/* Section 2: Nguon du lieu */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">2. Nguon Du Lieu</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                source: "Giao dich cong chung thuc te",
                details: "45.000+ giao dich BDS duoc cong chung tai TP.HCM, Dong Nai, Binh Duong. Cap nhat hang tuan tu mang luoi cong chung vien doi tac.",
                weight: "60%",
                icon: "📋"
              },
              {
                source: "CBRE & Savills Vietnam",
                details: "Bao cao thi truong hang quy tu 2 don vi tu van BDS quoc te hang dau tai Viet Nam. Du lieu gia thue, ty suat von hoa.",
                weight: "15%",
                icon: "📊"
              },
              {
                source: "Batdongsan.com.vn (da loc)",
                details: "Du lieu rao ban da qua xu ly thong ke, loai bo gia ao va tin khong hop le. Dung de uoc luong spread giua gia rao va gia giao dich.",
                weight: "10%",
                icon: "🌐"
              },
              {
                source: "Du lieu noi bo SGS LAND",
                details: "Lich su giao dich thuc te tu 1.247 moi gioi SGS LAND, bao gom gia chot cuoi cung (khong phai gia rao). Du lieu doc quyen.",
                weight: "15%",
                icon: "🏢"
              }
            ].map((item, i) => (
              <div key={i} className="bg-[var(--bg-surface)] border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-800">{item.source}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Trong so: {item.weight}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{item.details}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: 9 He so hieu chinh */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">3. Bang 9 He So Hieu Chinh (AVM Factors)</h2>
          <p className="text-slate-600 mb-6">
            SGS-AVM ap dung 9 he so hieu chinh theo chuan TDGVN 04:2014, moi he so duoc tinh toan
            tu du lieu hoi quy thong ke tren tap du lieu giao dich thuc te:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-3 text-left">He so</th>
                  <th className="px-4 py-3 text-left">Ten day du</th>
                  <th className="px-4 py-3 text-center">Khoang gia tri</th>
                  <th className="px-4 py-3 text-center">Trong so</th>
                  <th className="px-4 py-3 text-left">Mo ta</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["H1", "Vi tri & Kha nang tiep can", "0.75 — 1.35", "25%", "Khoang cach den CBD, mat tien/hem, duong truoc nha, ket noi giao thong"],
                  ["H2", "Dien tich su dung", "0.82 — 1.18", "18%", "Hieu chinh dien tich lon/nho so voi BDS tuong tu (diemension effect)"],
                  ["H3", "Phap ly & Tinh trang so", "0.85 — 1.20", "15%", "Co so hong rieng (+20%), chua co so (-15%), tranh chap/quy hoach (-20%)"],
                  ["H4", "Nam xay dung & Tinh trang vat ly", "0.78 — 1.10", "12%", "Nha moi (0-5 nam): H4=1.05; Nha cu (>20 nam): H4=0.85; Da cai tao: H4=0.95"],
                  ["H5", "Phan khuc va Chat luong", "0.80 — 1.40", "10%", "Luxury du an (+40% vs binh dan); chuan Nhat/Singapore (+25%); binh dan (-20%)"],
                  ["H6", "View & Huong", "0.90 — 1.15", "7%", "View song/bien/ho (+15%); Dong/Dong Nam (+5%); Tay nang (-8%); Huong xau (-10%)"],
                  ["H7", "Tien ich khu vuc", "0.88 — 1.12", "6%", "Gan truong quoc te, benh vien, trung tam thuong mai: +5-12%; Gan nghia trang/KCN: -8-12%"],
                  ["H8", "Xu huong gia thi truong", "0.92 — 1.15", "5%", "Dieu chinh theo chi so tang gia quy hien tai so voi thoi diem giao dich tham chieu"],
                  ["H9", "Phan khuc cau va tinh khan hiem", "0.90 — 1.20", "2%", "Mat khan (low supply + high demand): +10-20%; Dang du cung: -5-10%"]
                ].map(([factor, name, range, weight, desc], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-bold text-blue-600">{factor}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-slate-700">{range}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">{weight}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Do chinh xac */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">4. Do Chinh Xac Va Kiem Chung</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { metric: "MAPE", value: "4.8%", desc: "Mean Absolute Percentage Error — do chinh xac toan bo model", color: "bg-green-50 border-green-200" },
              { metric: "RMSE", value: "8.2%", desc: "Root Mean Square Error — nhan manh cac truong hop lech lon", color: "bg-blue-50 border-blue-200" },
              { metric: "R²", value: "0.94", desc: "He so xac dinh — 94% bien dong gia duoc giai thich boi model", color: "bg-[var(--sgs-primary)]/10 border-[var(--sgs-primary)]" },
            ].map((m, i) => (
              <div key={i} className={`rounded-xl p-6 border ${m.color}`}>
                <div className="text-3xl font-bold text-slate-800 mb-1">{m.value}</div>
                <div className="font-bold text-slate-700 mb-2">{m.metric}</div>
                <p className="text-sm text-slate-600">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="font-bold text-slate-800 mb-4">Ket qua kiem chung theo khu vuc (tap test Q1/2026):</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 font-semibold text-slate-700">Khu vuc</th>
                    <th className="text-center py-2 font-semibold text-slate-700">So mau test</th>
                    <th className="text-center py-2 font-semibold text-slate-700">MAPE</th>
                    <th className="text-center py-2 font-semibold text-slate-700">Ghi chu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Q.1, Q.3, Q.10 (Trung tam)", "124", "5.1%", "Gia cao, it giao dich → do chinh xac giam nhe"],
                    ["TP Thu Duc (Q.2, Q.9, Thủ Đức)", "687", "4.2%", "Nhieu giao dich, du lieu phong phu"],
                    ["Binh Thanh, Phu Nhuan", "312", "4.6%", "Dat tot, khu vuc on dinh"],
                    ["Q.7, Nha Be", "198", "5.3%", "Nhieu du an moi, gia thay doi nhanh"],
                    ["Binh Chanh, Hoc Mon", "156", "6.2%", "It du lieu giao dich cong chung"],
                    ["Long Thanh, Nhon Trach (Dong Nai)", "287", "7.8%", "Du lieu mong, gia bien dong cao"],
                    ["Binh Duong (Thu Dau Mot, Di An)", "342", "6.5%", "Du lieu tot hon nho nhieu KCN"],
                  ].map(([area, n, mape, note], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-slate-50/50'}>
                      <td className="py-2.5 text-slate-800">{area}</td>
                      <td className="py-2.5 text-center text-slate-600">{n}</td>
                      <td className="py-2.5 text-center">
                        <span className={`font-bold ${parseFloat(mape) < 5.5 ? 'text-green-600' : parseFloat(mape) < 7 ? 'text-amber-600' : 'text-red-500'}`}>{mape}</span>
                      </td>
                      <td className="py-2.5 text-slate-500 text-xs">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 5: So sanh doi thu */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">5. So Sanh SGS-AVM Voi Cac Giai Phap Dinh Gia Khac</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-3 text-left">Tieu chi</th>
                  <th className="px-4 py-3 text-center bg-blue-700">SGS-AVM</th>
                  <th className="px-4 py-3 text-center">Tham dinh vien</th>
                  <th className="px-4 py-3 text-center">Tra gia tren web</th>
                  <th className="px-4 py-3 text-center">Hoi moi gioi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Toc do", "2-5 giay", "3-10 ngay", "Ngay lap tuc", "1-3 ngay"],
                  ["Chi phi", "Mien phi (3 luot/thang)", "3-15 trieu VND", "Mien phi", "Mien phi *"],
                  ["Do chinh xac", "±4.8% MAPE", "±2-3% (chuyen gia)", "±20-40%", "±10-25%"],
                  ["Tinh khach quan", "Cao (AI, khong cam xuc)", "Cao (chuyen gia)", "Thap (gia rao)", "Trung binh"],
                  ["Lich su gia", "24 thang", "Khong", "Co han", "Khong"],
                  ["Bao cao PDF", "Co (co the tai)", "Co", "Khong", "Khong"],
                  ["Chia se giao dich", "Khong can thiet", "Can", "Khong", "Yeu cau"],
                  ["Tin cay phap ly", "Tham chieu", "Chinh thuc", "Khong", "Khong"],
                ].map(([criteria, sgs, appraiser, web, broker], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-medium text-slate-700">{criteria}</td>
                    <td className="px-4 py-3 text-center bg-blue-50 text-blue-700 font-semibold">{sgs}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{appraiser}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{web}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{broker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">* Moi gioi duoc tra hoa hong tu nguoi ban, khong tu nguoi mua.</p>
        </section>

        {/* Section 6: Cach su dung */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">6. Huong Dan Su Dung SGS-AVM</h2>
          <div className="space-y-4">
            {[
              { step: "01", title: "Nhap dia chi chinh xac", desc: "Nhap so nha, ten duong, phuong/xa, quan/huyen. He thong dung geocoding de dinh vi chinh xac vi tri va tinh H1 (he so vi tri)." },
              { step: "02", title: "Chon loai hinh va thong tin BDS", desc: "Chon: can ho / nha pho / biet thu / dat nen / shophouse. Nhap dien tich, so tang, nam xay dung." },
              { step: "03", title: "Them thong tin bo sung (tang do chinh xac)", desc: "Tinh trang so hong, huong cua chinh, view, tinh trang noi that, khu dan cu... moi thong tin bo sung tang do chinh xac len 1-3%." },
              { step: "04", title: "Xem ket qua va bieu do", desc: "Ket qua hien thi: gia uoc tinh, khoang dao dong, vi tri tren bieu do so sanh 10 BDS tuong tu, lich su gia 24 thang, ban do nhiet gia khu vuc." },
              { step: "05", title: "Tai bao cao PDF", desc: "Bao cao day du 4-6 trang bao gom: tom tat ket qua, bang so sanh BDS tuong tu, phan tich the manh/yeu, khuyen nghi gia dam phan." },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 bg-[var(--bg-surface)] border border-slate-100 rounded-xl p-5 shadow-sm">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">{item.step}</div>
                <div>
                  <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 7: Gioi han */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-amber-900 mb-4">7. Gioi Han Va Luu Y</h2>
          <ul className="space-y-2 text-amber-800 text-sm">
            <li>• <strong>Khong thay the tham dinh vien chinh thuc:</strong> Ngan hang yeu cau tham dinh vien co chung chi (Bo Tai chinh) de giai ngan vay.</li>
            <li>• <strong>Kem chinh xac voi BDS khong co giao dich tham chieu:</strong> Nha co kien truc doc dao, BDS co lich su dat biet, dat trong chua phat trien.</li>
            <li>• <strong>Do chinh xac giam ngoai TP.HCM:</strong> Dong Nai, Binh Duong ±6-8%; Long An, Vung Tau ±10-15% do du lieu mong hon.</li>
            <li>• <strong>Gia tri tham chieu, khong phai gia phap ly:</strong> Khong duoc su dung thay the dieu kien phap ly cua hop dong mua ban.</li>
            <li>• <strong>Cap nhat du lieu theo quy:</strong> Co the co do lech 2-4 tuan giua du lieu va thi truong thuc te trong giai doan bien dong manh.</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-12 text-white">
          <h2 className="text-2xl font-bold mb-4">Thu Ngay Dinh Gia AI Mien Phi</h2>
          <p className="text-blue-100 mb-8 max-w-md mx-auto">
            Ap dung phuong phap SGS-AVM 9 he so — nhan ket qua trong 5 giay, mien phi 3 luot/thang.
          </p>
          <a
            href="/ai-valuation"
            className="inline-block bg-[var(--bg-surface)] text-blue-700 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors"
          >
            Dinh Gia BDS Ngay →
          </a>
        </section>

      </main>
    </div>
  );
}
