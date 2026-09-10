import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialPublishing } from '../../pages/SocialPublishing';
import { listingApi } from '../../services/api/listingApi';
import { socialPublicationApi } from '../../services/api/socialPublicationApi';
import { db } from '../../services/dbApi';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('SocialPublishing listing selector', () => {
  beforeEach(() => {
    vi.spyOn(db, 'getProjects').mockResolvedValue({ data: [] });
  });

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
        publicationEligible: 'true',
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
      publicationEligible: 'true',
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
        publicationEligible: 'true',
      });
      expect(selector).toHaveTextContent(requestedListing.code);
      expect(selector).toHaveTextContent(requestedListing.title);
    });
    expect(screen.getByText(requestedListing.title)).toBeVisible();
  });

  it('enables listing draft controls while optional project and report requests are slow', async () => {
    mockInitialRequests(eligibleListings);
    const projects = deferred<{ data: [] }>();
    const publications = deferred<{ data: []; total: number }>();
    const staleReport = deferred<{ data: []; total: number }>();
    vi.mocked(db.getProjects).mockReturnValue(projects.promise);
    vi.mocked(socialPublicationApi.getPublications).mockImplementation(async options => {
      if (typeof options !== 'string' && options?.staleOnly) return staleReport.promise;
      return publications.promise;
    });

    render(<SocialPublishing />);

    expect(await screen.findByRole('combobox', {
      name: 'Chọn sản phẩm đủ điều kiện xuất bản',
    })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Xem preview' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Lưu draft' })).toBeEnabled();
    expect(screen.getByText('Đang tải báo cáo…')).toBeVisible();

    projects.resolve({ data: [] });
    publications.resolve({ data: [], total: 0 });
    staleReport.resolve({ data: [], total: 0 });
    await waitFor(() => {
      expect(screen.queryByText('Đang tải báo cáo…')).not.toBeInTheDocument();
    });
  });

  it('shows scoped warnings when optional project and report requests fail', async () => {
    mockInitialRequests(eligibleListings);
    vi.mocked(db.getProjects).mockRejectedValue(new Error('project service unavailable'));
    vi.mocked(socialPublicationApi.getPublications).mockImplementation(async options => {
      if (typeof options !== 'string' && options?.staleOnly) {
        throw new Error('stale report unavailable');
      }
      throw new Error('publication history unavailable');
    });

    render(<SocialPublishing />);

    expect(await screen.findByRole('combobox', {
      name: 'Chọn sản phẩm đủ điều kiện xuất bản',
    })).toBeEnabled();
    expect(await screen.findByText(/Không tải được dữ liệu dự án/)).toBeVisible();
    expect(screen.getByText(/Không tải được báo cáo publication stale/)).toBeVisible();
    expect(screen.getByText(/Không tải được lịch sử publication/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xem preview' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Lưu draft' })).toBeEnabled();
    expect(screen.queryByText('Không phát hiện liên kết publication nào cần rà soát trong tenant này.')).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có publication thủ công nào.')).not.toBeInTheDocument();
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

  it('keeps stale review complete when publications change between page loads', async () => {
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
    const boundaryPublication = {
      ...firstPublication,
      id: 'publication-stale-boundary',
      listingId: 'listing-sold-second',
      contentSnapshot: { title: 'Căn hộ stale ở ranh giới' },
    };
    const olderPublication = {
      ...firstPublication,
      id: 'publication-stale-older',
      listingId: 'listing-sold-older',
      contentSnapshot: { title: 'Căn hộ stale cũ hơn' },
    };
    const oldestPublication = {
      ...firstPublication,
      id: 'publication-stale-oldest',
      listingId: 'listing-sold-oldest',
      contentSnapshot: { title: 'Căn hộ stale cũ nhất' },
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
          return options.cursor
            ? {
              data: [olderPublication, oldestPublication],
              total: 4,
              page: 2,
              pageSize: 2,
              totalPages: 2,
              hasNext: false,
              nextCursor: null,
            }
            : {
              data: [firstPublication, boundaryPublication],
              total: 4,
              page: 1,
              pageSize: 2,
              totalPages: 2,
              hasNext: true,
              nextCursor: 'cursor-after-boundary',
            };
        }
        return { data: [], total: 0 };
      });

    const user = userEvent.setup();
    render(<SocialPublishing />);

    expect(await screen.findByText('Căn hộ stale đầu tiên')).toBeVisible();
    expect(screen.getByText('Căn hộ stale ở ranh giới')).toBeVisible();
    expect(screen.getByText('Đang xem 2 / 4 liên kết cần rà soát')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tải thêm liên kết cũ' }));

    expect(await screen.findByText('Căn hộ stale cũ hơn')).toBeVisible();
    expect(screen.getByText('Căn hộ stale cũ nhất')).toBeVisible();
    expect(screen.getByText('Đang xem 4 / 4 liên kết cần rà soát')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tải thêm liên kết cũ' })).not.toBeInTheDocument();
    expect(getPublications).toHaveBeenCalledWith({
      staleOnly: true,
      page: 2,
      pageSize: 25,
      cursor: 'cursor-after-boundary',
    });
  });

  it('tells the operator to reload when new stale publications appear and keeps the review rows', async () => {
    const firstPublication = {
      id: 'publication-stale-first',
      listingId: 'listing-sold-first',
      status: 'PUBLISHED',
      publishMode: 'NOW' as const,
      scheduledAt: null,
      contentSnapshot: { title: 'Căn hộ stale đang rà soát' },
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
    const olderPublication = {
      ...firstPublication,
      id: 'publication-stale-older',
      listingId: 'listing-sold-older',
      contentSnapshot: { title: 'Căn hộ stale cũ hơn' },
      createdAt: '2026-09-09T00:00:00.000Z',
    };
    const newerPublication = {
      ...firstPublication,
      id: 'publication-stale-newer',
      listingId: 'listing-sold-newer',
      contentSnapshot: { title: 'Căn hộ stale mới' },
      createdAt: '2026-09-11T00:00:00.000Z',
    };
    vi.spyOn(listingApi, 'getListings').mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });
    vi.spyOn(socialPublicationApi, 'getCatalog').mockResolvedValue({ data: [] });
    let staleRequestCount = 0;
    const getPublications = vi.spyOn(socialPublicationApi, 'getPublications')
      .mockImplementation(async options => {
        if (typeof options !== 'string' && options?.staleOnly) {
          staleRequestCount += 1;
          if (staleRequestCount === 1) {
            return {
              data: [firstPublication],
              total: 2,
              page: 1,
              pageSize: 1,
              totalPages: 2,
              hasNext: true,
              nextCursor: 'cursor-after-first',
            };
          }
          if (staleRequestCount === 2) {
            return {
              data: [olderPublication],
              total: 3,
              page: 2,
              pageSize: 1,
              totalPages: 3,
              hasNext: true,
              nextCursor: 'cursor-after-older',
            };
          }
          return {
            data: [newerPublication, firstPublication],
            total: 3,
            page: 1,
            pageSize: 25,
            totalPages: 1,
            hasNext: false,
            nextCursor: null,
          };
        }
        return { data: [], total: 0 };
      });

    const user = userEvent.setup();
    render(<SocialPublishing />);

    expect(await screen.findByText('Căn hộ stale đang rà soát')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tải thêm liên kết cũ' }));

    expect(await screen.findByText('Căn hộ stale cũ hơn')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Có publication stale mới');
    expect(screen.getByRole('button', { name: 'Tải lại báo cáo stale' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tải lại báo cáo stale' }));

    expect(await screen.findByText('Căn hộ stale mới')).toBeVisible();
    expect(screen.getByText('Căn hộ stale đang rà soát')).toBeVisible();
    expect(screen.getByText('Căn hộ stale cũ hơn')).toBeVisible();
    expect(screen.getByText(/Các publication đã hiển thị vẫn được giữ nguyên/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tải lại báo cáo stale' })).not.toBeInTheDocument();
    expect(getPublications).toHaveBeenLastCalledWith({
      staleOnly: true,
      page: 1,
      pageSize: 25,
    });
  });
});
