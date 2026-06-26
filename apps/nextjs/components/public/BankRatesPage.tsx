// @ts-nocheck
"use client";
import { useState } from "react";
const STATIC_BANKS = [
  { bank: "Vietcombank", rate6m: "5.2%", rate12m: "6.8%", rate24m: "7.2%", rate36m: "7.5%", note: "Ưu đãi 12 tháng đầu" },
  { bank: "BIDV", rate6m: "5.0%", rate12m: "6.5%", rate24m: "7.0%", rate36m: "7.3%", note: "Ưu đãi lãi suất mua nhà" },
  { bank: "VietinBank", rate6m: "5.1%", rate12m: "6.6%", rate24m: "7.1%", rate36m: "7.4%", note: "Cố định 24 tháng đầu" },
  { bank: "Techcombank", rate6m: "5.5%", rate12m: "7.0%", rate24m: "7.5%", rate36m: "7.8%", note: "Không phí trả trước hạn" },
  { bank: "VPBank", rate6m: "5.8%", rate12m: "7.2%", rate24m: "7.8%", rate36m: "8.1%", note: "Giải ngân nhanh 3 ngày" },
  { bank: "MB Bank", rate6m: "5.3%", rate12m: "6.9%", rate24m: "7.3%", rate36m: "7.6%", note: "Ưu đãi khách hàng mới" },
  { bank: "ACB", rate6m: "5.6%", rate12m: "7.1%", rate24m: "7.6%", rate36m: "7.9%", note: "Hỗ trợ mua BĐS cao cấp" },
  { bank: "Sacombank", rate6m: "5.4%", rate12m: "6.8%", rate24m: "7.3%", rate36m: "7.7%", note: "Ưu đãi theo gói sản phẩm" },
];
interface StaticBankRate {
  bank: string;
  rate6m: string;
  rate12m: string;
  rate24m: string;
  rate36m: string;
  note: string;
}
export function BankRatesPage({ bankRates }: { bankRates: StaticBankRate[] | unknown[] }) {
  const rates: StaticBankRate[] = bankRates.length > 0 ? (bankRates as StaticBankRate[]) : STATIC_BANKS;
  // Simple mortgage calculator
  const [loanAmount, setLoanAmount] = useState(3); // tỷ
  const [loanRate, setLoanRate] = useState(7);    // %/năm
  const [loanTerm, setLoanTerm] = useState(20);   // năm
  const monthlyPayment = () => {
    const P = loanAmount * 1e9;
    const r = loanRate / 100 / 12;
    const n = loanTerm * 12;
    if (r === 0) return P / n;
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Lãi Suất Vay Mua BĐS 2025
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Tổng hợp lãi suất tốt nhất từ các ngân hàng lớn — cập nhật hàng tuần
        </p>
      </div>
      {/* Rate table */}
      <div className="rounded-2xl overflow-hidden mb-12" style={{ border: "1px solid var(--border-default)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
                {["Ngân hàng", "6 tháng", "12 tháng", "24 tháng", "36 tháng", "Ghi chú"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.bank} className="transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ borderBottom: i < rates.length - 1 ? "1px solid var(--border-default)" : "none" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{r.bank}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-success)" }}>{r.rate6m}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-success)" }}>{r.rate12m}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-warning)" }}>{r.rate24m}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-warning)" }}>{r.rate36m}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Mortgage calculator */}
      <div className="p-6 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          🧮 Tính toán khoản vay
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {[
            { label: "Số tiền vay (tỷ VNĐ)", value: loanAmount, onChange: setLoanAmount, min: 0.5, max: 50, step: 0.5 },
            { label: "Lãi suất (%/năm)", value: loanRate, onChange: setLoanRate, min: 4, max: 15, step: 0.1 },
            { label: "Thời hạn vay (năm)", value: loanTerm, onChange: setLoanTerm, min: 5, max: 35, step: 5 },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
              <input type="number" value={f.value} onChange={(e) => f.onChange(Number(e.target.value))}
                min={f.min} max={f.max} step={f.step}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30"
                style={{ background: "var(--bg-surface)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
              />
            </div>
          ))}
        </div>
        <div className="p-4 rounded-xl text-center" style={{ background: "var(--primary-subtle)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Thanh toán hàng tháng (ước tính)</p>
          <p className="text-3xl font-bold" style={{ color: "var(--primary-600)" }}>
            {(monthlyPayment() / 1e6).toFixed(1)} triệu VNĐ
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Tổng lãi: {((monthlyPayment() * loanTerm * 12 - loanAmount * 1e9) / 1e9).toFixed(2)} tỷ
          </p>
        </div>
      </div>
    </div>
  );
}