import { useState } from "react";

const CLOSE_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const INFO_ICON = (
  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ROLES: Record<string, { label: string; desc: string }> = {
  ADMIN: {
    label: "Quản Trị Viên",
    desc: "Toàn quyền quản trị hệ thống, bao gồm quản lý người dùng và thanh toán.",
  },
  SALES: {
    label: "Chuyên Viên Kinh Doanh",
    desc: "Quản lý khách hàng tiềm năng, tạo đề xuất và hợp đồng.",
  },
  TEAM_LEAD: {
    label: "Trưởng Nhóm",
    desc: "Quản lý nhóm kinh doanh, phân công và theo dõi hiệu suất.",
  },
  MARKETING: {
    label: "Marketing",
    desc: "Tạo chiến dịch, quản lý nội dung và phân tích marketing.",
  },
  VIEWER: {
    label: "Người Xem",
    desc: "Chỉ xem báo cáo và dữ liệu, không thể chỉnh sửa.",
  },
};

const USERS = [
  { name: "Nguyễn Văn Admin", email: "admin@sgs.vn", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin", status: "HĐ", statusColor: "emerald" },
  { name: "Trần Thị Lan", email: "lan.tran@sgs.vn", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lan", status: "HĐ", statusColor: "emerald" },
  { name: "Phạm Hồng Nhung", email: "nhung.pham@sgs.vn", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=nhung", status: "Chờ", statusColor: "amber" },
];

export function InviteModalOpen() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SALES");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Email không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }
    setError("");
  };

  return (
    <div
      className="relative overflow-hidden bg-slate-100 flex flex-col"
      style={{ width: 390, height: 844, fontFamily: "Inter, sans-serif" }}
    >
      {/* Background content (blurred) */}
      <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
        {/* Fake CommandCenter header */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-200 rounded-lg" />
            <span className="text-sm font-bold text-slate-600">Quản lý thành viên</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white" />
        </div>
        {/* Fake page header */}
        <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="bg-slate-100 rounded-lg px-2 py-1.5 text-[9px] font-black text-slate-500">Tổng 5</div>
            <div className="bg-emerald-50 rounded-lg px-2 py-1.5 text-[9px] font-black text-emerald-600">HĐ 3</div>
            <div className="bg-amber-50 rounded-lg px-2 py-1.5 text-[9px] font-black text-amber-600">Chờ 1</div>
          </div>
          <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs font-bold">Mời</div>
        </div>
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-400">Tìm theo tên...</div>
        </div>
        {USERS.map((u) => (
          <div key={u.email} className="bg-white border-b border-slate-50 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={u.avatar} className="w-8 h-8 rounded-full bg-slate-200" alt="" />
              <div>
                <div className="text-xs font-bold text-slate-700">{u.name}</div>
                <div className="text-[10px] text-slate-400">{u.email}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* BOTTOM SHEET MODAL — matches fixed code */}
      <div className="absolute inset-0 flex items-end justify-center">
        <div className="bg-white w-full rounded-t-[28px] p-6 pb-8 shadow-2xl border border-slate-100 relative z-10 max-h-[92%] overflow-y-auto">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Mời thành viên mới</h3>
            <button className="text-slate-400 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">
              {CLOSE_ICON}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-all ${
                  error
                    ? "border-rose-300 bg-rose-50 focus:ring-rose-500/20"
                    : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                }`}
                placeholder="email@congty.vn"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
              />
              {error && <p className="text-[10px] text-rose-500 font-bold mt-1">{error}</p>}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Vai trò</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
              >
                {Object.entries(ROLES).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>

              <div className="mt-2 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex gap-2">
                <div className="shrink-0 mt-0.5">{INFO_ICON}</div>
                <div>
                  <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide mb-1">Quyền hạn vai trò</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ROLES[role]?.desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!email}
                className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-slate-800 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                Gửi lời mời
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
