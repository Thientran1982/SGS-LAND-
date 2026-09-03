import type { Migration } from './runner';

const migration: Migration = {
  description: 'P0 agentic tasks: seed 20 task mau theo luong Lead->Hop dong cho tenant mac dinh, tao source_task_id_fk index va event hoa wf_tasks cho agent tools.',

  async up(client: any): Promise<void> {
    const tenantId = '00000000-0000-0000-0000-000000000001';

    // 1) Lay admin user lam created_by
    const adminRes = await client.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('SUPER_ADMIN','ADMIN') ORDER BY created_at LIMIT 1`,
      [tenantId],
    );
    const adminId = adminRes.rows[0]?.id || null;

    // 2) Seed 20 task mau: 4 nhom theo luong Lead -> Hop dong
    const seeds: Array<{ title: string; description: string; category: string; status: string; priority: string; days: number }> = [
      // Nhom 1: Tiep nhan & danh gia lead
      { title: 'Goi lai lead moi (khoang 30 phut tu khi nhan)', description: 'Lien he lai lead moi, xac nhan nhu cau mua/thue, ghi lai nguong gia va khu vuc quan tam.', category: 'sales', status: 'todo', priority: 'high', days: 1 },
      { title: 'Cham diem lead va phan loai (hot/warm/cold)', description: 'Dung bo cham diem lead de xac dinh muc do, sau do gan vao nhom cham soc tuong ung.', category: 'sales', status: 'todo', priority: 'medium', days: 2 },
      { title: 'Bo sung thong tin lien he va nguon lead', description: 'Kiem tra sdt/email bi thieu, cap nhat nguon (Zalo/Facebook/Web/San).', category: 'sales', status: 'todo', priority: 'low', days: 3 },
      { title: 'Lap ke hoach cham soc lead 7 ngay', description: 'Chuan bi chuoi hen: ngay 1 goi, ngay 3 gui BDS phu hop, ngay 7 goi lai.', category: 'sales', status: 'todo', priority: 'medium', days: 3 },
      // Nhom 2: Khao sat & tu van BĐS
      { title: 'Tim 3-5 BĐS phu hop nhu cau lead', description: 'Loc kho theo khu vuc, nguong gia, loai hinh; so sanh gia thi truong truoc khi de xuat.', category: 'sales', status: 'todo', priority: 'high', days: 2 },
      { title: 'Chuan bi ho so phap ly BĐS de xuat', description: 'Kiem tra so hong, quy hoach, rang buoc truoc khi dan diem cho khach.', category: 'legal', status: 'todo', priority: 'high', days: 4 },
      { title: 'Lap de xuat tu van (bao gia + phuong an thanh toan)', description: 'Soan de xuat gom gia, chi phi, phuong an vay, tien do thanh toan.', category: 'sales', status: 'in_progress', priority: 'high', days: 5 },
      { title: 'Hen lich xem BĐS cung khach', description: 'Chot lich xem nha, xac nhan dia diem tap, chunn bi lo trinh va loi nhac nhiet.', category: 'sales', status: 'todo', priority: 'high', days: 6 },
      { title: 'Chuan bi tai lieu so sanh BĐS truoc buoi xem nha', description: 'Bang so sanh 3 BĐS: gia, vi tri, phap ly, tien ich — de khach de ra quyet dinh.', category: 'sales', status: 'todo', priority: 'medium', days: 6 },
      // Nhom 3: Dam phan & chot deal
      { title: 'Chuan bi phuong an dam phan gia', description: 'Dinh gia muc chiet khau toi da da duyet, dieu kien thanh toan dac biet neu co.', category: 'sales', status: 'todo', priority: 'high', days: 8 },
      { title: 'Thu hoi hang hoa: xac nhan chu nha dong y dat coc', description: 'Lay xac nhan dat coc tu chu nha, cap nhat trang thai kho BĐS.', category: 'other', status: 'todo', priority: 'high', days: 9 },
      { title: 'Soan hop dong niem yet / dat coc', description: 'Dung mau hop dong chuan, kiem tra dieu khoan cot loi truoc khi trinh ky.', category: 'admin', status: 'todo', priority: 'high', days: 10 },
      { title: 'Trinh duyệt hợp đồng (team lead)', description: 'Trinh hop dong cho team lead duyet dieu khoan gia va phap ly truoc khach ky.', category: 'admin', status: 'todo', priority: 'high', days: 11 },
      { title: 'Thu phi giao dich va hoa hong theo ty le da duyệt', description: 'Ung phi giao dich, tinh hoa hong theo chinh sach hien hanh, trinh ke toan.', category: 'finance', status: 'todo', priority: 'medium', days: 12 },
      // Nhom 4: Sau ban & cham soc
      { title: 'Ho tro ho so sang name / chuyen nhuong', description: 'Ho tro khach chuan bi ho so sang name, theo doi tien do voi phap ly.', category: 'legal', status: 'todo', priority: 'medium', days: 14 },
      { title: 'Kiểm tra sau bán 3 ngay (goi hoi khach)', description: 'Goi cam on, hoi phan hoi sau ky hop dong, ghi lai van de can ho tro.', category: 'sales', status: 'todo', priority: 'low', days: 15 },
      { title: 'Mo loi hen cham soc sau ban 30 ngay', description: 'Tao nhiem vu nhac lai sau 30 ngay: hoi tinh hinh su dung, de xuat gioi thieu ban be.', category: 'sales', status: 'todo', priority: 'low', days: 30 },
      { title: 'Cap nhat lai thong tin khach sau giao dich', description: 'Chuyen lead sang trang thai DA MUA, cap nhat ghi chu mang tai san moi.', category: 'customer_care', status: 'todo', priority: 'medium', days: 16 },
      { title: 'Tong hop bai hoc ky vao Knowledge Base', description: 'Ghi lai khau nao cham, phat sinh gi — de CoE review dua vao SOP.', category: 'other', status: 'todo', priority: 'low', days: 21 },
      { title: 'Danh gia chat luong luong Lead->Hop dong (KPI)', description: 'Do thoi gian trung binh moi buoc, ti le lead->chot, so sanh chu ky truoc.', category: 'other', status: 'todo', priority: 'medium', days: 30 },
    ];

    let created = 0;
    for (const seed of seeds) {
      const dup = await client.query(
        `SELECT 1 FROM wf_tasks WHERE tenant_id = $1 AND title = $2 LIMIT 1`,
        [tenantId, seed.title],
      );
      if (dup.rows.length > 0) continue;
      await client.query(
        `INSERT INTO wf_tasks (tenant_id, title, description, category, status, priority, deadline, estimated_hours, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + $7::int, 1.5, $8)`,
        [tenantId, seed.title, seed.description, seed.category, seed.status, seed.priority, seed.days, adminId],
      );
      created += 1;
    }

    // 3) Event hoa: tao index ho tro truy van task theo tenant+status cho daemon
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wf_tasks_tenant_status ON wf_tasks(tenant_id, status)`);

    console.log(`[178] Seeded ${created} tasks (skipped ${seeds.length - created} duplicates)`);
  },
};

export default migration;
