import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Dropdown } from '../components/Dropdown';
import dbApi from '../services/dbApi';

/**
 * UnitInventory.tsx - Tồn kho cấp Căn (Tower / Block / Floor / Unit).
 * Dữ liệu lưu vào bảng units (Postgres) qua /api/units.
 * Nếu bảng rỗng, admin có thể bấm "Tạo dữ liệu mẫu" để seed nhanh.
 */

type UnitStatus = 'available' | 'reserved' | 'sold';

interface Unit {
  id?: string;
  code: string;
  tower: string;
  floor: number;
  bedroom: string;
  areaSqm: number;
  priceSqm: number;
  status: UnitStatus;
}

const STATUS_META: Record<UnitStatus, { label: string; bg: string; color: string }> = {
  available: { label: 'Còn trống', bg: '#ecfdf5', color: '#047857' },
  reserved: { label: 'Đã giữ chỗ', bg: '#fffbeb', color: '#b45309' },
  sold: { label: 'Đã bán', bg: '#f1f5f9', color: '#475569' },
};

const TOWERS = ['A1', 'A2', 'B1'];
const BEDROOMS = ['1PN', '2PN', '3PN'];

// Sinh dữ liệu tồn kho mẫu từ ma trận giá cơ sở theo tower + tầng (dùng để seed).
function buildSeedUnits(): Omit<Unit, 'id'>[] {
  const basePriceByTower: Record<string, number> = { A1: 62, A2: 60, B1: 58 };
  const areaByBedroom: Record<string, number> = { '1PN': 45, '2PN': 68, '3PN': 92 };
  const out: Omit<Unit, 'id'>[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  TOWERS.forEach((tower) => {
    for (let floor = 5; floor <= 12; floor++) {
      BEDROOMS.forEach((bedroom, bi) => {
        const r = rnd();
        const status: UnitStatus = r < 0.5 ? 'available' : r < 0.72 ? 'reserved' : 'sold';
        const floorAdj = (floor - 5) * 0.4;
        const priceSqm = Math.round((basePriceByTower[tower] + floorAdj + bi) * 10) / 10;
        out.push({
          code: `${tower}-${String(floor).padStart(2, '0')}${String(bi + 1).padStart(2, '0')}`,
          tower, floor, bedroom, areaSqm: areaByBedroom[bedroom], priceSqm, status,
        });
      });
    }
  });
  return out;
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };

export default function UnitInventory() {
  const [tower, setTower] = useState('all');
  const [status, setStatus] = useState('all');
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');

  const mapRow = (r: any): Unit => ({
    id: r.id,
    code: r.code,
    tower: r.tower,
    floor: Number(r.floor),
    bedroom: r.bedroom,
    areaSqm: Number(r.areaSqm ?? r.area_sqm),
    priceSqm: Number(r.priceSqm ?? r.price_sqm),
    status: (r.status as UnitStatus) || 'available',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await dbApi.getUnits();
      setAllUnits((rows as any[]).map(mapRow));
    } catch (e: any) {
      setError(e?.message || 'Không tải được tồn kho');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const seedSample = async () => {
    if (seeding) return;
    setSeeding(true);
    setError('');
    try {
      for (const u of buildSeedUnits()) {
        await dbApi.createUnit(u);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Không tạo được dữ liệu mẫu');
    } finally {
      setSeeding(false);
    }
  };

  const towerOptions = [{ value: 'all', label: 'Tất cả tower' }, ...TOWERS.map((t) => ({ value: t, label: 'Tower ' + t }))];
  const statusOptions = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'available', label: 'Còn trống' },
    { value: 'reserved', label: 'Đã giữ chỗ' },
    { value: 'sold', label: 'Đã bán' },
  ];

  const units = useMemo(
    () => allUnits.filter((u) => (tower === 'all' || u.tower === tower) && (status === 'all' || u.status === status)),
    [allUnits, tower, status],
  );

  const summary = useMemo(() => {
    const src = allUnits.filter((u) => tower === 'all' || u.tower === tower);
    return {
      total: src.length,
      available: src.filter((u) => u.status === 'available').length,
      reserved: src.filter((u) => u.status === 'reserved').length,
      sold: src.filter((u) => u.status === 'sold').length,
    };
  }, [allUnits, tower]);

  const byFloor = useMemo(() => {
    const m = new Map<number, Unit[]>();
    units.forEach((u) => { if (!m.has(u.floor)) m.set(u.floor, []); m.get(u.floor)!.push(u); });
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [units]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Tồn Kho Cấp Căn</h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Trạng thái từng căn theo Tower · Tầng · Loại căn.</p>

      {error && (
        <div style={{ ...card, marginBottom: 16, borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c', padding: '10px 16px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {(([['Tổng căn', summary.total, '#0f172a'], ['Còn trống', summary.available, '#047857'], ['Giữ chỗ', summary.reserved, '#b45309'], ['Đã bán', summary.sold, '#475569']]) as [string, number, string][]).map(([lbl, val, col]) => (
          <div key={lbl} style={{ ...card, padding: 14 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{lbl}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: col }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, maxWidth: 460, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span>Tower</span>
           <Dropdown value={tower} onChange={(v) => setTower(v as string)} options={towerOptions} variant="compact" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span>Trạng thái</span>
           <Dropdown value={status} onChange={(v) => setStatus(v as string)} options={statusOptions} variant="compact" />
        </label>
      </div>

      <div style={card}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>Đang tải...</div>
        )}
        {!loading && allUnits.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
            <div style={{ marginBottom: 12 }}>Chưa có dữ liệu tồn kho.</div>
            <button onClick={seedSample} disabled={seeding} style={{ padding: '9px 16px', background: '#1B3A5C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.6 : 1 }}>{seeding ? 'Đang tạo...' : 'Tạo dữ liệu mẫu'}</button>
          </div>
        )}
        {byFloor.map(([floor, us]) => (
          <div key={floor} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 8 }}>Tầng {floor}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {us.map((u) => {
                const meta = STATUS_META[u.status];
                return (
                  <div key={u.code} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: meta.bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{u.code}</span>
                      <span style={{ color: meta.color, fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{u.bedroom} · {u.areaSqm}m²</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{u.priceSqm} triệu/m²</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!loading && allUnits.length > 0 && byFloor.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>Không có căn nào khớp bộ lọc.</div>}
      </div>
    </div>
  );
}
