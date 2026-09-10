import React from 'react';
import { SelectDropdown, SelectOption } from '../task/SelectDropdown';

export interface SocialListingOption {
  id: string;
  code?: string;
  title?: string;
  status?: string;
  images?: string[];
}

interface ListingDropdownProps {
  listings: SocialListingOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ListingDropdown({ listings, value, onChange, disabled = false }: ListingDropdownProps) {
  const statusLabel: Record<string, string> = {
    AVAILABLE: 'Sẵn sàng',
    OPENING: 'Đang mở bán',
    BOOKING: 'Đang giữ chỗ',
    BEST_MARKET: 'Nổi bật',
  };
  const options: SelectOption[] = listings.map(listing => ({
    value: String(listing.id),
    imageUrl: listing.images?.[0],
    label: listing.code
      ? `${listing.code} — ${listing.title || 'Sản phẩm chưa có tên'} · ${statusLabel[listing.status || ''] || listing.status || 'Sẵn sàng'}`
      : `${listing.title || String(listing.id)} · ${statusLabel[listing.status || ''] || listing.status || 'Sẵn sàng'}`,
  }));

  return (
    <SelectDropdown
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      ariaLabel="Chọn sản phẩm đủ điều kiện xuất bản"
      placeholder="Chọn listing đủ điều kiện xuất bản"
      height={48}
      surface="primary"
      searchable
      searchPlaceholder="Tìm theo mã hoặc tên listing..."
      emptyMessage="Không tìm thấy listing phù hợp"
    />
  );
}

export default ListingDropdown;