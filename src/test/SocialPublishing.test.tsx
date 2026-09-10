import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialPublishing } from '../../pages/SocialPublishing';
import { listingApi } from '../../services/api/listingApi';
import { socialPublicationApi } from '../../services/api/socialPublicationApi';

const eligibleListings = [
  { id: 'listing-available', code: 'SGS-001', title: 'Căn hộ sẵn sàng', status: 'AVAILABLE' },
  { id: 'listing-opening', code: 'SGS-002', title: 'Căn hộ đang mở bán', status: 'OPENING' },
  { id: 'listing-booking', code: 'SGS-003', title: 'Căn hộ đang giữ chỗ', status: 'BOOKING' },
  { id: 'listing-best-market', code: 'SGS-004', title: 'Căn hộ nổi bật', status: 'BEST_MARKET' },
];

function mockInitialRequests(listings: typeof eligibleListings = []) {
  const getListings = vi.spyOn(listingApi, 'getListings').mockResolvedValue({
    data: listings,
    total: listings.length,
    page: 1,
    pageSize: 100,
    totalPages: listings.length ? 1 : 0,
  });
  vi.spyOn(socialPublicationApi, 'getCatalog').mockResolvedValue({ data: [] });
  vi.spyOn(socialPublicationApi, 'getPublications').mockResolvedValue({ data: [], total: 0 });
  return getListings;
}

describe('SocialPublishing listing selector', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests all eligible listing statuses and shows returned listings in the dropdown', async () => {
    const getListings = mockInitialRequests(eligibleListings);
    const user = userEvent.setup();

    render(<SocialPublishing />);

    await waitFor(() => {
      expect(getListings).toHaveBeenCalledWith(1, 100, {
        statuses: 'AVAILABLE,OPENING,BOOKING,BEST_MARKET',
      });
    });

    await user.click(await screen.findByRole('combobox', { name: 'Chọn sản phẩm đủ điều kiện xuất bản' }));

    for (const listing of eligibleListings) {
      expect(screen.getByRole('option', {
        name: new RegExp(`${listing.code}.*${listing.title}`),
      })).toBeVisible();
    }
  });

  it('keeps the selector usable when the listing API returns no data', async () => {
    const getListings = mockInitialRequests();
    const user = userEvent.setup();

    render(<SocialPublishing />);

    expect(await screen.findByText(/Chưa có listing đủ điều kiện xuất bản\./)).toBeVisible();
    expect(getListings).toHaveBeenCalledWith(1, 100, {
      statuses: 'AVAILABLE,OPENING,BOOKING,BEST_MARKET',
    });

    await user.click(screen.getByRole('combobox', { name: 'Chọn sản phẩm đủ điều kiện xuất bản' }));

    expect(screen.getByText('Không tìm thấy listing phù hợp')).toBeVisible();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});