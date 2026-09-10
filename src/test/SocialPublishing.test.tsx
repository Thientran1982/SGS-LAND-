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
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

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

  it('selects the listing requested by the URL after eligible listings finish loading', async () => {
    const requestedListing = eligibleListings[2];
    const getListings = mockInitialRequests(eligibleListings);
    window.history.pushState({}, '', `/?listingId=${requestedListing.id}`);

    render(<SocialPublishing />);

    const selector = await screen.findByRole('combobox', {
      name: 'Chọn sản phẩm đủ điều kiện xuất bản',
    });
    await waitFor(() => {
      expect(getListings).toHaveBeenCalledWith(1, 100, {
        statuses: 'AVAILABLE,OPENING,BOOKING,BEST_MARKET',
      });
      expect(selector).toHaveTextContent(requestedListing.code);
      expect(selector).toHaveTextContent(requestedListing.title);
    });
    expect(screen.getByText(requestedListing.title)).toBeVisible();
  });

  it('does not select a different listing when the URL listing is not in the results', async () => {
    mockInitialRequests(eligibleListings);
    window.history.pushState({}, '', '/?listingId=listing-missing');

    render(<SocialPublishing />);

    const selector = await screen.findByRole('combobox', {
      name: 'Chọn sản phẩm đủ điều kiện xuất bản',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'listingId “listing-missing”, nhưng listing này không còn trong danh sách đủ điều kiện xuất bản',
    );
    await waitFor(() => {
      expect(selector).toHaveTextContent('Chọn listing đủ điều kiện xuất bản');
    });
    expect(screen.queryByText('Căn hộ sẵn sàng')).not.toBeInTheDocument();
    expect(screen.queryByText('Căn hộ đang mở bán')).not.toBeInTheDocument();
    expect(screen.queryByText('Căn hộ đang giữ chỗ')).not.toBeInTheDocument();
    expect(screen.queryByText('Căn hộ nổi bật')).not.toBeInTheDocument();
  });

  it('does not show a stale-link warning when the URL has no listingId', async () => {
    mockInitialRequests(eligibleListings);

    render(<SocialPublishing />);

    await screen.findByRole('combobox', {
      name: 'Chọn sản phẩm đủ điều kiện xuất bản',
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows tenant-scoped stale publication links and opens the related publication', async () => {
    const staleUrl = 'https://sgsland.example/p/SGS-OLD';
    const stalePublication = {
      id: 'publication-stale',
      listingId: 'listing-sold',
      status: 'PUBLISHED',
      publishMode: 'NOW' as const,
      scheduledAt: null,
      contentSnapshot: { title: 'Căn hộ đã bán', publicUrl: staleUrl },
      assetSnapshot: [],
      createdAt: '2026-09-10T00:00:00.000Z',
      targets: [{
        id: 'target-stale',
        platform: 'FACEBOOK_PAGE',
        status: 'PUBLISHED',
        providerPostUrl: 'https://facebook.example/old-post',
      }],
      listingReview: {
        eligible: false,
        listingExists: true,
        listingStatus: 'SOLD',
        listingCode: 'SGS-OLD',
        listingTitle: 'Căn hộ đã bán',
        reason: 'LISTING_STATUS_NOT_ELIGIBLE' as const,
      },
    };
    vi.spyOn(listingApi, 'getListings').mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });
    vi.spyOn(socialPublicationApi, 'getCatalog').mockResolvedValue({ data: [] });
    const getPublications = vi.spyOn(socialPublicationApi, 'getPublications')
      .mockImplementation(async options => typeof options !== 'string' && options?.staleOnly
        ? { data: [stalePublication], total: 1, page: 1, pageSize: 25, totalPages: 1, hasNext: false }
        : { data: [], total: 0 });
    vi.spyOn(socialPublicationApi, 'getPublication').mockResolvedValue(stalePublication);

    const user = userEvent.setup();
    render(<SocialPublishing />);

    expect(await screen.findByText('Căn hộ đã bán')).toBeVisible();
    expect(screen.getByText('Listing hiện ở trạng thái SOLD, không còn đủ điều kiện xuất bản công khai.')).toBeVisible();
    expect(screen.getByRole('link', { name: staleUrl })).toHaveAttribute('href', staleUrl);
    expect(screen.getByText(/Link provider đang lưu:/)).toBeVisible();
    expect(getPublications).toHaveBeenCalledWith({
      staleOnly: true,
      page: 1,
      pageSize: 25,
    });

    await user.click(screen.getByRole('button', { name: 'Mở publication' }));
    await waitFor(() => {
      expect(socialPublicationApi.getPublication).toHaveBeenCalledWith('publication-stale');
      expect(screen.getByRole('button', { name: 'Ẩn publication' })).toBeVisible();
    });
  });

  it('loads the next stale-only page without losing the total count', async () => {
    const firstPublication = {
      id: 'publication-stale-first',
      listingId: 'listing-sold-first',
      status: 'PUBLISHED',
      publishMode: 'NOW' as const,
      scheduledAt: null,
      contentSnapshot: { title: 'Căn hộ stale đầu tiên' },
      assetSnapshot: [],
      createdAt: '2026-09-10T00:00:00.000Z',
      targets: [],
      listingReview: {
        eligible: false,
        listingExists: false,
        listingStatus: null,
        reason: 'LISTING_NOT_FOUND' as const,
      },
    };
    const secondPublication = {
      ...firstPublication,
      id: 'publication-stale-second',
      listingId: 'listing-sold-second',
      contentSnapshot: { title: 'Căn hộ stale trang kế tiếp' },
    };
    vi.spyOn(listingApi, 'getListings').mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });
    vi.spyOn(socialPublicationApi, 'getCatalog').mockResolvedValue({ data: [] });
    const getPublications = vi.spyOn(socialPublicationApi, 'getPublications')
      .mockImplementation(async options => {
        if (typeof options !== 'string' && options?.staleOnly) {
          return options.page === 2
            ? { data: [secondPublication], total: 26, page: 2, pageSize: 25, totalPages: 2, hasNext: false }
            : { data: [firstPublication], total: 26, page: 1, pageSize: 25, totalPages: 2, hasNext: true };
        }
        return { data: [], total: 0 };
      });

    const user = userEvent.setup();
    render(<SocialPublishing />);

    expect(await screen.findByText('Căn hộ stale đầu tiên')).toBeVisible();
    expect(screen.getByText('Đang xem 1 / 26 liên kết cần rà soát')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tải thêm liên kết cũ' }));

    expect(await screen.findByText('Căn hộ stale trang kế tiếp')).toBeVisible();
    expect(screen.getByText('Đang xem 2 / 26 liên kết cần rà soát')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tải thêm liên kết cũ' })).not.toBeInTheDocument();
    expect(getPublications).toHaveBeenCalledWith({
      staleOnly: true,
      page: 2,
      pageSize: 25,
    });
  });
});
