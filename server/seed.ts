import bcrypt from 'bcrypt';
import { pool, withTenantContext } from './db';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SALT_ROUNDS = 12;

async function seed() {
  console.log('Starting database seed...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);

    const existingUsers = await client.query(`SELECT COUNT(*)::int as count FROM users`);
    if (existingUsers.rows[0].count > 0) {
      console.log('Database already seeded. Skipping.');
      await client.query('COMMIT');
      return;
    }

    console.log('Seeding users...');
    // Use SEED_PASSWORD env var; never default to a weak password in production
    const seedPassword = process.env.SEED_PASSWORD;
    if (!seedPassword) {
      throw new Error('SEED_PASSWORD environment variable is required. Set it to a strong password before seeding.');
    }
    const defaultHash = await bcrypt.hash(seedPassword, SALT_ROUNDS);

    const users = [
      { name: 'Admin SGS', email: 'admin@sgs.vn', hash: defaultHash, role: 'ADMIN', avatar: '' },
      { name: 'Nguyen Van Hieu', email: 'hieu@sgs.vn', hash: defaultHash, role: 'TEAM_LEAD', avatar: '' },
      { name: 'Tran Thi Mai', email: 'mai@sgs.vn', hash: defaultHash, role: 'SALES', avatar: '' },
      { name: 'Le Van Tuan', email: 'tuan@sgs.vn', hash: defaultHash, role: 'SALES', avatar: '' },
      { name: 'Pham Thi Lan', email: 'lan@sgs.vn', hash: defaultHash, role: 'SALES', avatar: '' },
      { name: 'Hoang Van Duc', email: 'duc@sgs.vn', hash: defaultHash, role: 'SALES', avatar: '' },
      { name: 'Vu Thi Huong', email: 'huong@sgs.vn', hash: defaultHash, role: 'MARKETING', avatar: '' },
      { name: 'Viewer Demo', email: 'viewer@sgs.vn', hash: defaultHash, role: 'VIEWER', avatar: '' },
    ];

    const userIds: string[] = [];
    for (const u of users) {
      const result = await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, avatar, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE') RETURNING id`,
        [TENANT_ID, u.name, u.email, u.hash, u.role, u.avatar]
      );
      userIds.push(result.rows[0].id);
    }
    console.log(`  Created ${userIds.length} users`);

    const salesUserIds = userIds.slice(2, 6);

    console.log('Seeding teams...');
    const teamResult = await client.query(
      `INSERT INTO teams (tenant_id, name, lead_id) VALUES ($1, 'Team Kinh Doanh 1', $2) RETURNING id`,
      [TENANT_ID, userIds[1]]
    );
    const teamId = teamResult.rows[0].id;
    for (const uid of salesUserIds) {
      await client.query(
        `INSERT INTO team_members (team_id, user_id, tenant_id) VALUES ($1, $2, $3)`,
        [teamId, uid, TENANT_ID]
      );
    }
    console.log('  Created 1 team with 4 members');

    console.log('Seeding leads...');
    const leadData = [
      { name: 'Nguyen Minh Tuan', phone: '0901234567', email: 'tuan.nm@gmail.com', source: 'FACEBOOK', stage: 'NEW', notes: 'Quan tam du an Vinhomes Grand Park Q9' },
      { name: 'Tran Thu Ha', phone: '0912345678', email: 'ha.tt@gmail.com', source: 'ZALO', stage: 'CONTACTED', notes: 'Tim can ho 2PN khu vuc Q2, ngan sach 3-4 ty' },
      { name: 'Le Hoang Nam', phone: '0923456789', email: 'nam.lh@gmail.com', source: 'WEBSITE', stage: 'QUALIFIED', notes: 'Dau tu dat nen Long An, can tu van phap ly' },
      { name: 'Pham Thi Thanh', phone: '0934567890', email: 'thanh.pt@gmail.com', source: 'REFERRAL', stage: 'PROPOSAL', notes: 'Da xem nha mau, quan tam can goc 3PN' },
      { name: 'Vo Van Khanh', phone: '0945678901', email: null, source: 'FACEBOOK', stage: 'NEGOTIATION', notes: 'Dang thuong luong gia, yeu cau chiet khau 5%' },
      { name: 'Dang Thi My', phone: '0956789012', email: 'my.dt@gmail.com', source: 'ZALO', stage: 'WON', notes: 'Da ky hop dong, thanh toan dot 1' },
      { name: 'Bui Van Phuc', phone: '0967890123', email: null, source: 'DIRECT', stage: 'LOST', notes: 'Khong du ngan sach, hen lai sau 6 thang' },
      { name: 'Ngo Thi Linh', phone: '0978901234', email: 'linh.nt@gmail.com', source: 'WEBSITE', stage: 'NEW', notes: 'Tim biet thu Q7, ngan sach 10-15 ty' },
      { name: 'Truong Van An', phone: '0989012345', email: 'an.tv@gmail.com', source: 'FACEBOOK', stage: 'CONTACTED', notes: 'Quan tam shophouse Phu My Hung' },
      { name: 'Ly Thi Hong', phone: '0990123456', email: 'hong.lt@gmail.com', source: 'ZALO', stage: 'QUALIFIED', notes: 'Mua dat xay nha, khu vuc Thu Duc' },
      { name: 'Cao Van Binh', phone: '0801234567', email: null, source: 'REFERRAL', stage: 'NEW', notes: 'Tim can ho studio cho thue' },
      { name: 'Do Thi Nga', phone: '0812345678', email: 'nga.dt@gmail.com', source: 'WEBSITE', stage: 'PROPOSAL', notes: 'Quan tam penthouse Masteri An Phu' },
      { name: 'Huynh Van Long', phone: '0823456789', email: null, source: 'FACEBOOK', stage: 'CONTACTED', notes: 'Dau tu can ho airbnb Q1' },
      { name: 'Mai Thi Diem', phone: '0834567890', email: 'diem.mt@gmail.com', source: 'DIRECT', stage: 'NEGOTIATION', notes: 'Mua 2 can lien ke, yeu cau gia tot' },
      { name: 'Tang Van Sy', phone: '0845678901', email: null, source: 'ZALO', stage: 'NEW', notes: 'Tim nha rieng Q.Binh Thanh' },
      { name: 'Chau Thi Kim', phone: '0856789012', email: 'kim.ct@gmail.com', source: 'WEBSITE', stage: 'QUALIFIED', notes: 'Tim can ho gan truong hoc cho con' },
      { name: 'Lam Van Hai', phone: '0867890123', email: null, source: 'REFERRAL', stage: 'CONTACTED', notes: 'CEO cong ty, tim VP ket hop nha o' },
      { name: 'Dinh Thi Yen', phone: '0878901234', email: 'yen.dt@gmail.com', source: 'FACEBOOK', stage: 'NEW', notes: 'Viet kieu, tim nha nghi duong Vung Tau' },
      { name: 'Luong Van Dat', phone: '0889012345', email: null, source: 'ZALO', stage: 'PROPOSAL', notes: 'Quan tam du an Celadon City Tan Phu' },
      { name: 'Trinh Thi Hoa', phone: '0890123456', email: 'hoa.tt@gmail.com', source: 'DIRECT', stage: 'WON', notes: 'Da chot can A-1205, thanh toan 70%' },
    ];

    const grades = ['A', 'B', 'C', 'D'];
    const leadIds: string[] = [];
    for (let i = 0; i < leadData.length; i++) {
      const l = leadData[i];
      const assignedTo = salesUserIds[i % salesUserIds.length];
      const scoreVal = Math.floor(Math.random() * 60) + 30;
      const grade = grades[Math.floor(scoreVal / 25)] || 'C';
      const score = { score: scoreVal, grade, reasoning: 'Auto-scored during seed' };

      const result = await client.query(
        `INSERT INTO leads (tenant_id, name, phone, email, source, stage, assigned_to, notes, score, tags, preferences)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [TENANT_ID, l.name, l.phone, l.email, l.source, l.stage, assignedTo, l.notes,
         JSON.stringify(score), '[]',
         JSON.stringify({ budget: { min: 2e9, max: 10e9 }, areas: ['Q2', 'Q7', 'Thu Duc'], propertyTypes: ['APARTMENT'] })]
      );
      leadIds.push(result.rows[0].id);
    }
    console.log(`  Created ${leadIds.length} leads`);

    console.log('Seeding listings...');
    const listingData = [
      { code: 'VGP-A1001', title: 'Can ho Vinhomes Grand Park 2PN', location: 'Q9, TP.HCM', price: 3200000000, area: 69, type: 'APARTMENT', bedrooms: 2, bathrooms: 2, status: 'AVAILABLE', direction: 'East', lat: 10.8498, lng: 106.7719 },
      { code: 'VGP-A2003', title: 'Can ho Vinhomes Grand Park 3PN', location: 'Q9, TP.HCM', price: 4800000000, area: 85, type: 'APARTMENT', bedrooms: 3, bathrooms: 2, status: 'AVAILABLE', direction: 'SouthEast', lat: 10.8512, lng: 106.7742 },
      { code: 'MAP-PH01', title: 'Penthouse Masteri An Phu', location: 'Q2, TP.HCM', price: 15000000000, area: 200, type: 'PENTHOUSE', bedrooms: 4, bathrooms: 3, status: 'AVAILABLE', direction: 'South', lat: 10.8029, lng: 106.7419 },
      { code: 'PMH-VL05', title: 'Biet thu Phu My Hung Q7', location: 'Q7, TP.HCM', price: 25000000000, area: 300, type: 'VILLA', bedrooms: 5, bathrooms: 4, status: 'AVAILABLE', direction: 'SouthEast', lat: 10.7341, lng: 106.7218 },
      { code: 'LAT-01', title: 'Dat nen Long An 100m2', location: 'Ben Luc, Long An', price: 1500000000, area: 100, type: 'LAND', bedrooms: 0, bathrooms: 0, status: 'AVAILABLE', direction: 'East', lat: 10.6485, lng: 106.4744 },
      { code: 'CLT-SH03', title: 'Shophouse Celadon City', location: 'Tan Phu, TP.HCM', price: 8500000000, area: 120, type: 'TOWNHOUSE', bedrooms: 0, bathrooms: 1, status: 'AVAILABLE', direction: 'NorthEast', lat: 10.7895, lng: 106.6216 },
      { code: 'TD-NR01', title: 'Nha rieng Thu Duc 4x15m', location: 'Thu Duc, TP.HCM', price: 5200000000, area: 60, type: 'HOUSE', bedrooms: 3, bathrooms: 2, status: 'AVAILABLE', direction: 'South', lat: 10.8677, lng: 106.7548 },
      { code: 'Q1-STD01', title: 'Studio Q1 cho thue', location: 'Q1, TP.HCM', price: 2800000000, area: 35, type: 'APARTMENT', bedrooms: 1, bathrooms: 1, status: 'AVAILABLE', direction: 'NorthWest', lat: 10.7769, lng: 106.7009 },
      { code: 'VT-BT01', title: 'Biet thu nghi duong Vung Tau', location: 'Vung Tau', price: 12000000000, area: 250, type: 'VILLA', bedrooms: 4, bathrooms: 3, status: 'HOLD', direction: 'East', lat: 10.3457, lng: 107.0843 },
      { code: 'BT-CH01', title: 'Can ho Binh Thanh 2PN', location: 'Binh Thanh, TP.HCM', price: 3500000000, area: 72, type: 'APARTMENT', bedrooms: 2, bathrooms: 2, status: 'AVAILABLE', direction: 'SouthEast', lat: 10.8017, lng: 106.7147 },
      { code: 'Q2-TH01', title: 'Nha pho lien ke Q2', location: 'Q2, TP.HCM', price: 9800000000, area: 100, type: 'TOWNHOUSE', bedrooms: 3, bathrooms: 3, status: 'AVAILABLE', direction: 'SouthWest', lat: 10.8042, lng: 106.7388 },
      { code: 'GV-CH01', title: 'Can ho Go Vap 1PN', location: 'Go Vap, TP.HCM', price: 1800000000, area: 45, type: 'APARTMENT', bedrooms: 1, bathrooms: 1, status: 'SOLD', direction: 'NorthWest', lat: 10.8352, lng: 106.6761 },
      { code: 'Q7-LP01', title: 'Office-tel Q7 Boulevard', location: 'Q7, TP.HCM', price: 2200000000, area: 40, type: 'OFFICE', bedrooms: 0, bathrooms: 1, status: 'AVAILABLE', direction: 'North', lat: 10.7412, lng: 106.7235 },
      { code: 'DAN-DT01', title: 'Dat nen Dong Nai 200m2', location: 'Bien Hoa, Dong Nai', price: 2000000000, area: 200, type: 'LAND', bedrooms: 0, bathrooms: 0, status: 'AVAILABLE', direction: 'East', lat: 10.9575, lng: 106.8427 },
      { code: 'MAP-2PN02', title: 'Can ho Masteri An Phu 2PN', location: 'Q2, TP.HCM', price: 4500000000, area: 75, type: 'APARTMENT', bedrooms: 2, bathrooms: 2, status: 'AVAILABLE', direction: 'SouthEast', lat: 10.8015, lng: 106.7401 },
    ];

    const listingIds: string[] = [];
    for (const li of listingData) {
      const result = await client.query(
        `INSERT INTO listings (tenant_id, code, title, location, price, currency, area, bedrooms, bathrooms, type, status, transaction, is_verified, created_by, attributes, coordinates)
         VALUES ($1, $2, $3, $4, $5, 'VND', $6, $7, $8, $9, $10, 'SALE', true, $11, $12, $13) RETURNING id`,
        [TENANT_ID, li.code, li.title, li.location, li.price, li.area, li.bedrooms, li.bathrooms, li.type, li.status, userIds[0],
         JSON.stringify({ direction: li.direction, legalStatus: 'PinkBook' }),
         JSON.stringify({ lat: li.lat, lng: li.lng })]
      );
      listingIds.push(result.rows[0].id);
    }
    console.log(`  Created ${listingIds.length} listings`);

    console.log('Seeding proposals...');
    const proposalData = [
      { leadIdx: 3, listingIdx: 0, discount: 0.05, status: 'APPROVED' },
      { leadIdx: 4, listingIdx: 1, discount: 0.08, status: 'PENDING_APPROVAL' },
      { leadIdx: 5, listingIdx: 2, discount: 0.03, status: 'APPROVED' },
      { leadIdx: 11, listingIdx: 2, discount: 0.12, status: 'PENDING_APPROVAL' },
      { leadIdx: 13, listingIdx: 10, discount: 0.04, status: 'APPROVED' },
      { leadIdx: 18, listingIdx: 5, discount: 0.06, status: 'SENT' },
      { leadIdx: 19, listingIdx: 9, discount: 0, status: 'APPROVED' },
    ];

    const proposalIds: string[] = [];
    for (const p of proposalData) {
      const listing = listingData[p.listingIdx];
      const basePrice = listing.price;
      const discountAmount = basePrice * p.discount;
      const finalPrice = basePrice - discountAmount;

      const result = await client.query(
        `INSERT INTO proposals (tenant_id, lead_id, listing_id, base_price, discount_amount, final_price, currency, status, token, created_by, created_by_id, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6, 'VND', $7, $8, $9, $10, NOW() + INTERVAL '30 days') RETURNING id`,
        [TENANT_ID, leadIds[p.leadIdx], listingIds[p.listingIdx], basePrice, discountAmount, finalPrice, p.status,
         `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`,
         users[0].name, userIds[0]]
      );
      proposalIds.push(result.rows[0].id);
    }
    console.log(`  Created ${proposalIds.length} proposals`);

    console.log('Seeding contracts...');
    const contractResult = await client.query(
      `INSERT INTO contracts (tenant_id, proposal_id, lead_id, listing_id, type, status, value, property_price, deposit_amount, created_by, party_a, party_b, property_details)
       VALUES ($1, $2, $3, $4, 'DEPOSIT', 'SIGNED', $5, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [TENANT_ID, proposalIds[2], leadIds[5], listingIds[2],
       listingData[2].price, listingData[2].price * 0.1, users[0].name,
       JSON.stringify({ name: 'Cong ty CP SGS Land', representative: 'Nguyen Van A', phone: '0901111111' }),
       JSON.stringify({ name: leadData[5].name, phone: leadData[5].phone }),
       JSON.stringify({ address: listingData[2].location, area: listingData[2].area, type: listingData[2].type })]
    );
    console.log('  Created 1 contract');

    console.log('Seeding interactions...');
    const channels = ['ZALO', 'FACEBOOK', 'INTERNAL', 'EMAIL'];
    let interactionCount = 0;
    for (let i = 0; i < Math.min(leadIds.length, 10); i++) {
      const msgCount = Math.floor(Math.random() * 5) + 2;
      for (let j = 0; j < msgCount; j++) {
        const isInbound = j % 2 === 0;
        const content = isInbound
          ? ['Cho toi xem them hinh anh du an', 'Gia co the thuong luong khong?', 'Khi nao co the xem nha mau?', 'Cam on, de toi suy nghi them'][j % 4]
          : ['Chao anh/chi, em gui hinh anh du an', 'Da, em gui bao gia chi tiet', 'Em sap xep lich hen xem nha mau nhe', 'Du, anh/chi can ho tro gi them khong?'][j % 4];
        
        await client.query(
          `INSERT INTO interactions (tenant_id, lead_id, channel, direction, type, content, status, sender_id, timestamp)
           VALUES ($1, $2, $3, $4, 'TEXT', $5, 'SENT', $6, NOW() - INTERVAL '${msgCount - j} hours')`,
          [TENANT_ID, leadIds[i], channels[i % channels.length],
           isInbound ? 'INBOUND' : 'OUTBOUND', content,
           isInbound ? null : salesUserIds[i % salesUserIds.length]]
        );
        interactionCount++;
      }
    }
    console.log(`  Created ${interactionCount} interactions`);

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
