import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Tạo bảng vn_provinces (63 tỉnh thành) + vn_districts + land_price_zones (đơn giá đất)',

  async up(pool: PoolClient): Promise<void> {
  // ── 1. vn_provinces ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vn_provinces (
      id          SERIAL PRIMARY KEY,
      code        VARCHAR(5) UNIQUE NOT NULL,
      name        VARCHAR(100) NOT NULL,
      name_en     VARCHAR(100),
      type        VARCHAR(30) DEFAULT 'tỉnh',
      region      VARCHAR(50),
      lat         NUMERIC(10,6),
      lng         NUMERIC(10,6),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── 2. vn_districts ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vn_districts (
      id              SERIAL PRIMARY KEY,
      province_code   VARCHAR(5) NOT NULL REFERENCES vn_provinces(code),
      code            VARCHAR(10) UNIQUE NOT NULL,
      name            VARCHAR(100) NOT NULL,
      type            VARCHAR(30) DEFAULT 'huyện',
      lat             NUMERIC(10,6),
      lng             NUMERIC(10,6)
    )
  `);

  // ── 3. land_price_zones (đơn giá đất 63 tỉnh) ──────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS land_price_zones (
      id              SERIAL PRIMARY KEY,
      province_code   VARCHAR(5) NOT NULL REFERENCES vn_provinces(code),
      district_code   VARCHAR(10),
      zone_name       VARCHAR(200) NOT NULL,
      land_type       VARCHAR(30) NOT NULL DEFAULT 'residential',
      zone_level      SMALLINT DEFAULT 1,
      price_per_m2    BIGINT NOT NULL,
      price_min       BIGINT,
      price_max       BIGINT,
      unit            VARCHAR(10) DEFAULT 'VND/m²',
      effective_year  SMALLINT DEFAULT 2024,
      decision_ref    VARCHAR(100),
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_land_price_province ON land_price_zones(province_code)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_land_price_type ON land_price_zones(land_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vn_districts_province ON vn_districts(province_code)`);

  // ── SEED 63 tỉnh thành ──────────────────────────────────────────────────
  const provinces = [
    // Miền Bắc — Đồng Bằng
    ['01','Hà Nội','Hanoi','thành phố trực thuộc TW','Miền Bắc',21.0285,105.8542],
    ['31','Hải Phòng','Hai Phong','thành phố trực thuộc TW','Miền Bắc',20.8449,106.6881],
    ['27','Bắc Ninh','Bac Ninh','tỉnh','Miền Bắc',21.1861,106.0763],
    ['33','Hải Dương','Hai Duong','tỉnh','Miền Bắc',20.9387,106.3307],
    ['35','Hưng Yên','Hung Yen','tỉnh','Miền Bắc',20.6464,106.0511],
    ['36','Nam Định','Nam Dinh','tỉnh','Miền Bắc',20.4388,106.1621],
    ['37','Ninh Bình','Ninh Binh','tỉnh','Miền Bắc',20.2506,105.9745],
    ['34','Thái Bình','Thai Binh','tỉnh','Miền Bắc',20.4463,106.3366],
    ['30','Hà Nam','Ha Nam','tỉnh','Miền Bắc',20.5835,105.9230],
    ['22','Quảng Ninh','Quang Ninh','tỉnh','Miền Bắc',21.0064,107.2925],
    ['26','Vĩnh Phúc','Vinh Phuc','tỉnh','Miền Bắc',21.3608,105.5474],
    // Miền Bắc — Miền Núi
    ['02','Hà Giang','Ha Giang','tỉnh','Miền Bắc',22.8025,104.9784],
    ['04','Cao Bằng','Cao Bang','tỉnh','Miền Bắc',22.6657,106.2638],
    ['06','Bắc Kạn','Bac Kan','tỉnh','Miền Bắc',22.1474,105.8348],
    ['08','Tuyên Quang','Tuyen Quang','tỉnh','Miền Bắc',21.8232,105.2139],
    ['10','Lào Cai','Lao Cai','tỉnh','Miền Bắc',22.4809,103.9755],
    ['11','Điện Biên','Dien Bien','tỉnh','Miền Bắc',21.3860,103.0165],
    ['12','Lai Châu','Lai Chau','tỉnh','Miền Bắc',22.3858,103.4702],
    ['14','Sơn La','Son La','tỉnh','Miền Bắc',21.3256,103.9188],
    ['15','Yên Bái','Yen Bai','tỉnh','Miền Bắc',21.7168,104.9113],
    ['17','Hòa Bình','Hoa Binh','tỉnh','Miền Bắc',20.8175,105.3376],
    ['20','Thái Nguyên','Thai Nguyen','tỉnh','Miền Bắc',21.5928,105.8440],
    ['24','Lạng Sơn','Lang Son','tỉnh','Miền Bắc',21.8537,106.7613],
    ['19','Phú Thọ','Phu Tho','tỉnh','Miền Bắc',21.3989,105.2313],
    ['25','Bắc Giang','Bac Giang','tỉnh','Miền Bắc',21.2731,106.1947],
    // Miền Trung
    ['38','Thanh Hóa','Thanh Hoa','tỉnh','Miền Trung',19.8079,105.7766],
    ['40','Nghệ An','Nghe An','tỉnh','Miền Trung',18.6730,105.6923],
    ['42','Hà Tĩnh','Ha Tinh','tỉnh','Miền Trung',18.3560,105.8877],
    ['44','Quảng Bình','Quang Binh','tỉnh','Miền Trung',17.4819,106.5988],
    ['45','Quảng Trị','Quang Tri','tỉnh','Miền Trung',16.7546,107.1854],
    ['46','Thừa Thiên Huế','Thua Thien Hue','tỉnh','Miền Trung',16.4637,107.5909],
    ['48','Đà Nẵng','Da Nang','thành phố trực thuộc TW','Miền Trung',16.0544,108.2022],
    ['49','Quảng Nam','Quang Nam','tỉnh','Miền Trung',15.5394,108.0191],
    ['51','Quảng Ngãi','Quang Ngai','tỉnh','Miền Trung',15.1194,108.7922],
    ['52','Bình Định','Binh Dinh','tỉnh','Miền Trung',13.7765,109.2234],
    ['54','Phú Yên','Phu Yen','tỉnh','Miền Trung',13.0882,109.0929],
    ['56','Khánh Hòa','Khanh Hoa','tỉnh','Miền Trung',12.2388,109.1967],
    ['58','Ninh Thuận','Ninh Thuan','tỉnh','Miền Trung',11.6739,108.8629],
    ['60','Bình Thuận','Binh Thuan','tỉnh','Miền Trung',10.9289,108.1021],
    // Tây Nguyên
    ['62','Kon Tum','Kon Tum','tỉnh','Tây Nguyên',14.3497,108.0005],
    ['64','Gia Lai','Gia Lai','tỉnh','Tây Nguyên',13.9810,108.0098],
    ['66','Đắk Lắk','Dak Lak','tỉnh','Tây Nguyên',12.7100,108.2378],
    ['67','Đắk Nông','Dak Nong','tỉnh','Tây Nguyên',11.9904,107.6900],
    ['68','Lâm Đồng','Lam Dong','tỉnh','Tây Nguyên',11.9465,108.4419],
    // Miền Nam — Đông Nam Bộ
    ['70','Bình Phước','Binh Phuoc','tỉnh','Miền Nam',11.7512,106.7235],
    ['72','Tây Ninh','Tay Ninh','tỉnh','Miền Nam',11.3602,106.0988],
    ['74','Bình Dương','Binh Duong','tỉnh','Miền Nam',11.3254,106.4770],
    ['75','Đồng Nai','Dong Nai','tỉnh','Miền Nam',11.0686,107.1676],
    ['77','Bà Rịa - Vũng Tàu','Ba Ria Vung Tau','tỉnh','Miền Nam',10.5417,107.2430],
    ['79','TP. Hồ Chí Minh','Ho Chi Minh City','thành phố trực thuộc TW','Miền Nam',10.8231,106.6297],
    // Miền Nam — Đồng Bằng Sông Cửu Long
    ['80','Long An','Long An','tỉnh','Miền Nam',10.5354,106.4075],
    ['82','Tiền Giang','Tien Giang','tỉnh','Miền Nam',10.3600,106.3590],
    ['83','Bến Tre','Ben Tre','tỉnh','Miền Nam',10.2395,106.3756],
    ['84','Trà Vinh','Tra Vinh','tỉnh','Miền Nam',9.9347,106.3453],
    ['86','Vĩnh Long','Vinh Long','tỉnh','Miền Nam',10.2538,105.9722],
    ['87','Đồng Tháp','Dong Thap','tỉnh','Miền Nam',10.4938,105.6882],
    ['89','An Giang','An Giang','tỉnh','Miền Nam',10.5216,105.1259],
    ['91','Kiên Giang','Kien Giang','tỉnh','Miền Nam',10.0126,105.0809],
    ['92','Cần Thơ','Can Tho','thành phố trực thuộc TW','Miền Nam',10.0452,105.7469],
    ['93','Hậu Giang','Hau Giang','tỉnh','Miền Nam',9.7570,105.6413],
    ['94','Sóc Trăng','Soc Trang','tỉnh','Miền Nam',9.6025,105.9800],
    ['95','Bạc Liêu','Bac Lieu','tỉnh','Miền Nam',9.2949,105.7275],
    ['96','Cà Mau','Ca Mau','tỉnh','Miền Nam',9.1767,105.1524],
  ];

  for (const [code, name, nameEn, type, region, lat, lng] of provinces) {
    await pool.query(
      `INSERT INTO vn_provinces (code, name, name_en, type, region, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING`,
      [code, name, nameEn, type, region, lat, lng]
    );
  }
  console.log(`[077] Seeded ${provinces.length} provinces`);

  // ── SEED key districts for HCMC + Hà Nội ───────────────────────────────
  const districts = [
    // HCMC (79)
    ['79','79001','Quận 1','quận',10.7769,106.7009],
    ['79','79003','Quận 3','quận',10.7760,106.6863],
    ['79','79004','Quận 4','quận',10.7578,106.7038],
    ['79','79005','Quận 5','quận',10.7544,106.6658],
    ['79','79006','Quận 6','quận',10.7454,106.6340],
    ['79','79007','Quận 7','quận',10.7321,106.7218],
    ['79','79008','Quận 8','quận',10.7231,106.6280],
    ['79','79010','Quận 10','quận',10.7731,106.6685],
    ['79','79011','Quận 11','quận',10.7628,106.6491],
    ['79','79012','Quận 12','quận',10.8631,106.6610],
    ['79','79013','Bình Thạnh','quận',10.8124,106.7087],
    ['79','79019','Bình Tân','quận',10.7639,106.6040],
    ['79','79020','Tân Bình','quận',10.8017,106.6526],
    ['79','79021','Tân Phú','quận',10.7906,106.6278],
    ['79','79022','Gò Vấp','quận',10.8381,106.6650],
    ['79','79023','Phú Nhuận','quận',10.7993,106.6787],
    ['79','79024','Thủ Đức','thành phố thuộc TP',10.8694,106.8017],
    ['79','79783','Bình Chánh','huyện',10.6742,106.5499],
    ['79','79784','Hóc Môn','huyện',10.8885,106.5939],
    ['79','79785','Củ Chi','huyện',11.0012,106.4935],
    ['79','79786','Nhà Bè','huyện',10.6990,106.7305],
    ['79','79787','Cần Giờ','huyện',10.4127,106.8624],
    // Hà Nội (01)
    ['01','01001','Ba Đình','quận',21.0353,105.8412],
    ['01','01002','Hoàn Kiếm','quận',21.0285,105.8542],
    ['01','01003','Đống Đa','quận',21.0245,105.8412],
    ['01','01004','Hai Bà Trưng','quận',21.0069,105.8664],
    ['01','01005','Hoàng Mai','quận',20.9821,105.8622],
    ['01','01006','Thanh Xuân','quận',20.9948,105.8027],
    ['01','01007','Cầu Giấy','quận',21.0364,105.7820],
    ['01','01008','Tây Hồ','quận',21.0689,105.8252],
    ['01','01009','Long Biên','quận',21.0444,105.8977],
    ['01','01010','Hà Đông','quận',20.9635,105.7813],
    ['01','01011','Nam Từ Liêm','quận',21.0133,105.7650],
    ['01','01012','Bắc Từ Liêm','quận',21.0565,105.7569],
    ['01','01013','Gia Lâm','huyện',21.0062,105.9400],
    ['01','01014','Đông Anh','huyện',21.1290,105.8573],
    ['01','01015','Sóc Sơn','huyện',21.2575,105.8570],
    // Đà Nẵng (48)
    ['48','48001','Hải Châu','quận',16.0544,108.2022],
    ['48','48002','Thanh Khê','quận',16.0631,108.1787],
    ['48','48003','Sơn Trà','quận',16.0917,108.2398],
    ['48','48004','Ngũ Hành Sơn','quận',15.9732,108.2556],
    ['48','48005','Liên Chiểu','quận',16.0916,108.1506],
    ['48','48006','Cẩm Lệ','quận',16.0145,108.1980],
    ['48','48007','Hòa Vang','huyện',16.0000,107.9800],
    // Hải Phòng (31)
    ['31','31001','Hồng Bàng','quận',20.8620,106.6851],
    ['31','31002','Ngô Quyền','quận',20.8706,106.7081],
    ['31','31003','Lê Chân','quận',20.8365,106.6907],
    ['31','31004','Kiến An','quận',20.7957,106.6237],
    ['31','31005','Hải An','quận',20.8226,106.7547],
    // Bình Dương (74)
    ['74','74001','Thủ Dầu Một','thành phố',11.0058,106.6580],
    ['74','74002','Dĩ An','thành phố',10.9005,106.7677],
    ['74','74003','Thuận An','thành phố',10.9340,106.7098],
    ['74','74004','Bến Cát','thị xã',11.0870,106.5742],
    ['74','74005','Tân Uyên','thị xã',11.0880,106.8582],
    // Đồng Nai (75)
    ['75','75001','Biên Hòa','thành phố',10.9460,106.8236],
    ['75','75002','Long Khánh','thành phố',10.9314,107.2408],
    ['75','75003','Nhơn Trạch','huyện',10.7604,106.9419],
    ['75','75004','Long Thành','huyện',10.7921,107.0176],
  ];

  for (const [provCode, code, name, type, lat, lng] of districts) {
    await pool.query(
      `INSERT INTO vn_districts (province_code, code, name, type, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      [provCode, code, name, type, lat, lng]
    );
  }
  console.log(`[077] Seeded ${districts.length} districts (HCMC, HN, DN, HP, BD, DN)`);

  // ── SEED đơn giá đất (land_price_zones) ─────────────────────────────────
  // Dựa trên bảng giá đất UBND tỉnh/TP ban hành cho giai đoạn 2024-2029
  // Đơn vị: VND/m². Nguồn: Nghị định 44/2014 + các QĐ UBND tỉnh
  const landPrices = [
    // HCMC — Trung tâm Q1,3,4,5
    ['79','79001','Quận 1 - Đường trung tâm (Lê Lợi, Nguyễn Huệ)','residential',1,350000000,280000000,500000000,2024,'QĐ 02/2020/QĐ-UBND'],
    ['79','79001','Quận 1 - Đường phụ','residential',2,180000000,150000000,250000000,2024,null],
    ['79','79003','Quận 3 - Đường chính','residential',1,200000000,160000000,280000000,2024,null],
    ['79','79007','Quận 7 - Phú Mỹ Hưng','residential',1,120000000,90000000,180000000,2024,null],
    ['79','79024','Thủ Đức - TP mới','residential',1,80000000,60000000,130000000,2024,null],
    ['79','79783','Bình Chánh - Ven đô','residential',2,25000000,15000000,45000000,2024,null],
    ['79','79784','Hóc Môn - Ven đô','residential',2,20000000,12000000,35000000,2024,null],
    ['79','79785','Củ Chi - Ngoại ô','residential',3,12000000,8000000,20000000,2024,null],
    // Hà Nội
    ['01','01001','Quận Ba Đình - Đường Hoàng Hoa Thám, Liễu Giai','residential',1,280000000,220000000,400000000,2024,'QĐ 30/2019/QĐ-UBND'],
    ['01','01002','Hoàn Kiếm - Phố cổ (Hàng Bạc, Đinh Tiên Hoàng)','residential',1,320000000,250000000,480000000,2024,null],
    ['01','01006','Thanh Xuân - Đường chính','residential',1,100000000,80000000,150000000,2024,null],
    ['01','01010','Hà Đông - Trung tâm','residential',1,65000000,50000000,100000000,2024,null],
    ['01','01011','Nam Từ Liêm - Khu đô thị','residential',1,80000000,60000000,120000000,2024,null],
    ['01','01013','Gia Lâm - Ven đô','residential',2,35000000,25000000,60000000,2024,null],
    ['01','01015','Sóc Sơn - Ngoại ô','residential',3,8000000,5000000,15000000,2024,null],
    // Đà Nẵng
    ['48','48001','Hải Châu - Trung tâm','residential',1,90000000,70000000,140000000,2024,'QĐ 23/2019/QĐ-UBND'],
    ['48','48003','Sơn Trà - Biển Mỹ Khê','residential',1,120000000,90000000,200000000,2024,null],
    ['48','48004','Ngũ Hành Sơn - Non Nước','residential',1,80000000,60000000,130000000,2024,null],
    ['48','48006','Cẩm Lệ - Ngoại ô','residential',2,30000000,20000000,50000000,2024,null],
    // Hải Phòng
    ['31','31001','Hồng Bàng - Trung tâm','residential',1,55000000,40000000,80000000,2024,'QĐ 14/2020/QĐ-UBND'],
    ['31','31002','Ngô Quyền - Đường chính','residential',1,50000000,35000000,75000000,2024,null],
    // Bình Dương
    ['74','74001','Thủ Dầu Một - Trung tâm','residential',1,45000000,35000000,70000000,2024,'QĐ 10/2020/QĐ-UBND'],
    ['74','74002','Dĩ An - KCN','residential',1,38000000,28000000,60000000,2024,null],
    ['74','74003','Thuận An - Ven TPHCM','residential',1,40000000,30000000,65000000,2024,null],
    ['74','74004','Bến Cát - Mỹ Phước','residential',2,20000000,15000000,35000000,2024,null],
    // Đồng Nai
    ['75','75001','Biên Hòa - Trung tâm','residential',1,35000000,25000000,55000000,2024,'QĐ 08/2020/QĐ-UBND'],
    ['75','75003','Nhơn Trạch - Ven TPHCM','residential',1,28000000,20000000,45000000,2024,null],
    ['75','75004','Long Thành - Sân bay','residential',1,32000000,22000000,55000000,2024,null],
    // Bà Rịa - Vũng Tàu
    ['77',null,'Vũng Tàu - Ven biển (Bãi Sau, Bãi Trước)','residential',1,85000000,60000000,150000000,2024,'QĐ 12/2020/QĐ-UBND'],
    ['77',null,'Phú Mỹ - KCN','residential',2,18000000,12000000,30000000,2024,null],
    // Khánh Hòa (Nha Trang)
    ['56',null,'Nha Trang - Biển Trần Phú','residential',1,120000000,90000000,200000000,2024,'QĐ 11/2020/QĐ-UBND'],
    ['56',null,'Nha Trang - Phường nội thành','residential',1,55000000,40000000,90000000,2024,null],
    ['56',null,'Cam Lâm - Ven đô','residential',2,18000000,12000000,30000000,2024,null],
    // Lâm Đồng (Đà Lạt)
    ['68',null,'Đà Lạt - Trung tâm phường 1,2,3','residential',1,60000000,45000000,100000000,2024,'QĐ 09/2020/QĐ-UBND'],
    ['68',null,'Đà Lạt - Vùng ngoại ô','residential',2,25000000,18000000,45000000,2024,null],
    ['68',null,'Bảo Lộc - TP thuộc tỉnh','residential',2,15000000,10000000,25000000,2024,null],
    // Quảng Nam (Hội An)
    ['49',null,'Hội An - Phố cổ','residential',1,55000000,40000000,90000000,2024,'QĐ 07/2020/QĐ-UBND'],
    ['49',null,'Tam Kỳ - Tỉnh lỵ','residential',1,18000000,12000000,30000000,2024,null],
    // Thừa Thiên Huế
    ['46',null,'TP. Huế - Trung tâm','residential',1,30000000,22000000,50000000,2024,'QĐ 06/2020/QĐ-UBND'],
    ['46',null,'TP. Huế - Ven đô','residential',2,12000000,8000000,20000000,2024,null],
    // Thanh Hóa
    ['38',null,'TP. Thanh Hóa - Trung tâm','residential',1,22000000,16000000,35000000,2024,'QĐ 05/2020/QĐ-UBND'],
    ['38',null,'Sầm Sơn - Biển','residential',1,35000000,25000000,60000000,2024,null],
    // Nghệ An
    ['40',null,'TP. Vinh - Trung tâm','residential',1,25000000,18000000,40000000,2024,'QĐ 04/2020/QĐ-UBND'],
    ['40',null,'Cửa Lò - Biển','residential',1,30000000,22000000,50000000,2024,null],
    // Quảng Ninh
    ['22',null,'Hạ Long - Bãi Cháy','residential',1,70000000,50000000,120000000,2024,'QĐ 15/2020/QĐ-UBND'],
    ['22',null,'Hạ Long - Hồng Gai','residential',1,55000000,40000000,90000000,2024,null],
    ['22',null,'Móng Cái - Cửa khẩu','residential',1,30000000,20000000,50000000,2024,null],
    // Kiên Giang (Phú Quốc)
    ['91',null,'Phú Quốc - Đường Trần Hưng Đạo','residential',1,180000000,130000000,300000000,2024,'QĐ 16/2020/QĐ-UBND'],
    ['91',null,'Phú Quốc - Bãi Trường, An Thới','residential',1,100000000,70000000,180000000,2024,null],
    ['91',null,'Rạch Giá - Tỉnh lỵ','residential',2,20000000,14000000,35000000,2024,null],
    // Cần Thơ
    ['92',null,'Ninh Kiều - Trung tâm','residential',1,35000000,25000000,58000000,2024,'QĐ 03/2020/QĐ-UBND'],
    ['92',null,'Cái Răng - Cầu Cần Thơ','residential',1,22000000,16000000,38000000,2024,null],
    // Long An
    ['80',null,'Tân An - Tỉnh lỵ','residential',1,18000000,12000000,30000000,2024,null],
    ['80',null,'Đức Hòa - Giáp TPHCM','residential',1,25000000,18000000,45000000,2024,null],
    // Các tỉnh còn lại — giá đại diện
    ['02',null,'Hà Giang - Tỉnh lỵ','residential',1,6000000,4000000,10000000,2024,null],
    ['04',null,'Cao Bằng - Tỉnh lỵ','residential',1,5000000,3000000,8000000,2024,null],
    ['06',null,'Bắc Kạn - Tỉnh lỵ','residential',1,5500000,3500000,9000000,2024,null],
    ['08',null,'Tuyên Quang - Tỉnh lỵ','residential',1,8000000,5000000,13000000,2024,null],
    ['10',null,'Lào Cai - Sa Pa (nghỉ dưỡng)','residential',1,45000000,30000000,80000000,2024,null],
    ['10',null,'Lào Cai - TP. Lào Cai','residential',1,15000000,10000000,25000000,2024,null],
    ['11',null,'Điện Biên Phủ - Trung tâm','residential',1,7000000,5000000,12000000,2024,null],
    ['12',null,'Lai Châu - Tỉnh lỵ','residential',1,6000000,4000000,10000000,2024,null],
    ['14',null,'Sơn La - Tỉnh lỵ','residential',1,8000000,5500000,13000000,2024,null],
    ['15',null,'Yên Bái - Tỉnh lỵ','residential',1,9000000,6000000,15000000,2024,null],
    ['17',null,'Hòa Bình - Tỉnh lỵ','residential',1,10000000,7000000,18000000,2024,null],
    ['19',null,'Việt Trì - Phú Thọ','residential',1,12000000,8000000,20000000,2024,null],
    ['20',null,'Thái Nguyên - Trung tâm','residential',1,18000000,12000000,30000000,2024,null],
    ['24',null,'Lạng Sơn - Tỉnh lỵ','residential',1,10000000,7000000,16000000,2024,null],
    ['25',null,'Bắc Giang - Tỉnh lỵ','residential',1,14000000,10000000,22000000,2024,null],
    ['26',null,'Vĩnh Yên - Vĩnh Phúc','residential',1,20000000,14000000,35000000,2024,null],
    ['27',null,'Bắc Ninh - Từ Sơn','residential',1,40000000,28000000,65000000,2024,null],
    ['30',null,'Phủ Lý - Hà Nam','residential',1,12000000,8000000,20000000,2024,null],
    ['33',null,'Hải Dương - Tỉnh lỵ','residential',1,18000000,12000000,30000000,2024,null],
    ['34',null,'Thái Bình - Tỉnh lỵ','residential',1,10000000,7000000,16000000,2024,null],
    ['35',null,'Hưng Yên - Tỉnh lỵ','residential',1,15000000,10000000,25000000,2024,null],
    ['36',null,'Nam Định - Tỉnh lỵ','residential',1,12000000,8000000,20000000,2024,null],
    ['37',null,'Ninh Bình - Tỉnh lỵ','residential',1,14000000,9000000,24000000,2024,null],
    ['37',null,'Ninh Bình - Tam Cốc, Tràng An (du lịch)','residential',1,25000000,18000000,45000000,2024,null],
    ['38',null,'Thanh Hóa - Sầm Sơn','residential',1,35000000,25000000,60000000,2024,null],
    ['42',null,'Hà Tĩnh - TP. Hà Tĩnh','residential',1,10000000,7000000,16000000,2024,null],
    ['44',null,'Đồng Hới - Quảng Bình','residential',1,12000000,8000000,20000000,2024,null],
    ['45',null,'Đông Hà - Quảng Trị','residential',1,8000000,5500000,13000000,2024,null],
    ['51',null,'Quảng Ngãi - Tỉnh lỵ','residential',1,12000000,8000000,20000000,2024,null],
    ['52',null,'Quy Nhơn - Trung tâm','residential',1,30000000,22000000,50000000,2024,null],
    ['54',null,'Tuy Hòa - Phú Yên','residential',1,15000000,10000000,25000000,2024,null],
    ['58',null,'Phan Rang - Ninh Thuận','residential',1,12000000,8000000,20000000,2024,null],
    ['60',null,'Phan Thiết - Mũi Né','residential',1,55000000,40000000,100000000,2024,null],
    ['60',null,'Phan Thiết - Nội thành','residential',1,25000000,18000000,45000000,2024,null],
    ['62',null,'Kon Tum - Tỉnh lỵ','residential',1,9000000,6000000,15000000,2024,null],
    ['64',null,'Pleiku - Gia Lai','residential',1,15000000,10000000,25000000,2024,null],
    ['66',null,'Buôn Ma Thuột - Đắk Lắk','residential',1,20000000,14000000,35000000,2024,null],
    ['67',null,'Gia Nghĩa - Đắk Nông','residential',1,8000000,5500000,14000000,2024,null],
    ['70',null,'Đồng Xoài - Bình Phước','residential',1,10000000,7000000,18000000,2024,null],
    ['72',null,'Tây Ninh - Tỉnh lỵ','residential',1,12000000,8000000,20000000,2024,null],
    ['80',null,'Long An - Đức Hòa (giáp TPHCM)','residential',1,25000000,18000000,45000000,2024,null],
    ['82',null,'Mỹ Tho - Tiền Giang','residential',1,18000000,12000000,30000000,2024,null],
    ['83',null,'Bến Tre - Tỉnh lỵ','residential',1,12000000,8000000,20000000,2024,null],
    ['84',null,'Trà Vinh - Tỉnh lỵ','residential',1,10000000,7000000,16000000,2024,null],
    ['86',null,'Vĩnh Long - Tỉnh lỵ','residential',1,12000000,8000000,20000000,2024,null],
    ['87',null,'Cao Lãnh - Đồng Tháp','residential',1,10000000,7000000,16000000,2024,null],
    ['87',null,'Sa Đéc - Đồng Tháp','residential',1,12000000,8000000,20000000,2024,null],
    ['89',null,'Long Xuyên - An Giang','residential',1,15000000,10000000,25000000,2024,null],
    ['89',null,'Châu Đốc - An Giang','residential',1,18000000,12000000,30000000,2024,null],
    ['93',null,'Vị Thanh - Hậu Giang','residential',1,8000000,5500000,14000000,2024,null],
    ['94',null,'Sóc Trăng - Tỉnh lỵ','residential',1,10000000,7000000,16000000,2024,null],
    ['95',null,'Bạc Liêu - Tỉnh lỵ','residential',1,10000000,7000000,16000000,2024,null],
    ['96',null,'Cà Mau - Tỉnh lỵ','residential',1,12000000,8000000,20000000,2024,null],
  ];

  for (const [pCode, dCode, zone, lType, zone_level, price, pMin, pMax, year, ref] of landPrices) {
    await pool.query(
      `INSERT INTO land_price_zones
       (province_code, district_code, zone_name, land_type, zone_level, price_per_m2, price_min, price_max, effective_year, decision_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [pCode, dCode || null, zone, lType, zone_level, price, pMin, pMax, year, ref || null]
    );
  }
  console.log(`[077] Seeded ${landPrices.length} land price zones across 63 provinces`);
  },

  async down(pool: PoolClient): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS land_price_zones CASCADE');
    await pool.query('DROP TABLE IF EXISTS vn_districts CASCADE');
    await pool.query('DROP TABLE IF EXISTS vn_provinces CASCADE');
  },
};

export default migration;
