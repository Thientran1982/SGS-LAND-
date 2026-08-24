import React, { useState, useEffect, useCallback } from 'react';
import { Dropdown } from '../components/Dropdown';
import dbApi from '../services/dbApi';

/**
 * CustomFields.tsx – Quản lý Trường Tùy Chỉnh (Custom Fields).
 * Dữ liệu lưu vào bảng custom_fields (Postgres) qua /api/custom-fields.
 */

interface CustomField {
  id: string;
  label: string;
  key: string;
  entity: string;
  type: string;
  required: boolean;
}

const ENTITIES = [
  { value: 'listing', label: 'Bất động sản' },
  { value: 'lead', label: 'Khách hàng' },
  { value: 'project', label: 'Dự án' },
  { value: 'contract', label: 'Hợp đồng' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Văn bản' },
  { value: 'number', label: 'Số' },
  { value: 'date', label: 'Ngày' },
  { value: 'select', label: 'Danh sách chọn' },
  { value: 'boolean', label: 'Có / Không' },
];

const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };

export default function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [label, setLabel] = useState('');
  const [entity, setEntity] = useState('listing');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mapRow = (r: any): CustomField => ({
    id: r.id,
    label: r.label,
    key: r.fieldKey ?? r.field_key ?? '',
    entity: r.entity,
    type: r.fieldType ?? r.field_type ?? 'text',
    required: !!r.required,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await dbApi.getCustomFields();
      setFields((rows as any[]).map(mapRow));
    } catch (e: any) {
      setError(e?.message || 'Không tải được danh sách trường');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!label.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const row = await dbApi.createCustomField({ label: label.trim(), entity, fieldType: type, required });
      setFields((prev) => [...prev, mapRow(row)]);
      setLabel('');
      setRequired(false);
    } catch (e: any) {
      setError(e?.message || 'Không thêm được trường');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const prev = fields;
    setFields((f) => f.filter((x) => x.id !== id));
    try {
      await dbApi.deleteCustomField(id);
    } catch (e: any) {
      setError(e?.message || 'Không xóa được trường');
      setFields(prev);
    }
  };

  const entityLabel = (v: string) => ENTITIES.find((e) => e.value === v)?.label || v;
  const typeLabel = (v: string) => FIELD_TYPES.find((t) => t.value === v)?.label || v;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Trường Tùy Chỉnh</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Định nghĩa các trường dữ liệu bổ sung cho BĐS, khách hàng, dự án và hợp đồng.
      </p>

      {error && (
        <div style={{ ...card, marginBottom: 16, borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c', padding: '10px 16px' }}>
          {error}
        </div>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Tên trường</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="VD: Mã căn nội bộ" style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Đối tượng</span>
             <Dropdown value={entity} onChange={(v) => setEntity(v as string)} options={ENTITIES} variant="compact" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Kiểu dữ liệu</span>
             <Dropdown value={type} onChange={(v) => setType(v as string)} options={FIELD_TYPES} variant="compact" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            <span>Bắt buộc</span>
          </label>
          <button onClick={add} disabled={saving} style={{ padding: '9px 16px', background: '#1B3A5C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Đang lưu...' : 'Thêm'}</button>
        </div>
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 6px' }}>Tên trường</th>
              <th style={{ padding: '8px 6px' }}>Khóa</th>
              <th style={{ padding: '8px 6px' }}>Đối tượng</th>
              <th style={{ padding: '8px 6px' }}>Kiểu</th>
              <th style={{ padding: '8px 6px' }}>Bắt buộc</th>
              <th style={{ padding: '8px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{f.label}</td>
                <td style={{ padding: '8px 6px', color: '#64748b', fontFamily: 'monospace' }}>{f.key}</td>
                <td style={{ padding: '8px 6px' }}>{entityLabel(f.entity)}</td>
                <td style={{ padding: '8px 6px' }}>{typeLabel(f.type)}</td>
                <td style={{ padding: '8px 6px' }}>{f.required ? 'Có' : 'Không'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  <button onClick={() => remove(f.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Xóa</button>
                </td>
              </tr>
            ))}
            {!loading && fields.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Chưa có trường nào.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Đang tải...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
