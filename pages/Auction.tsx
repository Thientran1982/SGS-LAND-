import React, { useMemo, useState } from 'react';
import { Dropdown } from '../components/Dropdown';

/**
 * Auction.tsx - Module Đấu Giá Bất Động Sản.
 * Quản lý các phiên đấu giá: giá khởi điểm, bước giá, giá hiện tại, trạng thái.
 */

type AuctionStatus = 'upcoming' | 'live' | 'ended';

interface AuctionItem {
  id: string;
  title: string;
  startPrice: number;
  stepPrice: number;
  currentBid: number;
  bids: number;
  status: AuctionStatus;
  endsAt: string;
}

const STATUS_META: Record<AuctionStatus, { label: string; bg: string; color: string }> = {
  upcoming: { label: 'Sắp diễn ra', bg: '#eff6ff', color: '#1d4ed8' },
  live: { label: 'Đang diễn ra', bg: '#ecfdf5', color: '#047857' },
  ended: { label: 'Đã kết thúc', bg: '#f1f5f9', color: '#475569' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'upcoming', label: 'Sắp diễn ra' },
  { value: 'live', label: 'Đang diễn ra' },
  { value: 'ended', label: 'Đã kết thúc' },
];

const SEED: AuctionItem[] = [
  { id: 'a1', title: 'Aqua City - Biệt thự River Park 1', startPrice: 8500000000, stepPrice: 50000000, currentBid: 8950000000, bids: 12, status: 'live', endsAt: '2026-07-10 15:00' },
  { id: 'a2', title: 'Izumi City - Nhà phố Sakura', startPrice: 6200000000, stepPrice: 30000000, currentBid: 6200000000, bids: 0, status: 'upcoming', endsAt: '2026-07-14 09:00' },
  { id: 'a3', title: 'The Global City - Shophouse SOHO', startPrice: 12000000000, stepPrice: 100000000, currentBid: 13400000000, bids: 21, status: 'ended', endsAt: '2026-06-28 17:00' },
];

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };

const fmtVnd = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' triệu';
  return n.toLocaleString('vi-VN') + ' đ';
};

export default function Auction() {
  const [filter, setFilter] = useState('all');
  const [items] = useState<AuctionItem[]>(SEED);

  const rows = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );

  const liveCount = items.filter((i) => i.status === 'live').length;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Đấu Giá Bất Động Sản</h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>
        Quản lý các phiên đấu giá BĐS — hiện có {liveCount} phiên đang diễn ra.
      </p>

      <div style={{ display: 'flex', alignItems: 'end', gap: 12, marginBottom: 16, maxWidth: 260 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span>Trạng thái</span>
          <Dropdown value={filter} onChange={(v) => setFilter(v as string)} options={STATUS_OPTIONS} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {rows.map((it) => {
          const meta = STATUS_META[it.status];
          const up = it.currentBid - it.startPrice;
          return (
            <div key={it.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{it.title}</div>
                <span style={{ background: meta.bg, color: meta.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{meta.label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div><div style={{ color: '#94a3b8' }}>Giá khởi điểm</div><div style={{ fontWeight: 600 }}>{fmtVnd(it.startPrice)}</div></div>
                <div><div style={{ color: '#94a3b8' }}>Bước giá</div><div style={{ fontWeight: 600 }}>{fmtVnd(it.stepPrice)}</div></div>
                <div><div style={{ color: '#94a3b8' }}>Giá hiện tại</div><div style={{ fontWeight: 700, color: '#047857' }}>{fmtVnd(it.currentBid)}</div></div>
                <div><div style={{ color: '#94a3b8' }}>Lượt đặt</div><div style={{ fontWeight: 600 }}>{it.bids}</div></div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                <span>{up > 0 ? '+' + fmtVnd(up) + ' so với khởi điểm' : 'Chưa có lượt đặt'}</span>
                <span>Kết thúc: {it.endsAt}</span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ ...card, gridColumn: '1 / -1', textAlign: 'center', color: '#94a3b8' }}>Không có phiên đấu giá nào.</div>
        )}
      </div>
    </div>
  );
}
