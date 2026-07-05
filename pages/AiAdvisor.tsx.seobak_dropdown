import React, { useState } from 'react';

/**
 * AiAdvisor.tsx - Trang AI Tu Van Dau Tu BDS (AI Property Advisor).
 * Nguoi dung nhap ngan sach / khu vuc / muc dich / khau vi rui ro / dong tien,
 * AI tra ve 3-5 du an phu hop kem diem dau tu, ROI du kien, uu/nhuoc diem, so sanh.
 */

interface ProjectResult {
  projectId: string;
  name: string;
  location: string;
  priceFrom: string;
  developer: string;
  type: string;
  investmentScore: number;
  expectedRoiPct: string;
  pros: string[];
  cons: string[];
  reasoning: string;
}
interface AdviceResponse {
  ok: boolean;
  recommendations: ProjectResult[];
  comparison: string;
  disclaimer: string;
  error?: string;
}

const PURPOSES = [
  { value: 'o', label: 'Để ở' },
  { value: 'dau_tu', label: 'Đầu tư' },
  { value: 'cho_thue', label: 'Cho thuê' },
];
const RISKS = [
  { value: 'thap', label: 'Thấp' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'cao', label: 'Cao' },
];
const CASHFLOWS = [
  { value: 'khong_quan_trong', label: 'Không quan trọng' },
  { value: 'on_dinh', label: 'Ổn định' },
  { value: 'toi_da', label: 'Tối đa hoá' },
];

function scoreColor(s: number): string {
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#ca8a04';
  return '#dc2626';
}

export default function AiAdvisor() {
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [area, setArea] = useState('');
  const [purpose, setPurpose] = useState('dau_tu');
  const [risk, setRisk] = useState('trung_binh');
  const [cashflow, setCashflow] = useState('on_dinh');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AdviceResponse | null>(null);

  const toVnd = (s: string): number | undefined => {
    const n = Number(String(s).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/advisor/recommend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetMin: toVnd(budgetMin),
          budgetMax: toVnd(budgetMax),
          area,
          purpose,
          risk,
          cashflow,
          notes,
        }),
      });
      const data: AdviceResponse = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
        AI Tư Vấn Đầu Tư Bất Động Sản
      </h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Nhập nhu cầu của bạn, AI sẽ gợi ý 3-5 dự án phù hợp kèm điểm đầu tư, tỷ suất lợi
        nhuận dự kiến, phân tích ưu/nhược điểm và so sánh.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Ngân sách tối thiểu (VND)</span>
          <input
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="VD: 2000000000"
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Ngân sách tối đa (VND)</span>
          <input
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="VD: 5000000000"
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / span 2' }}>
          <span>Khu vực mong muốn</span>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="VD: Quận 2, TP.HCM"
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Mục đích</span>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={inputStyle}>
            {PURPOSES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Mức chấp nhận rủi ro</span>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} style={inputStyle}>
            {RISKS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Kỳ vọng dòng tiền</span>
          <select value={cashflow} onChange={(e) => setCashflow(e.target.value)} style={inputStyle}>
            {CASHFLOWS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / span 2' }}>
          <span>Ghi chú thêm (tuỳ chọn)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="VD: ưu tiên gần trường học, pháp lý rõ ràng..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>
        <div style={{ gridColumn: '1 / span 2' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#94a3b8' : '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'AI đang phân tích...' : 'Nhận tư vấn từ AI'}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 16, color: '#dc2626', fontWeight: 500 }}>{error}</div>
      )}

      {result && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            Gợi ý {result.recommendations.length} dự án phù hợp
          </h2>
          {result.recommendations.length === 0 && (
            <p style={{ color: '#64748b' }}>{result.comparison}</p>
          )}
          {result.recommendations.map((p) => (
            <div
              key={p.projectId}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 18,
                marginBottom: 16,
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ color: '#64748b', fontSize: 14 }}>
                    {p.developer} · {p.location} · {p.type} · {p.priceFrom}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(p.investmentScore) }}>
                    {p.investmentScore}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>/100 điểm</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <strong>Tỷ suất lợi nhuận dự kiến:</strong> {p.expectedRoiPct}
              </div>
              <p style={{ marginTop: 8, fontSize: 14, color: '#334155' }}>{p.reasoning}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#16a34a', fontSize: 14 }}>Ưu điểm</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {p.pros.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>Nhược điểm</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {p.cons.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}

          {result.comparison && result.recommendations.length > 0 && (
            <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 16, marginTop: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>So sánh tổng hợp</div>
              <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>{result.comparison}</p>
            </div>
          )}

          <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
            {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
};
