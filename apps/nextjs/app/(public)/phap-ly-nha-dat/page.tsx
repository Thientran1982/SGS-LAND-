import type { Metadata } from "next";
import Link from "next/link";
import { Scale, FileText, CheckCircle, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Pháp Lý Nhà Đất 2025 | Hướng Dẫn Mua Bán BĐS | SGS LAND",
  description: "Hướng dẫn pháp lý mua bán nhà đất 2025: kiểm tra sổ hồng, thủ tục sang tên, thuế phí, lưu ý khi ký hợp đồng. Bảo vệ quyền lợi người mua.",
  alternates: { canonical: "https://sgsland.vn/phap-ly-nha-dat" },
};
export const revalidate = 86400;

const FAQ = [
  { q: "Sổ hồng và sổ đỏ khác nhau như thế nào?", a: "Sổ đỏ cấp cho đất ở. Sổ hồng cấp cho nhà + đất. Từ 2009, cả hai thống nhất thành Giấy chứng nhận quyền sở hữu (màu hồng)." },
  { q: "Mua nhà cần kiểm tra những giấy tờ gì?", a: "Sổ hồng/sổ đỏ gốc, CMND/CCCD chủ sở hữu, giấy phép xây dựng, không tranh chấp, không thế chấp ngân hàng, quy hoạch không bị thu hồi." },
  { q: "Thuế và phí khi mua bán nhà đất là bao nhiêu?", a: "Người bán: Thuế TNCN 2% giá bán. Người mua: Lệ phí trước bạ 0,5% + phí công chứng 0,1-0,3% + phí đăng ký 0,15%." },
  { q: "Đất nền dự án có sổ hồng riêng không?", a: "Chỉ khi chủ đầu tư hoàn thành nghĩa vụ tài chính, hoàn công mới có sổ hồng riêng. Nhiều dự án mới chỉ có hợp đồng mua bán — cần xác nhận pháp lý trước khi mua." },
];

export default function PhapLyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
          style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
          <Scale className="w-3.5 h-3.5" /> Pháp lý BĐS 2025
        </div>
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Pháp Lý Nhà Đất</h1>
        <p style={{ color: "var(--text-secondary)" }}>Hướng dẫn toàn diện thủ tục, giấy tờ và lưu ý pháp lý khi mua bán BĐS</p>
      </div>

      <div className="p-6 rounded-2xl mb-8" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <CheckCircle className="w-5 h-5" style={{ color: "var(--color-success)" }} /> Checklist Pháp Lý Khi Mua BĐS
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {["Xác minh sổ hồng/sổ đỏ gốc tại Phòng TNMT", "Kiểm tra quy hoạch sử dụng đất", "Tra cứu không tranh chấp, khiếu kiện", "Xác nhận không đang thế chấp ngân hàng", "Kiểm tra nghĩa vụ tài chính chủ đầu tư", "Hợp đồng công chứng tại văn phòng công chứng", "Kiểm tra diện tích thực tế so giấy tờ", "Xác minh danh tính chủ sở hữu"].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />{item}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl mb-8 flex gap-3" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: "#991b1b" }}>Lưu ý quan trọng</p>
          <p className="text-sm" style={{ color: "#7f1d1d" }}>Không đặt cọc, chuyển tiền khi chưa xác minh đầy đủ pháp lý. SGS LAND hỗ trợ kiểm tra pháp lý miễn phí.</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <FileText className="w-6 h-6" style={{ color: "var(--primary-600)" }} /> Câu Hỏi Thường Gặp
      </h2>
      <div className="space-y-4 mb-8">
        {FAQ.map((item) => (
          <div key={item.q} className="p-5 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>{item.q}</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.a}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: "var(--primary-600)" }}>Tư vấn pháp lý miễn phí</Link>
      </div>
    </div>
  );
}
