import React, { useState } from 'react';
import { Dropdown } from '../components/Dropdown';

/**
 * CustomFields.tsx - Quản lý Trường Tùy Chỉnh (Custom Fields).
 * Cho phép định nghĩa các trường dữ liệu bổ sung cho từng đối tượng
 * (BĐS / Khách hàng / Dự án / Hợp đồng) mà không cần đổi schema.
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

const SEED: CustomField[] = [
  { id: 'cf1', label: 'Mã căn nội bộ', key: 'internal_code', entity: 'listing', type: 'text', required: true },
  { id: 'cf2', label: 'Nguồn khách', key: 'lead_source', entity: 'lead', type: 'select', required: false },
  { id: 'cf3', label: 'Ngày bàn giao dự kiến', key: 'handover_date', entity: 'project', type: 'date', required: false },
];

const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };

export default function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>(SEED);
  const [label, setLabel] = useState('');
  const [entity, setEntity] = useState('listing');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);

  const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const add = () => {
    if (!label.trim()) return;
    setFields((prev) => [
      ...prev,
      { id: 'cf' + Date.now(), label: label.trim(), key: slug(label), entity, type, required },
    ]);
    setLabel('');
    setRequired(false);
  };
  const remove = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));

  const entityLabel = (v: string) => ENTITIES.find((e) => e.value === v)?.label || v;
  const typeLabel = (v: string) => FIELD_TYPES.find((t) => t.value === v)?.label || v;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Trường Tùy Chỉnh</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Định nghĩa các trường dữ liệu bổ sung cho BĐS, khách hàng, dự án và hợp đồng.
      </p>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Tên trường</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="VD: Mã căn nội bộ" style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Đối tượng</span>
            <Dropdown value={entity} onChange={(v) => setEntity(v as string)} options={ENTITIES} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Kiểu dữ liệu</span>
            <Dropdown value={type} onChange={(v) => setType(v as string)} options={FIELD_TYPES} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            <span>Bắt buộc</span>
          </label>
          <button onClick={add} style={{ padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Thêm</button>
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
            {fields.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Chưa có trường nào.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
