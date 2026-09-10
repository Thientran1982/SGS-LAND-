import React from 'react';
import { SelectDropdown, SelectOption } from '../task/SelectDropdown';
import { normalizeSocialImageUrl } from './SocialImage';

export interface SocialProjectOption {
  id: string;
  name?: string;
  code?: string;
  status?: string;
  location?: string;
  total_units?: number | null;
  totalUnits?: number | null;
  metadata?: Record<string, unknown>;
}

interface ProjectDropdownProps {
  projects: SocialProjectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function coverImage(project: SocialProjectOption): string | undefined {
  const metadata = project.metadata || {};
  const value = metadata.coverImage ?? metadata.cover_image;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function ProjectDropdown({ projects, value, onChange, disabled = false }: ProjectDropdownProps) {
  const options: SelectOption[] = projects.map(project => {
    const units = project.total_units ?? project.totalUnits;
    const details = [
      project.status === 'ACTIVE' ? 'Đang mở bán' : project.status,
      project.location,
      units ? `${units.toLocaleString('vi-VN')} sản phẩm` : null,
    ].filter(Boolean).join(' · ');
    return {
      value: String(project.id),
      imageUrl: normalizeSocialImageUrl(coverImage(project)) || undefined,
      label: `${project.code ? `${project.code} — ` : ''}${project.name || String(project.id)}${details ? ` · ${details}` : ''}`,
    };
  });

  return (
    <SelectDropdown
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      ariaLabel="Chọn dự án đủ điều kiện xuất bản"
      placeholder="Chọn dự án đủ điều kiện xuất bản"
      height={48}
      surface="primary"
      searchable
      searchPlaceholder="Tìm theo mã, tên hoặc vị trí dự án..."
      emptyMessage="Không tìm thấy dự án phù hợp"
    />
  );
}

export default ProjectDropdown;