// Auction: server rule fixes + redesigned page + helpers/tests + locale keys.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const report = [];
function patch(file, steps) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [name, fn] of steps) {
    const n = fn(s);
    if (n === null || n === s) { report.push(`FAIL ${file}: ${name}`); return; }
    s = n;
  }
  if (!DRY) fs.writeFileSync(file, s);
  report.push(`OK   ${file} (${steps.length} steps)`);
}
const lit = (a, b) => (s) => (s.includes(a) ? s.replace(a, () => b) : null);

patch('server/repositories/auctionRepository.ts', [
  // One active session per listing.
  ['create: one active session per listing', lit(`      if (!listing.rows[0]) throw new Error('LISTING_NOT_FOUND');
`, `      if (!listing.rows[0]) throw new Error('LISTING_NOT_FOUND');
      const active = await client.query(
        \`SELECT 1 FROM auction_sessions WHERE tenant_id = $1 AND listing_id = $2 AND status IN ('UPCOMING','LIVE','PAUSED') AND ends_at > NOW() LIMIT 1\`,
        [tenantId, data.listingId],
      );
      if (active.rows[0]) throw new Error('ACTIVE_AUCTION_EXISTS');
`)],
  // Explicit transitions; "start now" moves starts_at so bids are accepted immediately.
  ['updateStatus transitions', lit(`      const allowed = ['LIVE', 'PAUSED', 'ENDED', 'CANCELLED'];
      if (!allowed.includes(status)) throw new Error('INVALID_STATUS');
      const result = await client.query(\`
        UPDATE auction_sessions a
        SET status = $1,
            updated_at = NOW(),`, `      const allowed = ['LIVE', 'PAUSED', 'ENDED', 'CANCELLED'];
      if (!allowed.includes(status)) throw new Error('INVALID_STATUS');
      const TRANSITIONS: Record<string, string[]> = {
        UPCOMING: ['LIVE', 'CANCELLED'],
        LIVE: ['PAUSED', 'ENDED', 'CANCELLED'],
        PAUSED: ['LIVE', 'ENDED', 'CANCELLED'],
      };
      const current = await client.query('SELECT status, ends_at FROM auction_sessions WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      const row = current.rows[0];
      if (!row) throw new Error('AUCTION_NOT_FOUND_OR_TERMINAL');
      if (!(TRANSITIONS[row.status] || []).includes(status)) throw new Error('INVALID_TRANSITION');
      if (status === 'LIVE' && new Date(row.ends_at).getTime() <= Date.now()) throw new Error('AUCTION_WINDOW_OVER');
      const result = await client.query(\`
        UPDATE auction_sessions a
        SET status = $1,
            updated_at = NOW(),
            starts_at = CASE WHEN $1 = 'LIVE' AND starts_at > NOW() THEN NOW() ELSE starts_at END,`)],
  // Time-expired bid: settle and commit instead of rolling the settlement back.
  ['placeBid settle on expiry', lit(`        if (a.ends_at <= new Date(now)) {
          await client.query(\`UPDATE auction_sessions SET status='ENDED', updated_at=NOW() WHERE id=$1\`, [auctionId]);
          throw new Error('AUCTION_ENDED');
        }`, `        if (a.ends_at <= new Date(now)) {
          if (!['ENDED', 'CANCELLED'].includes(a.status)) {
            await client.query(\`
              UPDATE auction_sessions s SET status='ENDED', winning_bid=current_bid, updated_at=NOW(),
                winner_user_id = (SELECT b.bidder_id FROM auction_bids b WHERE b.auction_id = s.id ORDER BY b.amount DESC, b.created_at ASC LIMIT 1)
              WHERE id=$1\`, [auctionId]);
            await client.query('COMMIT');
            const ended: any = new Error('AUCTION_ENDED');
            ended.committed = true;
            throw ended;
          }
          throw new Error('AUCTION_ENDED');
        }`)],
  // First bid may equal the start price.
  ['first bid minimum', lit(`        const minimum = Number(a.current_bid) + Number(a.step_price);`,
    `        const minimum = Number(a.bid_count) === 0 ? Number(a.start_price) : Number(a.current_bid) + Number(a.step_price);`)],
  ['skip rollback after commit', lit(`      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async bids(`, `      } catch (error: any) {
        if (!error?.committed) await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async bids(`)],
]);

patch('server/routes/auctionRoutes.ts', [
  ['create 409', lit(`      if (error.message === 'LISTING_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });`,
    `      if (error.message === 'LISTING_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      if (error.message === 'ACTIVE_AUCTION_EXISTS') return res.status(409).json({ error: 'Sản phẩm này đang có phiên đấu giá chưa kết thúc' });`)],
  ['status errors', lit(`      if (error.message === 'INVALID_STATUS') return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      res.status(404).json({ error: 'Phiên không tồn tại hoặc đã kết thúc' });`,
    `      if (error.message === 'INVALID_STATUS') return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      if (error.message === 'INVALID_TRANSITION') return res.status(409).json({ error: 'Không thể chuyển phiên sang trạng thái này' });
      if (error.message === 'AUCTION_WINDOW_OVER') return res.status(409).json({ error: 'Đã quá giờ kết thúc, không thể mở lại phiên' });
      if (error.message === 'AUCTION_NOT_FOUND_OR_TERMINAL') return res.status(404).json({ error: 'Phiên không tồn tại hoặc đã kết thúc' });
      console.error('[auction] status error:', error);
      res.status(500).json({ error: 'Không thể cập nhật trạng thái phiên' });`)],
]);

// Page, helpers, test
const install = (src, dst, guard) => {
  if (guard && !guard(fs.readFileSync(dst, 'utf8'))) { report.push(`FAIL ${dst}: changed since review`); return; }
  if (!DRY) fs.copyFileSync(src, dst);
  report.push(`OK   ${dst}`);
};
install('.cc/au/Auction.tsx', 'pages/Auction.tsx', s => s.includes("label: 'Sắp diễn ra'") && s.includes('+ Tạo phiên'));
install('.cc/au/auction.ts', 'utils/auction.ts');
install('.cc/au/auction.test.ts', 'src/test/auction.test.ts');

const NEW = {
  'auction.title': ['Đấu giá', 'Auctions'],
  'auction.realtime_on': ['Đang cập nhật trực tiếp', 'Live updates on'],
  'auction.realtime_off': ['Mất kết nối, đang thử lại', 'Reconnecting'],
  'auction.search_placeholder': ['Tìm theo tên phiên hoặc mã sản phẩm', 'Search by session or listing code'],
  'auction.create': ['Tạo phiên', 'New session'],
  'auction.filter_status': ['Lọc theo trạng thái', 'Filter by status'],
  'auction.status_ALL': ['Tất cả', 'All'],
  'auction.status_LIVE': ['Đang diễn ra', 'Live'],
  'auction.status_UPCOMING': ['Sắp diễn ra', 'Upcoming'],
  'auction.status_PAUSED': ['Tạm dừng', 'Paused'],
  'auction.status_ENDED': ['Đã kết thúc', 'Ended'],
  'auction.status_CANCELLED': ['Đã hủy', 'Cancelled'],
  'auction.load_error': ['Không tải được phiên đấu giá', 'Could not load auctions'],
  'auction.status_error': ['Không cập nhật được trạng thái phiên', 'Could not update the session'],
  'auction.bid_error': ['Không ghi nhận được lượt đặt giá', 'Could not place the bid'],
  'auction.convert_error': ['Không chuyển được quy trình', 'Could not start the next step'],
  'auction.create_error': ['Không tạo được phiên đấu giá', 'Could not create the session'],
  'auction.empty_title': ['Chưa có phiên đấu giá', 'No auctions yet'],
  'auction.empty_body': ['Khi quản lý tạo phiên, danh sách sẽ hiện ở đây.', 'Sessions created by managers will appear here.'],
  'auction.empty_body_admin': ['Chọn một sản phẩm trong kho, đặt giá khởi điểm, bước giá và thời gian để mở phiên.', 'Pick a listing, set the start price, step and schedule to open a session.'],
  'auction.no_match_title': ['Không có phiên phù hợp', 'No matching sessions'],
  'auction.no_match_body': ['Thử đổi trạng thái hoặc từ khóa tìm kiếm.', 'Try another status or search.'],
  'auction.current_bid': ['Giá hiện tại', 'Current bid'],
  'auction.start_price': ['Giá khởi điểm', 'Start price'],
  'auction.step_price': ['Bước giá', 'Bid step'],
  'auction.bid_count': ['Lượt đặt', 'Bids'],
  'auction.min_next': ['Giá tối thiểu kế tiếp', 'Next minimum'],
  'auction.starts_in': ['Bắt đầu sau', 'Starts in'],
  'auction.ends_in': ['Kết thúc sau', 'Ends in'],
  'auction.dur_dh': ['{d} ngày {h} giờ', '{d}d {h}h'],
  'auction.dur_hm': ['{h} giờ {m} phút', '{h}h {m}m'],
  'auction.dur_ms': ['{m} phút {s} giây', '{m}m {s}s'],
  'auction.winner_short': ['Người thắng: {name}', 'Winner: {name}'],
  'auction.winner': ['Người thắng: {name}', 'Winner: {name}'],
  'auction.no_winner': ['Không có người đặt giá', 'No bids were placed'],
  'auction.cancelled_at': ['Đã hủy · kết thúc dự kiến {date}', 'Cancelled · was due {date}'],
  'auction.detail': ['Chi tiết phiên', 'Session details'],
  'auction.listing_code': ['Mã sản phẩm: {code}', 'Listing: {code}'],
  'auction.controls': ['Điều hành phiên', 'Session controls'],
  'auction.action_start': ['Mở phiên ngay', 'Start now'],
  'auction.action_resume': ['Tiếp tục', 'Resume'],
  'auction.action_pause': ['Tạm dừng', 'Pause'],
  'auction.action_end': ['Kết thúc và chốt', 'End and settle'],
  'auction.action_cancel': ['Hủy phiên', 'Cancel session'],
  'auction.confirm_end_title': ['Kết thúc phiên đấu giá?', 'End this auction?'],
  'auction.confirm_end_msg': ['Phiên sẽ đóng ngay và người trả giá cao nhất được chốt là người thắng. Không thể mở lại.', 'The session closes now and the highest bidder wins. This cannot be reopened.'],
  'auction.confirm_cancel_title': ['Hủy phiên đấu giá?', 'Cancel this auction?'],
  'auction.confirm_cancel_msg': ['Phiên sẽ bị hủy, không có người thắng. Không thể mở lại.', 'The session is cancelled with no winner. This cannot be reopened.'],
  'auction.your_bid': ['Giá của bạn', 'Your bid'],
  'auction.bid_placeholder': ['Từ {amount} trở lên', '{amount} or more'],
  'auction.place_bid': ['Đặt giá', 'Place bid'],
  'auction.bid_too_low': ['Giá phải từ {amount} trở lên', 'Bid must be at least {amount}'],
  'auction.bid_preview': ['Bạn sẽ đặt {amount}', 'You will bid {amount}'],
  'auction.bid_hint': ['Có thể gõ "5,2 tỷ" hoặc "800 triệu".', 'You can type "5.2 tỷ" or "800 triệu".'],
  'auction.bid_ok': ['Đã đặt giá {amount}', 'Bid of {amount} placed'],
  'auction.bid_not_allowed': ['Tài khoản của bạn không được đặt giá trong phiên này.', 'Your account cannot bid in this session.'],
  'auction.result': ['Kết quả', 'Result'],
  'auction.to_booking': ['Tạo booking nội bộ', 'Create internal booking'],
  'auction.to_contract': ['Tạo hợp đồng nháp', 'Create draft contract'],
  'auction.booking_created': ['Đã tạo booking nội bộ chờ xác nhận.', 'Internal booking created, awaiting confirmation.'],
  'auction.booking_exists': ['Booking của phiên này đã có từ trước.', 'A booking already exists for this session.'],
  'auction.contract_created': ['Đã tạo hợp đồng ở trạng thái nháp.', 'Draft contract created.'],
  'auction.contract_exists': ['Hợp đồng của phiên này đã có từ trước.', 'A contract already exists for this session.'],
  'auction.history': ['Lịch sử đặt giá ({n})', 'Bid history ({n})'],
  'auction.no_bids': ['Chưa có lượt đặt giá.', 'No bids yet.'],
  'auction.bidder_unknown': ['Người dùng', 'User'],
  'auction.highest': ['Cao nhất', 'Highest'],
  'auction.dong': ['đ', 'VND'],
  'auction.create_title': ['Tạo phiên đấu giá', 'New auction session'],
  'auction.field_listing': ['Sản phẩm', 'Listing'],
  'auction.listing_search': ['Tìm sản phẩm theo mã hoặc tên', 'Search listings by code or name'],
  'auction.listing_none': ['Không tìm thấy sản phẩm', 'No listings found'],
  'auction.change': ['Đổi', 'Change'],
  'auction.field_title': ['Tên phiên', 'Session name'],
  'auction.field_title_ph': ['Mặc định dùng tên sản phẩm', 'Defaults to the listing title'],
  'auction.money_ph': ['VD: 5,2 tỷ', 'e.g. 5.2 tỷ'],
  'auction.starts_at': ['Bắt đầu', 'Starts'],
  'auction.ends_at': ['Kết thúc', 'Ends'],
  'auction.time_invalid': ['Giờ kết thúc phải sau giờ bắt đầu.', 'End time must be after start time.'],
  'auction.create_hint': ['Phiên tự mở khi đến giờ bắt đầu và tự chốt khi hết giờ. Người đặt giá đầu tiên được trả bằng giá khởi điểm.', 'Sessions open and settle automatically. The first bid may equal the start price.'],
  'auction.saving': ['Đang lưu...', 'Saving...'],
};
{
  const f = 'config/locales.ts';
  let src = fs.readFileSync(f, 'utf8');
  const anchors = [...src.matchAll(/^(\s*)"detail\.history"\s*:.*$/gm)];
  if (anchors.length !== 2) report.push(`FAIL ${f}: anchors ${anchors.length}`);
  else {
    const [a, b] = anchors;
    const ins = (i, indent, block) => Object.entries(NEW).filter(([k]) => !block.includes(`"${k}"`)).map(([k, v]) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(v[i])},`).join('\n');
    const enIns = ins(1, b[1], src.slice(a.index + a[0].length));
    const vnIns = ins(0, a[1], src.slice(0, b.index));
    const bEnd = b.index + b[0].length; src = src.slice(0, bEnd) + (enIns ? '\n' + enIns : '') + src.slice(bEnd);
    const aEnd = a.index + a[0].length; src = src.slice(0, aEnd) + (vnIns ? '\n' + vnIns : '') + src.slice(aEnd);
    if (!DRY) fs.writeFileSync(f, src);
    report.push(`OK   ${f} (+${vnIns ? vnIns.split('\n').length : 0} VN / +${enIns ? enIns.split('\n').length : 0} EN)`);
  }
}
console.log(report.join('\n'));
