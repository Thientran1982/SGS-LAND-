"use client";

import { BookOpen, ChevronRight, Users, Home, BarChart3, MessageSquare, Settings, Zap, FileText, HelpCircle, ExternalLink } from "lucide-react";

interface GuideSection { id: string; icon: React.ElementType; title: string; desc: string; topics: string[]; }

const SECTIONS: GuideSection[] = [
  { id: "leads", icon: Users, title: "Quản lý Leads & Khách hàng", desc: "Hướng dẫn thêm, phân loại và chăm sóc khách hàng tiềm năng", topics: ["Thêm lead mới từ nhiều nguồn", "Phân loại và gán nhãn lead", "Chấm điểm lead tự động", "Lịch sử tương tác và ghi chú", "Phân phối lead cho nhân viên"] },
  { id: "listings", icon: Home, title: "Quản lý Kho hàng BĐS", desc: "Thêm và quản lý danh sách bất động sản", topics: ["Thêm sản phẩm BĐS mới", "Quản lý mặt bằng và vị trí", "Đặt giá và cập nhật trạng thái", "Xuất danh sách BĐS (Excel)", "Tích hợp ảnh và video"] },
  { id: "projects", icon: Home, title: "Quản lý Dự án", desc: "Quản lý các dự án bất động sản lớn", topics: ["Tạo và cấu hình dự án mới", "Quản lý sơ đồ mặt bằng", "Cài đặt microsite công khai", "Phân quyền dự án cho nhóm", "Theo dõi tiến độ mở bán"] },
  { id: "inbox", icon: MessageSquare, title: "Hộp thư & Giao tiếp", desc: "Quản lý tin nhắn và tương tác với khách hàng", topics: ["Đọc và trả lời tin nhắn", "Kết nối Facebook Messenger", "Tích hợp Zalo OA", "Chat trực tiếp trên website", "Lịch sử hội thoại"] },
  { id: "reports", icon: BarChart3, title: "Báo cáo & Thống kê", desc: "Theo dõi hiệu suất và phân tích dữ liệu", topics: ["Dashboard tổng quan", "Báo cáo leads theo thời gian", "Hiệu suất nhân viên", "Thống kê dự án và kho hàng", "Xuất báo cáo Excel/PDF"] },
  { id: "ai", icon: Zap, title: "AI & Tự động hóa", desc: "Sử dụng các tính năng AI để tăng hiệu suất", topics: ["Định giá BĐS tự động (AVM)", "Chatbot AI cho khách hàng", "Chấm điểm lead bằng AI", "Tạo nội dung marketing AI", "Phân tích thị trường"] },
  { id: "settings", icon: Settings, title: "Cài đặt hệ thống", desc: "Cấu hình và tùy chỉnh hệ thống", topics: ["Cài đặt công ty và thương hiệu", "Quản lý người dùng và phân quyền", "Quy tắc phân phối leads", "Tích hợp CRM bên ngoài", "Bảo mật và đăng nhập"] },
];

export default function UserGuidePage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Hướng dẫn sử dụng</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Tài liệu hướng dẫn sử dụng hệ thống SGS LAND CRM</p>
      </div>

      {/* Quick links */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)30" }}>
        <BookOpen className="w-8 h-8 shrink-0" style={{ color: "var(--primary-600)" }} />
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Cần hỗ trợ thêm?</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Liên hệ đội ngũ hỗ trợ của SGS LAND để được giải đáp trực tiếp</p>
        </div>
        <a href="mailto:support@sgsland.vn" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shrink-0" style={{ background: "var(--primary-600)", color: "#fff" }}>
          <ExternalLink className="w-4 h-4" />Liên hệ hỗ trợ
        </a>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.id} className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-subtle)" }}>
                  <Icon className="w-5 h-5" style={{ color: "var(--primary-600)" }} />
                </div>
                <div>
                  <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{sec.title}</h2>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{sec.desc}</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {sec.topics.map((topic) => (
                  <li key={topic} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary-600)" }} />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-5 h-5" style={{ color: "var(--primary-600)" }} /><h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Câu hỏi thường gặp</h2></div>
        <div className="space-y-3">
          {[
            ["Làm sao để thêm lead mới?", "Vào menu Leads → Nhấn nút \"Thêm lead\" → Điền thông tin và lưu."],
            ["Cách kết nối Facebook Messenger?", "Vào Cài đặt → Tích hợp → Facebook → Nhập Page ID và Access Token."],
            ["Tôi có thể xuất báo cáo không?", "Có, vào Báo cáo → Chọn loại báo cáo → Nhấn \"Xuất Excel\" hoặc \"Xuất PDF\"."],
            ["AI định giá hoạt động thế nào?", "Hệ thống sử dụng 9 hệ số AVM kết hợp với dữ liệu thị trường để ước tính giá tự động."],
            ["Làm sao để thêm người dùng mới?", "Vào Quản lý người dùng → Nhấn \"Thêm người dùng\" → Điền email, vai trò và lưu."],
          ].map(([q, a]) => (
            <div key={q as string} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
              <p className="font-medium text-sm mb-1" style={{ color: "var(--text-primary)" }}>{q}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
