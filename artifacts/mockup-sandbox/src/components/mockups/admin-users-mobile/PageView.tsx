import { useState } from "react";

const SEARCH_ICON = (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const MENU_ICON = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const SEARCH_MOBILE_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const ADD_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const TRASH_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const SEND_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);
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

const USERS = [
  { id: "1", name: "Nguyễn Văn Admin", email: "admin@sgs.vn", role: "ADMIN", status: "ACTIVE", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin", isMe: true },
  { id: "2", name: "Trần Thị Lan", email: "lan.tran@sgs.vn", role: "SALES", status: "ACTIVE", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lan" },
  { id: "3", name: "Lê Minh Quân", email: "quan.le@sgs.vn", role: "TEAM_LEAD", status: "ACTIVE", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=quan" },
  { id: "4", name: "Phạm Hồng Nhung", email: "nhung.pham@sgs.vn", role: "MARKETING", status: "PENDING", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=nhung" },
  { id: "5", name: "Võ Thanh Bình", email: "binh.vo@sgs.vn", role: "SALES", status: "INACTIVE", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=binh" },
];

const ROLES: Record<string, string> = {
  ADMIN: "Quản Trị Viên",
  SALES: "Chuyên Viên KD",
  TEAM_LEAD: "Trưởng Nhóm",
  MARKETING: "Marketing",
  VIEWER: "Người Xem",
};

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "HĐ" },
    PENDING: { color: "bg-amber-50 text-amber-600 border-amber-100", label: "Chờ" },
    INACTIVE: { color: "bg-slate-100 text-slate-500 border-slate-200", label: "Khóa" },
  };
  const dot: Record<string, string> = {
    ACTIVE: "bg-emerald-500",
    PENDING: "bg-amber-500",
    INACTIVE: "bg-slate-400",
  };
  const c = cfg[status] || cfg.INACTIVE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase border ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />
      {c.label}
    </span>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SALES");

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full rounded-t-[28px] p-6 pb-8 shadow-2xl border border-slate-100 relative z-10 max-h-[92%] overflow-y-auto">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800">Mời thành viên mới</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">{CLOSE_ICON}</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="email@congty.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Vai trò</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
            >
              {Object.entries(ROLES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="mt-2 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex gap-2">
              <div className="shrink-0 mt-0.5">{INFO_ICON}</div>
              <div>
                <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide mb-1">Quyền hạn vai trò</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Quản lý khách hàng tiềm năng, tạo đề xuất và hợp đồng.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95">
              Gửi lời mời
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageView() {
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const filtered = USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const currentUser = USERS[0];
  const lastName = currentUser.name.split(' ').pop();

  return (
    <div className="flex flex-col bg-white" style={{ width: 390, height: 844, fontFamily: "Inter, sans-serif" }}>

      {/* ── COMMAND CENTER HEADER (fixed pattern) ── */}
      <div className="h-16 px-4 flex items-center justify-between relative shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <button className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl shrink-0">
            {MENU_ICON}
          </button>
          <h1 className="text-sm font-extrabold text-slate-800 tracking-tight leading-none truncate">
            Quản lý thành viên
          </h1>
        </div>

        {/* Right: search icon + user name + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl">
            {SEARCH_MOBILE_ICON}
          </button>
          <button className="flex items-center gap-2">
            <img
              src={currentUser.avatar}
              className="w-8 h-8 rounded-full border-2 border-white shadow-md object-cover"
              alt=""
            />
          </button>
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Tổng</span>
              <span className="text-xs font-black text-slate-800">5</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase">HĐ</span>
              <span className="text-xs font-black text-emerald-700">3</span>
            </div>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[9px] font-bold text-amber-600 uppercase">Chờ</span>
              <span className="text-xs font-black text-amber-700">1</span>
            </div>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="shrink-0 px-3 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-md hover:bg-slate-800 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 min-h-[36px]"
          >
            {ADD_ICON}
            <span>Mời</span>
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="relative flex-1">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none">{SEARCH_ICON}</div>
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 shadow-sm"
              placeholder="Tìm theo tên hoặc email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="w-28 shrink-0 border border-slate-200 rounded-xl px-2 py-2.5 text-xs bg-white text-slate-700 outline-none shadow-sm">
            <option>Tất cả vai trò</option>
          </select>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-100">
            <tr>
              <th className="p-4">Tên thành viên</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={user.avatar}
                      className="w-8 h-8 rounded-full object-cover bg-slate-200 border border-slate-100 shrink-0"
                      alt=""
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate max-w-[130px] text-xs">{user.name}</span>
                        {user.isMe && (
                          <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded shrink-0">Bạn</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{user.email}</div>
                      <div className="mt-0.5">
                        <span className="text-[8px] font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                          {ROLES[user.role]}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <StatusBadge status={user.status} />
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {user.status === "PENDING" && (
                      <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        {SEND_ICON}
                      </button>
                    )}
                    {!user.isMe && (
                      <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        {TRASH_ICON}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PAGINATION ── */}
      <div className="px-4 py-4 bg-white border-t border-slate-200 shadow-sm flex items-center justify-between gap-2 shrink-0">
        <button disabled className="flex-1 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold opacity-50 flex items-center justify-center">
          Trước
        </button>
        <span className="text-sm font-bold text-slate-800 px-2">1 / 1</span>
        <button disabled className="flex-1 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold opacity-50 flex items-center justify-center">
          Tiếp
        </button>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
