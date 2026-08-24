import React, { useEffect, useMemo, useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { auctionApi } from '../services/api/auctionApi';
import { listingApi } from '../services/api/listingApi';
import { socket, useSocket } from '../services/websocket';

type AuctionStatus = 'UPCOMING' | 'LIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';
interface AuctionItem {
  id: string; title: string; listingId: string; listingCode?: string;
  startPrice: number; stepPrice: number; currentBid: number; bidCount: number;
  status: AuctionStatus; startsAt: string; endsAt: string; winnerName?: string;
}

const STATUS_META: Record<AuctionStatus, { label: string; bg: string; color: string }> = {
  UPCOMING: { label: 'Sắp diễn ra', bg: '#eff6ff', color: '#1d4ed8' },
  LIVE: { label: 'Đang diễn ra', bg: '#ecfdf5', color: '#047857' },
  PAUSED: { label: 'Tạm dừng', bg: '#fffbeb', color: '#b45309' },
  ENDED: { label: 'Đã kết thúc', bg: '#f1f5f9', color: '#475569' },
  CANCELLED: { label: 'Đã hủy', bg: '#fef2f2', color: '#b91c1c' },
};
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };
const fmtVnd = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ' : n >= 1e6 ? (n / 1e6).toFixed(0) + ' triệu' : n.toLocaleString('vi-VN') + ' đ';
const dateInput = (d: Date) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); };
const displayDate = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export default function Auction() {
  const { isConnected } = useSocket();
  const [filter, setFilter] = useState('ALL');
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [selected, setSelected] = useState<AuctionItem | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [conversionMessage, setConversionMessage] = useState('');
  const [form, setForm] = useState({ listingId: '', title: '', startPrice: '', stepPrice: '', startsAt: dateInput(new Date()), endsAt: dateInput(new Date(Date.now() + 86400000)) });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [auctions, listingResult] = await Promise.all([
        auctionApi.list({ status: filter }),
        listingApi.getListings(1, 200),
      ]);
      setItems(auctions);
      setListings((listingResult as any).data || []);
      if (selected) setSelected(auctions.find((a: AuctionItem) => a.id === selected.id) || null);
    } catch (e: any) { setError(e?.message || 'Không thể tải dữ liệu đấu giá'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* selected is intentionally preserved across refresh */ }, [filter]);
  useEffect(() => { if (selected) auctionApi.bids(selected.id).then(setBids).catch(() => setBids([])); }, [selected?.id]);
  useEffect(() => {
    const applyUpdate = (event: any) => {
      if (!event?.auctionId) return;
      setItems(prev => prev.map(item => item.id === event.auctionId ? {
        ...item,
        ...(event.status ? { status: event.status } : {}),
        ...(event.currentBid !== undefined ? { currentBid: event.currentBid } : {}),
        ...(event.bidCount !== undefined ? { bidCount: event.bidCount } : {}),
        ...(event.winnerName !== undefined ? { winnerName: event.winnerName } : {}),
        ...(event.updatedAt !== undefined ? { updatedAt: event.updatedAt } : {}),
      } : item));
      setSelected(prev => prev && prev.id === event.auctionId ? {
        ...prev,
        ...(event.status ? { status: event.status } : {}),
        ...(event.currentBid !== undefined ? { currentBid: event.currentBid } : {}),
        ...(event.bidCount !== undefined ? { bidCount: event.bidCount } : {}),
        ...(event.winnerName !== undefined ? { winnerName: event.winnerName } : {}),
      } : prev);
      if (selected?.id === event.auctionId) {
        auctionApi.bids(event.auctionId).then(setBids).catch(() => undefined);
      }
    };
    const reconcile = async () => {
      try {
        const fresh = await auctionApi.list({ status: filter });
        setItems(fresh);
        setSelected(prev => prev ? fresh.find((item: AuctionItem) => item.id === prev.id) || null : null);
      } catch { /* the next reconnect or normal action will retry */ }
    };
    socket.on('auction:bid', applyUpdate);
    socket.on('auction:status', applyUpdate);
    socket.on('connect', reconcile);
    return () => {
      socket.off('auction:bid', applyUpdate);
      socket.off('auction:status', applyUpdate);
      socket.off('connect', reconcile);
    };
  }, [filter, selected?.id]);

  const liveCount = useMemo(() => items.filter(i => i.status === 'LIVE').length, [items]);
  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const created = await auctionApi.create({
        listingId: form.listingId, title: form.title, startPrice: Number(form.startPrice),
        stepPrice: Number(form.stepPrice), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
      });
      setItems(prev => [created, ...prev]); setShowCreate(false);
      setForm(f => ({ ...f, listingId: '', title: '', startPrice: '', stepPrice: '' }));
    } catch (e: any) { setError(e?.message || 'Không thể tạo phiên đấu giá'); }
    finally { setSaving(false); }
  };
  const changeStatus = async (status: string) => {
    if (!selected) return; setBusyAction(true); setError('');
    try { const updated = await auctionApi.updateStatus(selected.id, status); setSelected(updated); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)); }
    catch (e: any) { setError(e?.message || 'Không thể cập nhật trạng thái'); }
    finally { setBusyAction(false); }
  };
  const placeBid = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return; setBusyAction(true); setError('');
    try {
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const result = await auctionApi.placeBid(selected.id, Number(bidAmount), key);
      const updated = result.auction || selected;
      setSelected(updated); setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setBidAmount(''); setBids(await auctionApi.bids(selected.id));
    } catch (e: any) { setError(e?.message || 'Không thể ghi nhận lượt đặt giá'); }
    finally { setBusyAction(false); }
  };
  const convertWinner = async (target: 'booking' | 'contract') => {
    if (!selected) return;
    setBusyAction(true); setError(''); setConversionMessage('');
    try {
      const result = await auctionApi.convert(selected.id, target);
      setConversionMessage(result.created
        ? target === 'booking' ? 'Đã tạo booking nội bộ chờ xác nhận.' : 'Đã tạo hợp đồng ở trạng thái bản nháp.'
        : target === 'booking' ? 'Booking của phiên này đã tồn tại.' : 'Hợp đồng của phiên này đã tồn tại.');
    } catch (e: any) { setError(e?.message || 'Không thể chuyển quy trình'); }
    finally { setBusyAction(false); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Đấu Giá Bất Động Sản</h1><p style={{ color: '#64748b' }}>Dữ liệu phiên và lượt đặt giá được lưu trên hệ thống — {liveCount} phiên đang diễn ra. <span style={{ color: isConnected ? '#047857' : '#b45309' }}>{isConnected ? 'Đang cập nhật trực tiếp' : 'Đang chờ kết nối lại'}</span></p></div>
        <button type="button" onClick={() => setShowCreate(true)} style={{ background: '#047857', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700 }}>+ Tạo phiên</button>
      </div>
      {error && <div role="alert" style={{ ...card, marginBottom: 16, padding: '10px 14px', borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, maxWidth: 260 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}><span>Trạng thái</span><Dropdown value={filter} onChange={v => setFilter(v as string)} options={['ALL','UPCOMING','LIVE','PAUSED','ENDED','CANCELLED'].map(s => ({ value: s, label: s === 'ALL' ? 'Tất cả' : STATUS_META[s as AuctionStatus].label }))} variant="compact" /></label>
      </div>
      {loading ? <div style={{ ...card, textAlign: 'center', color: '#94a3b8' }}>Đang tải phiên đấu giá...</div> : items.length === 0 ? <div style={{ ...card, textAlign: 'center', color: '#94a3b8' }}>Chưa có phiên đấu giá nào.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {items.map(it => { const meta = STATUS_META[it.status]; return <button key={it.id} type="button" onClick={() => setSelected(it)} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: selected?.id === it.id ? '#047857' : '#e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{it.title}</div><span style={{ background: meta.bg, color: meta.color, padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{meta.label}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}><div><div style={{ color: '#94a3b8' }}>Giá hiện tại</div><div style={{ fontWeight: 700, color: '#047857' }}>{fmtVnd(Number(it.currentBid))}</div></div><div><div style={{ color: '#94a3b8' }}>Lượt đặt</div><div style={{ fontWeight: 600 }}>{it.bidCount}</div></div><div><div style={{ color: '#94a3b8' }}>Bắt đầu</div><div>{displayDate(it.startsAt)}</div></div><div><div style={{ color: '#94a3b8' }}>Kết thúc</div><div>{displayDate(it.endsAt)}</div></div></div>
          </button>; })}
        </div>
      )}
      {selected && <div style={{ ...card, marginTop: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ fontSize: 18, fontWeight: 700 }}>{selected.title}</h2><p style={{ color: '#64748b', fontSize: 13 }}>Mã sản phẩm: {selected.listingCode || selected.listingId}</p></div><button type="button" onClick={() => setSelected(null)} style={{ border: 0, background: 'transparent', color: '#64748b' }}>Đóng</button></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>{(['LIVE','PAUSED','ENDED','CANCELLED'] as const).map(s => <button key={s} type="button" disabled={busyAction || selected.status === s || selected.status === 'ENDED' || selected.status === 'CANCELLED'} onClick={() => changeStatus(s)} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', background: selected.status === s ? '#ecfdf5' : '#fff', color: '#334155' }}>{STATUS_META[s].label}</button>)}</div>
        {selected.status === 'ENDED' && <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginBottom: 14 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>Bước tiếp theo</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" disabled={busyAction} onClick={() => convertWinner('booking')} style={{ border: 0, borderRadius: 8, padding: '8px 12px', background: '#0f766e', color: '#fff', fontWeight: 600 }}>Tạo booking nội bộ</button><button type="button" disabled={busyAction} onClick={() => convertWinner('contract')} style={{ border: '1px solid #0f766e', borderRadius: 8, padding: '8px 12px', background: '#fff', color: '#0f766e', fontWeight: 600 }}>Tạo hợp đồng nháp</button></div>{conversionMessage && <p style={{ color: '#047857', fontSize: 13, marginTop: 8 }}>{conversionMessage}</p>}</div>}
        {selected.status === 'LIVE' && <form onSubmit={placeBid} style={{ display: 'flex', gap: 8, marginBottom: 14 }}><input required type="number" min={Number(selected.currentBid) + Number(selected.stepPrice)} step="1" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder={`Tối thiểu ${fmtVnd(Number(selected.currentBid) + Number(selected.stepPrice))}`} style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 10px' }} /><button disabled={busyAction} style={{ border: 0, borderRadius: 8, padding: '9px 14px', background: '#047857', color: '#fff', fontWeight: 700 }}>Đặt giá</button></form>}
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Lịch sử đặt giá ({bids.length})</h3>{bids.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Chưa có lượt đặt giá.</p> : <div>{bids.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', padding: '8px 0', fontSize: 13 }}><span>{b.bidderName || 'Người dùng'}</span><strong>{fmtVnd(Number(b.amount))}</strong></div>)}</div>}
      </div>}
      {showCreate && <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}><form onSubmit={submitCreate} style={{ ...card, width: 'min(520px, 100%)' }}><h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Tạo phiên đấu giá</h2><div style={{ display: 'grid', gap: 10 }}>
        <label>Sản phẩm<select required value={form.listingId} onChange={e => setForm({ ...form, listingId: e.target.value })} style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}><option value="">Chọn sản phẩm</option>{listings.map(l => <option key={l.id} value={l.id}>{l.code} — {l.title}</option>)}</select></label>
        <label>Tên phiên<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Mặc định dùng tên sản phẩm" style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>Giá khởi điểm<input required type="number" min="0" value={form.startPrice} onChange={e => setForm({ ...form, startPrice: e.target.value })} style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label><label>Bước giá<input required type="number" min="1" value={form.stepPrice} onChange={e => setForm({ ...form, stepPrice: e.target.value })} style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>Bắt đầu<input required type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label><label>Kết thúc<input required type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label></div>
      </div><div style={{ display: 'flex', justifyContent: 'end', gap: 8, marginTop: 16 }}><button type="button" onClick={() => setShowCreate(false)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '9px 12px' }}>Hủy</button><button disabled={saving} style={{ border: 0, background: '#047857', color: '#fff', borderRadius: 8, padding: '9px 12px', fontWeight: 700 }}>{saving ? 'Đang lưu...' : 'Tạo phiên'}</button></div></form></div>}
    </div>
  );
}