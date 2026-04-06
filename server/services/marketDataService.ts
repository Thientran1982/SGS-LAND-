/**
 * MarketDataService — Real-time market price cache for SGS LAND
 *
 * Architecture:
 *  1. In-memory cache (fast lookup) keyed by normalized location string
 *  2. Redis persistence (Upstash) — survives server restarts, TTL 24h
 *  3. Background seed — fetches realtime prices for all 63 Vietnamese provinces
 *     at startup using Gemini + Google Search (non-blocking, rate-limited)
 *  4. Per-request refresh — on cache miss, fetches lightweight market price
 *  5. WebSocket broadcast — emits `market_index_updated` when data refreshes
 *
 * Data sources (via Gemini Google Search grounding):
 *   batdongsan.com.vn, cafeland.vn, cen.vn, onehousing.vn, alonhadat.com,
 *   CBRE/Savills/JLL Vietnam market reports
 */

import { Server as SocketServer } from 'socket.io';
import { logger } from '../middleware/logger';
import { getRegionalBasePrice } from '../valuationEngine';
import { priceCalibrationService } from './priceCalibrationService';

const CACHE_TTL_MS      = parseInt(process.env.MARKET_CACHE_TTL_HOURS || '6') * 3_600_000;
const SEED_TTL_MS       = 24 * 3_600_000;    // seed data valid for 24h
const REDIS_TTL_SECS    = 86_400;            // 24h Redis key TTL
const MAX_CACHE_ENTRIES = 300;
const SEED_BATCH_SIZE   = 3;                 // parallel searches per batch
const SEED_BATCH_DELAY  = 3_000;            // ms between batches (rate-limit buffer)
const MIN_PRICE_VND     = 5_000_000;        // sanity: 5 triệu/m²
const MAX_PRICE_VND     = 1_000_000_000;    // sanity: 1 tỷ/m²
const REDIS_KEY_PREFIX  = 'sgsland:market:v2:';

// ─────────────────────────────────────────────────────────────────────────────
// Seed locations: one representative address per province/city of Vietnam
// These get seeded with realtime Gemini+Search prices at startup.
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_LOCATIONS: Array<{ location: string; pType?: string }> = [
  // ══ 5 Thành phố trực thuộc Trung ương ════════════════════════════════════
  { location: 'Quận Hoàn Kiếm, Hà Nội',               pType: 'townhouse_center' },
  { location: 'Quận 1, TP. Hồ Chí Minh',              pType: 'townhouse_center' },
  { location: 'Quận Hải Châu, Đà Nẵng',               pType: 'townhouse_center' },
  { location: 'Quận Hồng Bàng, Hải Phòng',            pType: 'townhouse_center' },
  { location: 'Quận Ninh Kiều, Cần Thơ',              pType: 'townhouse_center' },

  // ══ Hà Nội — tất cả quận nội thành ══════════════════════════════════════
  { location: 'Quận Ba Đình, Hà Nội',                 pType: 'townhouse_center' },
  { location: 'Quận Đống Đa, Hà Nội',                 pType: 'townhouse_center' },
  { location: 'Quận Hai Bà Trưng, Hà Nội',            pType: 'townhouse_center' },
  { location: 'Quận Cầu Giấy, Hà Nội',                pType: 'townhouse_center' },
  { location: 'Quận Tây Hồ, Hà Nội',                  pType: 'townhouse_center' },
  { location: 'Quận Thanh Xuân, Hà Nội',              pType: 'townhouse_center' },
  { location: 'Quận Hoàng Mai, Hà Nội',               pType: 'townhouse_center' },
  { location: 'Quận Nam Từ Liêm, Hà Nội',             pType: 'townhouse_center' },
  { location: 'Quận Bắc Từ Liêm, Hà Nội',             pType: 'townhouse_center' },
  { location: 'Quận Long Biên, Hà Nội',               pType: 'townhouse_center' },
  // Hà Nội — huyện/thị xã ngoại thành
  { location: 'Quận Hà Đông, Hà Nội',                 pType: 'townhouse_center' },
  { location: 'Huyện Gia Lâm, Hà Nội',                pType: 'townhouse_suburb' },
  { location: 'Huyện Đông Anh, Hà Nội',               pType: 'townhouse_suburb' },
  { location: 'Huyện Thanh Trì, Hà Nội',              pType: 'townhouse_suburb' },
  { location: 'Huyện Hoài Đức, Hà Nội',               pType: 'townhouse_suburb' },
  { location: 'Huyện Mê Linh, Hà Nội',                pType: 'townhouse_suburb' },
  { location: 'Huyện Đan Phượng, Hà Nội',             pType: 'townhouse_suburb' },
  { location: 'Huyện Thạch Thất - Hòa Lạc, Hà Nội',  pType: 'townhouse_suburb' },
  { location: 'Huyện Sóc Sơn, Hà Nội',               pType: 'townhouse_suburb' },

  // ══ TP.HCM — tất cả quận/huyện ═══════════════════════════════════════════
  { location: 'Quận 3, TP. Hồ Chí Minh',              pType: 'townhouse_center' },
  { location: 'Quận 4, TP. Hồ Chí Minh',              pType: 'townhouse_center' },
  { location: 'Quận 5 Chợ Lớn, TP. Hồ Chí Minh',     pType: 'townhouse_center' },
  { location: 'Quận 6, TP. Hồ Chí Minh',              pType: 'townhouse_center' },
  { location: 'Quận 7 Phú Mỹ Hưng, TP. Hồ Chí Minh', pType: 'townhouse_center' },
  { location: 'Quận 8, TP. Hồ Chí Minh',              pType: 'townhouse_center' },
  { location: 'Quận 10, TP. Hồ Chí Minh',             pType: 'townhouse_center' },
  { location: 'Quận 11, TP. Hồ Chí Minh',             pType: 'townhouse_center' },
  { location: 'Quận 12, TP. Hồ Chí Minh',             pType: 'townhouse_suburb' },
  { location: 'Quận Bình Thạnh, TP. Hồ Chí Minh',    pType: 'townhouse_center' },
  { location: 'Quận Phú Nhuận, TP. Hồ Chí Minh',     pType: 'townhouse_center' },
  { location: 'Quận Tân Bình, TP. Hồ Chí Minh',      pType: 'townhouse_center' },
  { location: 'Quận Tân Phú, TP. Hồ Chí Minh',       pType: 'townhouse_center' },
  { location: 'Quận Gò Vấp, TP. Hồ Chí Minh',        pType: 'townhouse_center' },
  { location: 'Quận Bình Tân, TP. Hồ Chí Minh',      pType: 'townhouse_center' },
  // TP.HCM — Thủ Đức (Q2+Q9 cũ)
  { location: 'Thảo Điền, Thủ Đức, TP. Hồ Chí Minh', pType: 'townhouse_center' },
  { location: 'Thủ Thiêm, Thủ Đức, TP. Hồ Chí Minh', pType: 'townhouse_center' },
  { location: 'Vinhomes Grand Park, Thủ Đức, TP. Hồ Chí Minh', pType: 'apartment_suburb' },
  { location: 'Quận Thủ Đức, TP. Hồ Chí Minh',       pType: 'townhouse_center' },
  // TP.HCM — huyện ngoại thành
  { location: 'Huyện Bình Chánh, TP. Hồ Chí Minh',   pType: 'townhouse_suburb' },
  { location: 'Huyện Nhà Bè, TP. Hồ Chí Minh',       pType: 'townhouse_suburb' },
  { location: 'Huyện Hóc Môn, TP. Hồ Chí Minh',      pType: 'townhouse_suburb' },
  { location: 'Huyện Củ Chi, TP. Hồ Chí Minh',       pType: 'townhouse_suburb' },
  { location: 'Huyện Cần Giờ, TP. Hồ Chí Minh',      pType: 'townhouse_suburb' },

  // ══ Đà Nẵng — tất cả quận ════════════════════════════════════════════════
  { location: 'Quận Sơn Trà, Đà Nẵng',                pType: 'townhouse_center' },
  { location: 'Quận Ngũ Hành Sơn, Đà Nẵng',           pType: 'townhouse_center' },
  { location: 'Quận Liên Chiểu, Đà Nẵng',             pType: 'townhouse_center' },
  { location: 'Quận Thanh Khê, Đà Nẵng',              pType: 'townhouse_center' },
  { location: 'Quận Cẩm Lệ, Đà Nẵng',                pType: 'townhouse_center' },
  { location: 'Huyện Hòa Vang, Đà Nẵng',              pType: 'townhouse_suburb' },
  { location: 'Đường Võ Nguyên Giáp - Biển Mỹ Khê, Đà Nẵng', pType: 'townhouse_center' },

  // ══ Hải Phòng — quận ══════════════════════════════════════════════════════
  { location: 'Quận Ngô Quyền, Hải Phòng',            pType: 'townhouse_center' },
  { location: 'Quận Lê Chân, Hải Phòng',              pType: 'townhouse_center' },
  { location: 'Quận Hải An, Hải Phòng',               pType: 'townhouse_center' },
  { location: 'Quận Dương Kinh, Hải Phòng',           pType: 'townhouse_center' },
  { location: 'Huyện An Dương, Hải Phòng',             pType: 'townhouse_suburb' },
  { location: 'Thành phố Đồ Sơn, Hải Phòng',          pType: 'townhouse_center' },
  { location: 'Huyện Thuỷ Nguyên, Hải Phòng',         pType: 'townhouse_suburb' },

  // ══ Cần Thơ — quận ════════════════════════════════════════════════════════
  { location: 'Quận Bình Thuỷ, Cần Thơ',              pType: 'townhouse_center' },
  { location: 'Quận Cái Răng, Cần Thơ',               pType: 'townhouse_center' },
  { location: 'Quận Ô Môn, Cần Thơ',                  pType: 'townhouse_center' },
  { location: 'Huyện Phong Điền, Cần Thơ',            pType: 'townhouse_suburb' },

  // ══ Miền Nam — tỉnh vệ tinh HCM ═════════════════════════════════════════
  // Bình Dương
  { location: 'Thành phố Thuận An, Bình Dương',       pType: 'townhouse_center' },
  { location: 'Thành phố Dĩ An, Bình Dương',          pType: 'townhouse_center' },
  { location: 'Thành phố Thủ Dầu Một, Bình Dương',   pType: 'townhouse_center' },
  { location: 'Thị xã Tân Uyên, Bình Dương',          pType: 'townhouse_suburb' },
  { location: 'Thị xã Bến Cát, Bình Dương',           pType: 'townhouse_suburb' },
  { location: 'Huyện Bàu Bàng, Bình Dương',           pType: 'townhouse_suburb' },
  { location: 'Huyện Phú Giáo, Bình Dương',           pType: 'townhouse_suburb' },
  { location: 'Huyện Dầu Tiếng, Bình Dương',          pType: 'townhouse_suburb' },
  // Đồng Nai
  { location: 'Thành phố Biên Hòa, Đồng Nai',         pType: 'townhouse_center' },
  { location: 'Huyện Long Thành, Đồng Nai',           pType: 'townhouse_suburb' },
  { location: 'Huyện Nhơn Trạch, Đồng Nai',           pType: 'townhouse_suburb' },
  { location: 'Huyện Trảng Bom, Đồng Nai',            pType: 'townhouse_suburb' },
  { location: 'Huyện Vĩnh Cửu, Đồng Nai',             pType: 'townhouse_suburb' },
  { location: 'Huyện Định Quán, Đồng Nai',             pType: 'townhouse_suburb' },
  { location: 'Huyện Thống Nhất, Đồng Nai',           pType: 'townhouse_suburb' },
  { location: 'Huyện Xuân Lộc, Đồng Nai',             pType: 'townhouse_suburb' },
  { location: 'Huyện Cẩm Mỹ, Đồng Nai',               pType: 'townhouse_suburb' },
  // Bà Rịa - Vũng Tàu
  { location: 'Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu', pType: 'townhouse_center' },
  { location: 'Thành phố Bà Rịa, Bà Rịa - Vũng Tàu', pType: 'townhouse_center' },
  { location: 'Thị xã Phú Mỹ, Bà Rịa - Vũng Tàu',   pType: 'townhouse_center' },
  { location: 'Huyện Xuyên Mộc, Bà Rịa - Vũng Tàu',  pType: 'townhouse_suburb' },
  { location: 'Huyện Châu Đức, Bà Rịa - Vũng Tàu',   pType: 'townhouse_suburb' },
  { location: 'Huyện Long Điền, Bà Rịa - Vũng Tàu',  pType: 'townhouse_suburb' },
  { location: 'Huyện Đất Đỏ, Bà Rịa - Vũng Tàu',     pType: 'townhouse_suburb' },
  { location: 'Huyện Côn Đảo, Bà Rịa - Vũng Tàu',    pType: 'townhouse_center' },
  // Long An
  { location: 'Thành phố Tân An, Long An',             pType: 'townhouse_center' },
  { location: 'Huyện Bến Lức, Long An',                pType: 'townhouse_suburb' },
  { location: 'Huyện Đức Hòa, Long An',                pType: 'townhouse_suburb' },
  { location: 'Huyện Cần Giuộc, Long An',              pType: 'townhouse_suburb' },
  { location: 'Huyện Cần Đước, Long An',               pType: 'townhouse_suburb' },
  { location: 'Huyện Thủ Thừa, Long An',              pType: 'townhouse_suburb' },
  // Tây Ninh
  { location: 'Thành phố Tây Ninh, Tây Ninh',         pType: 'townhouse_center' },
  { location: 'Huyện Trảng Bàng, Tây Ninh',           pType: 'townhouse_suburb' },
  { location: 'Huyện Bến Cầu, Tây Ninh',              pType: 'townhouse_suburb' },
  // Bình Phước
  { location: 'Thành phố Đồng Xoài, Bình Phước',      pType: 'townhouse_center' },
  { location: 'Thị xã Chơn Thành, Bình Phước',        pType: 'townhouse_suburb' },
  { location: 'Thị xã Bình Long, Bình Phước',         pType: 'townhouse_center' },

  // ══ Đồng bằng sông Cửu Long ══════════════════════════════════════════════
  { location: 'Thành phố Mỹ Tho, Tiền Giang',         pType: 'townhouse_center' },
  { location: 'Thị xã Gò Công, Tiền Giang',           pType: 'townhouse_center' },
  { location: 'Thành phố Bến Tre, Bến Tre',           pType: 'townhouse_center' },
  { location: 'Thành phố Trà Vinh, Trà Vinh',         pType: 'townhouse_center' },
  { location: 'Thành phố Vĩnh Long, Vĩnh Long',       pType: 'townhouse_center' },
  { location: 'Thành phố Cao Lãnh, Đồng Tháp',        pType: 'townhouse_center' },
  { location: 'Thành phố Sa Đéc, Đồng Tháp',          pType: 'townhouse_center' },
  { location: 'Thành phố Long Xuyên, An Giang',        pType: 'townhouse_center' },
  { location: 'Thành phố Châu Đốc, An Giang',          pType: 'townhouse_center' },
  { location: 'Thành phố Phú Quốc, Kiên Giang',       pType: 'townhouse_center' },
  { location: 'Thành phố Rạch Giá, Kiên Giang',       pType: 'townhouse_center' },
  { location: 'Thành phố Vị Thanh, Hậu Giang',        pType: 'townhouse_center' },
  { location: 'Thành phố Sóc Trăng, Sóc Trăng',       pType: 'townhouse_center' },
  { location: 'Thành phố Bạc Liêu, Bạc Liêu',         pType: 'townhouse_center' },
  { location: 'Thành phố Cà Mau, Cà Mau',              pType: 'townhouse_center' },

  // ══ Miền Trung — Thừa Thiên Huế / Quảng Nam ══════════════════════════════
  { location: 'Thành phố Huế, Thừa Thiên Huế',        pType: 'townhouse_center' },
  { location: 'Huyện Phú Vang, Thừa Thiên Huế',       pType: 'townhouse_suburb' },
  { location: 'Thị xã Hương Thủy, Thừa Thiên Huế',   pType: 'townhouse_suburb' },
  { location: 'Thành phố Hội An, Quảng Nam',           pType: 'townhouse_center' },
  { location: 'Thành phố Tam Kỳ, Quảng Nam',           pType: 'townhouse_center' },
  { location: 'Thị xã Điện Bàn, Quảng Nam',           pType: 'townhouse_suburb' },
  { location: 'Thành phố Quảng Ngãi, Quảng Ngãi',     pType: 'townhouse_center' },

  // ══ Miền Trung — Bình Định / Phú Yên / Khánh Hòa ═════════════════════════
  { location: 'Thành phố Quy Nhơn, Bình Định',         pType: 'townhouse_center' },
  { location: 'Thị xã An Nhơn, Bình Định',             pType: 'townhouse_suburb' },
  { location: 'Thành phố Tuy Hòa, Phú Yên',           pType: 'townhouse_center' },
  { location: 'Thành phố Nha Trang, Khánh Hòa',        pType: 'townhouse_center' },
  { location: 'Đường Trần Phú mặt biển, Nha Trang, Khánh Hòa', pType: 'townhouse_center' },
  { location: 'Thành phố Cam Ranh, Khánh Hòa',        pType: 'townhouse_center' },
  { location: 'Huyện Cam Lâm, Khánh Hòa',             pType: 'townhouse_suburb' },
  { location: 'Thị xã Ninh Hòa, Khánh Hòa',           pType: 'townhouse_suburb' },
  { location: 'Huyện Vạn Ninh, Khánh Hòa',            pType: 'townhouse_suburb' },
  { location: 'Thành phố Phan Rang - Tháp Chàm, Ninh Thuận', pType: 'townhouse_center' },

  // ══ Miền Trung — Bình Thuận ═══════════════════════════════════════════════
  { location: 'Thành phố Phan Thiết, Bình Thuận',      pType: 'townhouse_center' },
  { location: 'Mũi Né, Phan Thiết, Bình Thuận',        pType: 'townhouse_center' },
  { location: 'Thị xã La Gi, Bình Thuận',              pType: 'townhouse_suburb' },

  // ══ Miền Trung — Quảng Bình / Quảng Trị ══════════════════════════════════
  { location: 'Thành phố Đồng Hới, Quảng Bình',        pType: 'townhouse_center' },
  { location: 'Thành phố Đông Hà, Quảng Trị',          pType: 'townhouse_center' },

  // ══ Miền Bắc — Thanh Hóa / Nghệ An / Hà Tĩnh ════════════════════════════
  { location: 'Thành phố Thanh Hóa, Thanh Hóa',        pType: 'townhouse_center' },
  { location: 'Thị xã Sầm Sơn, Thanh Hóa',             pType: 'townhouse_center' },
  { location: 'Thị xã Nghi Sơn, Thanh Hóa',            pType: 'townhouse_suburb' },
  { location: 'Thành phố Vinh, Nghệ An',                pType: 'townhouse_center' },
  { location: 'Thị xã Cửa Lò, Nghệ An',               pType: 'townhouse_center' },
  { location: 'Thành phố Hà Tĩnh, Hà Tĩnh',            pType: 'townhouse_center' },
  { location: 'Thị xã Kỳ Anh, Hà Tĩnh',               pType: 'townhouse_suburb' },

  // ══ Quảng Ninh ════════════════════════════════════════════════════════════
  { location: 'Thành phố Hạ Long, Quảng Ninh',         pType: 'townhouse_center' },
  { location: 'Thành phố Móng Cái, Quảng Ninh',        pType: 'townhouse_center' },
  { location: 'Thành phố Uông Bí, Quảng Ninh',         pType: 'townhouse_center' },
  { location: 'Thị xã Đông Triều, Quảng Ninh',         pType: 'townhouse_suburb' },
  { location: 'Thành phố Cẩm Phả, Quảng Ninh',         pType: 'townhouse_center' },

  // ══ Các tỉnh phía Bắc (vệ tinh Hà Nội) ══════════════════════════════════
  { location: 'Thành phố Bắc Ninh, Bắc Ninh',          pType: 'townhouse_center' },
  { location: 'Thị xã Từ Sơn, Bắc Ninh',              pType: 'townhouse_center' },
  { location: 'Thành phố Bắc Giang, Bắc Giang',        pType: 'townhouse_center' },
  { location: 'Thành phố Vĩnh Yên, Vĩnh Phúc',         pType: 'townhouse_center' },
  { location: 'Thị xã Phúc Yên, Vĩnh Phúc',           pType: 'townhouse_center' },
  { location: 'Thành phố Hải Dương, Hải Dương',         pType: 'townhouse_center' },
  { location: 'Thành phố Hưng Yên, Hưng Yên',          pType: 'townhouse_center' },
  { location: 'Thị xã Mỹ Hào, Hưng Yên',              pType: 'townhouse_suburb' },
  { location: 'Thành phố Thái Bình, Thái Bình',         pType: 'townhouse_center' },
  { location: 'Thành phố Phủ Lý, Hà Nam',              pType: 'townhouse_center' },
  { location: 'Thành phố Nam Định, Nam Định',           pType: 'townhouse_center' },
  { location: 'Thành phố Ninh Bình, Ninh Bình',         pType: 'townhouse_center' },

  // ══ Trung du & Miền núi phía Bắc ════════════════════════════════════════
  { location: 'Thành phố Thái Nguyên, Thái Nguyên',    pType: 'townhouse_center' },
  { location: 'Thành phố Việt Trì, Phú Thọ',           pType: 'townhouse_center' },
  { location: 'Thành phố Yên Bái, Yên Bái',            pType: 'townhouse_center' },
  { location: 'Thành phố Lào Cai, Lào Cai',            pType: 'townhouse_center' },
  { location: 'Thị xã Sa Pa, Lào Cai',                 pType: 'townhouse_center' },
  { location: 'Thành phố Tuyên Quang, Tuyên Quang',    pType: 'townhouse_center' },
  { location: 'Thành phố Hòa Bình, Hòa Bình',          pType: 'townhouse_center' },
  { location: 'Thành phố Lạng Sơn, Lạng Sơn',          pType: 'townhouse_center' },
  { location: 'Thành phố Cao Bằng, Cao Bằng',          pType: 'townhouse_center' },
  { location: 'Thành phố Sơn La, Sơn La',              pType: 'townhouse_center' },
  { location: 'Thành phố Điện Biên Phủ, Điện Biên',    pType: 'townhouse_center' },
  { location: 'Thành phố Hà Giang, Hà Giang',          pType: 'townhouse_center' },
  { location: 'Thành phố Lai Châu, Lai Châu',          pType: 'townhouse_center' },
  { location: 'Thành phố Bắc Kạn, Bắc Kạn',           pType: 'townhouse_center' },

  // ══ Tây Nguyên ═══════════════════════════════════════════════════════════
  { location: 'Thành phố Đà Lạt, Lâm Đồng',           pType: 'townhouse_center' },
  { location: 'Thành phố Bảo Lộc, Lâm Đồng',          pType: 'townhouse_center' },
  { location: 'Huyện Đức Trọng, Lâm Đồng',             pType: 'townhouse_suburb' },
  { location: 'Thành phố Buôn Ma Thuột, Đắk Lắk',     pType: 'townhouse_center' },
  { location: 'Thị xã Buôn Hồ, Đắk Lắk',             pType: 'townhouse_center' },
  { location: 'Thành phố Pleiku, Gia Lai',              pType: 'townhouse_center' },
  { location: 'Thị xã An Khê, Gia Lai',               pType: 'townhouse_center' },
  { location: 'Thành phố Kon Tum, Kon Tum',            pType: 'townhouse_center' },
  { location: 'Thành phố Gia Nghĩa, Đắk Nông',         pType: 'townhouse_center' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface MarketDataEntry {
  location: string;
  normalizedKey: string;
  pricePerM2: number;
  confidence: number;
  marketTrend: string;
  monthlyRentEstimate?: number;
  source: 'AI' | 'REGIONAL_TABLE' | 'BLENDED' | 'SEED';
  fetchedAt: string;
  expiresAt: string;
  region?: string;
  sampleNotes?: string;
  priceMin?: number;
  priceMax?: number;
  sourceCount?: number;
  dataRecency?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

async function getRedisClient(): Promise<any | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

async function getAiClient() {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: apiKey! });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight market price fetcher (2-step: search → extract)
// Much lighter than full AVM pipeline — used for seeding and cache-miss fills
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLightMarketPrice(
  location: string,
  pType: string = 'townhouse_center',
): Promise<{ priceMedian: number; priceMin: number; priceMax: number; trend: string; confidence: number; rentMedian: number; sourceCount: number; dataRecency: string }> {
  const { Type } = await import('@google/genai');
  const year  = new Date().getFullYear();
  const month = new Date().toLocaleString('vi-VN', { month: 'long', timeZone: 'Asia/Ho_Chi_Minh' });

  const pTypeLabels: Record<string, string> = {
    apartment_center:  'Căn hộ chung cư',
    apartment_suburb:  'Căn hộ chung cư ngoại thành',
    townhouse_center:  'Nhà phố / đất thổ cư',
    townhouse_suburb:  'Nhà phố / đất thổ cư ngoại thành',
    villa:             'Biệt thự',
    shophouse:         'Shophouse / Nhà phố thương mại',
    land_urban:        'Đất thổ cư nội đô (đất nền)',
    land_suburban:     'Đất thổ cư ngoại thành (đất nền)',
    penthouse:         'Penthouse / Căn hộ đỉnh tháp',
    office:            'Văn phòng / Mặt bằng thương mại',
    warehouse:         'Nhà xưởng / Kho bãi công nghiệp',
    land_agricultural: 'Đất nông nghiệp / Đất vườn',
    land_industrial:   'Đất khu công nghiệp (KCN)',
    project:           'Căn hộ dự án / Off-plan',
  };
  const pLabel = pTypeLabels[pType] || 'Nhà phố / đất thổ cư';

  const ai = await getAiClient();

  // Step 1 — Google Search grounding: get raw market text
  const searchResp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Tra cứu giá BĐS tại ${location}, Việt Nam — ${month} ${year}

Cần: Giá GIAO DỊCH THỰC TẾ 1m² (${pLabel}, Sổ Hồng/Sổ Đỏ, lộ giới 4m, 60-100m²)
Nguồn: batdongsan.com.vn, cafeland.vn, cen.vn, onehousing.vn, alonhadat.com, CBRE/Savills Vietnam ${year}
1. Khoảng giá giao dịch thực tế (thấp nhất – trung bình – cao nhất) /m²
2. Giá thuê trung bình/tháng cho 60m² tại khu vực
3. Xu hướng tăng/giảm % so với năm ngoái
4. Số nguồn tìm thấy dữ liệu
ƯU TIÊN: giá giao dịch > giá rao bán > ước tính khu vực`,
    config: {
      systemInstruction: 'Bạn là chuyên gia định giá BĐS Việt Nam. Tìm giá thị trường thực tế từ các nguồn uy tín.',
      tools: [{ googleSearch: {} }],
    },
  });
  const marketText = searchResp.text || '';

  // Step 2 — Structured extraction
  const extractSchema = {
    type: Type.OBJECT as any,
    properties: {
      priceMin:     { type: Type.NUMBER as any, description: 'Giá thấp nhất tìm thấy (VNĐ/m²)' },
      priceMedian:  { type: Type.NUMBER as any, description: 'Giá trung bình/trung vị (VNĐ/m²) — chính' },
      priceMax:     { type: Type.NUMBER as any, description: 'Giá cao nhất tìm thấy (VNĐ/m²)' },
      rentMedian:   { type: Type.NUMBER as any, description: 'Giá thuê trung bình tháng (triệu VNĐ) cho 60m²' },
      trend:        { type: Type.STRING as any, description: 'Xu hướng giá, ví dụ: Tăng 8%/năm, Ổn định' },
      confidence:   { type: Type.NUMBER as any, description: 'Độ tin cậy 0-100. 90+ nếu có giao dịch thực tế từ nguồn uy tín.' },
      sourceCount:  { type: Type.NUMBER as any, description: 'Số nguồn độc lập tìm thấy (1-10)' },
      dataRecency:  { type: Type.STRING as any, enum: ['current_year', 'last_year', 'older'], description: 'Độ mới dữ liệu' },
    },
    required: ['priceMin', 'priceMedian', 'priceMax', 'rentMedian', 'trend', 'confidence', 'sourceCount', 'dataRecency'],
  };

  const extractResp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Khu vực: "${location}" | Loại: ${pLabel}\n\nDỮ LIỆU THỊ TRƯỜNG:\n${marketText}\n\nTRÍCH XUẤT: priceMin, priceMedian, priceMax (VNĐ/m²), rentMedian (triệu/tháng cho 60m²), trend, confidence, sourceCount, dataRecency.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: extractSchema as any,
      systemInstruction: 'Trích xuất số liệu chính xác. Trả JSON theo schema. Đơn vị giá: VNĐ/m² (150000000 = 150 triệu/m²).',
    },
  });

  const d = JSON.parse(extractResp.text || '{}');
  return {
    priceMedian:  d.priceMedian  || 0,
    priceMin:     d.priceMin     || d.priceMedian || 0,
    priceMax:     d.priceMax     || d.priceMedian || 0,
    trend:        d.trend        || 'Đang cập nhật',
    confidence:   Math.min(100, Math.max(0, d.confidence || 75)),
    rentMedian:   d.rentMedian   || 0,
    sourceCount:  d.sourceCount  || 1,
    dataRecency:  d.dataRecency  || 'current_year',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketDataService class
// ─────────────────────────────────────────────────────────────────────────────
class MarketDataService {
  private static instance: MarketDataService;
  private cache = new Map<string, MarketDataEntry>();
  private io: SocketServer | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private isSeedRunning = false;
  private redisClient: any | null = null;
  // Circuit breaker: when Gemini quota is exhausted, skip AI calls until cooldown expires
  private quotaExhaustedUntil: number = 0;
  private static readonly QUOTA_COOLDOWN_MS = 15 * 60_000; // 15 minutes

  get isQuotaExhausted(): boolean { return Date.now() < this.quotaExhaustedUntil; }
  private markQuotaExhausted(): void {
    this.quotaExhaustedUntil = Date.now() + MarketDataService.QUOTA_COOLDOWN_MS;
    logger.warn(`[MarketData] Gemini quota exhausted — AI calls paused for 15 min (until ${new Date(this.quotaExhaustedUntil).toISOString()})`);
  }

  private constructor() {}

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /** Start background refresh loop and seed all provinces */
  async start(io: SocketServer): Promise<void> {
    this.io = io;

    // Connect Redis
    this.redisClient = await getRedisClient();
    if (this.redisClient) {
      logger.info('[MarketData] Redis connected — loading cached market prices...');
      await this.loadFromRedis();
    } else {
      logger.warn('[MarketData] Redis unavailable — using in-memory cache only');
    }

    // Periodic stale-entry refresh
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refreshStaleEntries(), CACHE_TTL_MS);

    logger.info(`[MarketData] Service started — cache TTL: ${CACHE_TTL_MS / 3_600_000}h, seed locations: ${SEED_LOCATIONS.length}`);

    // Seed in background after 10s delay (let server fully start first)
    setTimeout(() => this.seedAllProvinces(), 10_000);
  }

  stop(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    logger.info('[MarketData] Service stopped');
  }

  /**
   * Get market data for a location.
   *
   * When `propertyType` is supplied and is NOT a townhouse variant, the cache
   * uses a type-specific key (`normalizedLocation:propertyType`) so that
   * apartment / villa / warehouse prices are fetched with the correct AI type
   * and stored separately from the townhouse reference baseline. The returned
   * price is already type-accurate and should NOT have a type multiplier applied
   * in the calling code.
   *
   * For townhouse_center / townhouse_suburb (the reference baseline) the
   * original key format is used so the background seed entries are still hit.
   */
  async getMarketData(location: string, propertyType?: string): Promise<MarketDataEntry> {
    const baseKey = normalizeLocation(location);
    const isTownhouseRef = !propertyType
      || propertyType === 'townhouse_center'
      || propertyType === 'townhouse_suburb';
    const key = isTownhouseRef ? baseKey : `${baseKey}:${propertyType}`;
    const cached = this.cache.get(key);
    if (cached && new Date(cached.expiresAt) > new Date()) {
      logger.debug(`[MarketData] Cache HIT for "${key}"`);
      return cached;
    }
    return this.fetchAndCache(location, key, isTownhouseRef ? 'townhouse_center' : propertyType!);
  }

  /** Force refresh a location (bypasses TTL) */
  async forceRefresh(location: string): Promise<MarketDataEntry> {
    const key = normalizeLocation(location);
    return this.fetchAndCache(location, key, 'townhouse_center');
  }

  /** Get all currently cached entries (for admin/monitoring) */
  getCacheSnapshot(): MarketDataEntry[] {
    return Array.from(this.cache.values())
      .sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  }

  get cacheSize(): number { return this.cache.size; }

  // ── Seed all provinces ────────────────────────────────────────────────────
  /** Run background seed for all Vietnamese provinces — skips already-cached entries */
  async seedAllProvinces(): Promise<void> {
    if (this.isSeedRunning) return;
    this.isSeedRunning = true;
    logger.info(`[MarketData] Starting background seed for ${SEED_LOCATIONS.length} locations...`);

    const missing = SEED_LOCATIONS.filter(({ location }) => {
      const key = normalizeLocation(location);
      const cached = this.cache.get(key);
      return !cached || new Date(cached.expiresAt) <= new Date();
    });

    if (missing.length === 0) {
      logger.info('[MarketData] All seed locations already cached — skip');
      this.isSeedRunning = false;
      return;
    }

    logger.info(`[MarketData] Seeding ${missing.length} missing locations in batches of ${SEED_BATCH_SIZE}...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < missing.length; i += SEED_BATCH_SIZE) {
      const batch = missing.slice(i, i + SEED_BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async ({ location, pType }) => {
          try {
            await this.fetchSeedEntry(location, pType || 'townhouse_center');
            successCount++;
          } catch (err: any) {
            failCount++;
            logger.error(`[MarketData] Seed failed "${location}": ${err.message}`);
          }
        })
      );

      // Stop seeding if quota was hit during this batch
      if (this.isQuotaExhausted) {
        logger.warn(`[MarketData] Seed aborted — Gemini quota exhausted after ${successCount} locations. Will resume when circuit resets.`);
        break;
      }

      // Rate-limit: wait between batches
      if (i + SEED_BATCH_SIZE < missing.length) {
        await new Promise(r => setTimeout(r, SEED_BATCH_DELAY));
      }
    }

    this.isSeedRunning = false;
    logger.info(`[MarketData] Seed complete — ${successCount} success, ${failCount} failed. Cache size: ${this.cache.size}`);
  }

  // ── Private methods ───────────────────────────────────────────────────────

  /** Load all valid entries from Redis into in-memory cache */
  private async loadFromRedis(): Promise<void> {
    if (!this.redisClient) return;
    try {
      const keys: string[] = await this.redisClient.keys(`${REDIS_KEY_PREFIX}*`);
      if (!keys || keys.length === 0) {
        logger.info('[MarketData] Redis cache empty — will seed on startup');
        return;
      }

      let loaded = 0;
      for (const key of keys) {
        try {
          const raw = await this.redisClient.get(key);
          if (!raw) continue;
          const entry: MarketDataEntry = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (new Date(entry.expiresAt) > new Date()) {
            const normKey = key.replace(REDIS_KEY_PREFIX, '');
            this.cache.set(normKey, entry);
            loaded++;
          }
        } catch { /* skip corrupt entries */ }
      }
      logger.info(`[MarketData] Loaded ${loaded}/${keys.length} valid entries from Redis`);
    } catch (err: any) {
      logger.error('[MarketData] Failed to load from Redis:', err.message);
    }
  }

  /** Persist a cache entry to Redis */
  private async saveToRedis(key: string, entry: MarketDataEntry): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.set(
        `${REDIS_KEY_PREFIX}${key}`,
        JSON.stringify(entry),
        { ex: REDIS_TTL_SECS }
      );
    } catch (err: any) {
      logger.warn(`[MarketData] Redis save failed for "${key}": ${err.message}`);
    }
  }

  /**
   * Fetch + cache using the full AVM pipeline (per-request, high precision).
   *
   * `fetchPropertyType` controls what the AI is asked to price:
   *  - 'townhouse_center' (default) → reference baseline price for the area
   *  - any other type → type-specific price stored under key `location:type`
   */
  private async fetchAndCache(location: string, key: string, fetchPropertyType: string = 'townhouse_center'): Promise<MarketDataEntry> {
    let entry: MarketDataEntry;

    // Circuit breaker: skip AI call when quota is known to be exhausted
    if (this.isQuotaExhausted) {
      logger.debug(`[MarketData] Circuit breaker active — using regional table for "${location}"`);
      return this.storeEntry(key, this.buildRegionalEntry(location, key));
    }

    try {
      const { aiService } = await import('../ai');
      const result = await aiService.getRealtimeValuation(
        location, 70, 4, 'PINK_BOOK', fetchPropertyType as any
      );
      const now = new Date();
      entry = {
        location,
        normalizedKey: key,
        pricePerM2:     result.basePrice,
        confidence:     result.confidence,
        marketTrend:    result.marketTrend,
        monthlyRentEstimate: result.incomeApproach?.monthlyRent,
        source:         'AI',
        fetchedAt:      now.toISOString(),
        expiresAt:      new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
      };

      // ── Sanity check: AI price must be within ±70% of regional baseline ────
      // Prevents cached bad values when AI hallucinates or returns generic
      // district prices for premium project addresses (e.g. Izumi, Aqua City).
      const regional = getRegionalBasePrice(location, fetchPropertyType);
      const regionRef  = regional.price;
      const priceLow   = regionRef * 0.30;
      const priceHigh  = regionRef * 5.0;
      const aiPrice    = entry.pricePerM2;
      if (aiPrice < MIN_PRICE_VND || aiPrice < priceLow || aiPrice > priceHigh) {
        logger.warn(`[MarketData] AI price ${(aiPrice/1_000_000).toFixed(0)}M implausible for "${location}" (regional=${(regionRef/1_000_000).toFixed(0)}M, range=${(priceLow/1_000_000).toFixed(0)}-${(priceHigh/1_000_000).toFixed(0)}M) — blending`);
        entry.pricePerM2 = aiPrice > 0
          ? Math.round(regionRef * 0.60 + aiPrice * 0.40)
          : regionRef;
        entry.confidence = Math.round(Math.min(entry.confidence, 65));
        entry.source = 'BLENDED' as any;
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429')) {
        this.markQuotaExhausted();
      }
      entry = this.buildRegionalEntry(location, key);
    }

    return this.storeEntry(key, entry);
  }

  /** Fetch lightweight seed entry (2-step search+extract, no full AVM) */
  private async fetchSeedEntry(location: string, pType: string): Promise<MarketDataEntry> {
    const key = normalizeLocation(location);
    const regional = getRegionalBasePrice(location, pType);

    // Skip AI if quota is exhausted
    if (this.isQuotaExhausted) {
      return this.storeEntry(key, this.buildRegionalEntry(location, key));
    }

    try {
      const data = await fetchLightMarketPrice(location, pType);

      // Sanity check against regional baseline
      const regionRef = regional.price;
      const priceLow  = regionRef * 0.30;
      const priceHigh = regionRef * 4.0;
      let price = data.priceMedian;
      let source: MarketDataEntry['source'] = 'SEED';

      if (price < MIN_PRICE_VND || price < priceLow || price > priceHigh) {
        // AI price implausible — blend with regional
        price = price > 0 ? Math.round(regionRef * 0.55 + price * 0.45) : regionRef;
        source = 'BLENDED';
      }

      const now = new Date();
      const entry: MarketDataEntry = {
        location,
        normalizedKey: key,
        pricePerM2:     price,
        priceMin:       data.priceMin  || price,
        priceMax:       data.priceMax  || price,
        confidence:     data.confidence,
        marketTrend:    data.trend,
        monthlyRentEstimate: data.rentMedian || undefined,
        source,
        fetchedAt:  now.toISOString(),
        expiresAt:  new Date(now.getTime() + SEED_TTL_MS).toISOString(),
        region:     regional.region,
        sourceCount: data.sourceCount,
        dataRecency: data.dataRecency,
        sampleNotes: `Seed: ${data.sourceCount} nguồn, ${data.dataRecency}`,
      };

      return this.storeEntry(key, entry);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429')) {
        this.markQuotaExhausted();
      }
      logger.warn(`[MarketData] Seed AI failed "${location}" — using regional table: ${err.message}`);
      return this.storeEntry(key, this.buildRegionalEntry(location, key));
    }
  }

  private buildRegionalEntry(location: string, key: string): MarketDataEntry {
    const regional = getRegionalBasePrice(location);
    const now = new Date();
    return {
      location,
      normalizedKey: key,
      pricePerM2:   regional.price,
      confidence:   regional.confidence,
      marketTrend:  'Bảng khu vực — cập nhật định kỳ',
      source:       'REGIONAL_TABLE',
      fetchedAt:    now.toISOString(),
      expiresAt:    new Date(now.getTime() + 2 * 3_600_000).toISOString(),
      region:       regional.region,
    };
  }

  private async storeEntry(key: string, entry: MarketDataEntry): Promise<MarketDataEntry> {
    // Sanity bounds
    if (entry.pricePerM2 < MIN_PRICE_VND || entry.pricePerM2 > MAX_PRICE_VND) {
      logger.warn(`[MarketData] Price out of range for "${entry.location}" (${entry.pricePerM2}) — falling back`);
      entry = this.buildRegionalEntry(entry.location, key);
    }

    // LRU eviction
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime())[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(key, entry);
    await this.saveToRedis(key, entry);

    logger.info(
      `[MarketData] Stored "${entry.location}" → ${(entry.pricePerM2 / 1_000_000).toFixed(0)} tr/m² `
      + `(conf: ${entry.confidence}%, src: ${entry.source})`
    );

    // ── Persist to market_price_history for self-learning ─────────────────
    // Only record AI, SEED, BLENDED prices — not the static regional table fallback
    if (entry.source !== 'REGIONAL_TABLE') {
      const sourceMap: Record<string, 'ai_search' | 'internal_comps' | 'blended' | 'manual'> = {
        AI: 'ai_search', SEED: 'ai_search', BLENDED: 'blended',
      };
      setImmediate(() =>
        priceCalibrationService.recordObservation({
          locationKey:     key,
          locationDisplay: entry.location,
          pricePerM2:      entry.pricePerM2,
          priceMin:        entry.priceMin,
          priceMax:        entry.priceMax,
          propertyType:    'townhouse_center',
          source:          sourceMap[entry.source] ?? 'ai_search',
          confidence:      entry.confidence,
          trendText:       entry.marketTrend?.slice(0, 100),
          sourceCount:     entry.sourceCount,
          dataRecency:     entry.dataRecency,
        }).catch(() => {})
      );
    }

    this.broadcastUpdate(entry);
    return entry;
  }

  private broadcastUpdate(entry: MarketDataEntry): void {
    if (!this.io) return;
    this.io.emit('market_index_updated', {
      location:    entry.location,
      pricePerM2:  entry.pricePerM2,
      priceMin:    entry.priceMin,
      priceMax:    entry.priceMax,
      confidence:  entry.confidence,
      marketTrend: entry.marketTrend,
      source:      entry.source,
      updatedAt:   entry.fetchedAt,
    });
  }

  private async refreshStaleEntries(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const stale = Array.from(this.cache.values())
      .filter(e => new Date(e.expiresAt) <= new Date());

    logger.info(`[MarketData] Background refresh: ${stale.length} stale entries`);

    for (const entry of stale) {
      try {
        await this.fetchAndCache(entry.location, entry.normalizedKey);
        await new Promise(r => setTimeout(r, 2_000));
      } catch (err: any) {
        logger.error(`[MarketData] Refresh failed for "${entry.location}": ${err.message}`);
      }
    }

    this.isRefreshing = false;
    logger.info('[MarketData] Background refresh complete');
  }
}

export const marketDataService = MarketDataService.getInstance();
