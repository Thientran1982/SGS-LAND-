import { indexDocument } from './services/ragService';
import { DEFAULT_TENANT_ID } from './constants';

type Doc = { domain: string; id: string; title: string; content: string; category: string };

const DOCS: Doc[] = [];
function add(domain: string, id: string, category: string, title: string, content: string) {
  DOCS.push({ domain, id, category, title, content: content.trim() });
}

add('legal','kb_legal_so_do_so_hong','giay_to','Phan biet So do, So hong va quyen giao dich', `
SO HONG RIENG (GCN QSDD + QSH nha o dung ten mot chu): la muc an toan phap ly cao nhat. Quyen day du: mua ban, the chap vay ngan hang, tang cho, thua ke. Rui ro con lai chi la kiem tra tinh trang the chap, tranh chap, quy hoach truoc khi giao dich.
SO DO (GCN QSDD - dat o hoac dat nong nghiep): Dat o co quyen tuong duong so hong. Dat nong nghiep can chuyen muc dich su dung sang dat o truoc khi xay nha - phai kiem tra muc dich su dung ghi trong so va quy hoach dia phuong.
SO HONG CHUNG (nhieu chu so huu): moi giao dich BAT BUOC co chu ky cua TAT CA dong so huu. Rui ro cao neu mot dong so huu khong dong y. Nen tach so hoac lam vi bang thoa thuan phan chia truoc khi mua.
LUU Y: luon doi chieu thong tin trong so voi thuc dia va quy hoach 1/500 tai UBND/Phong Tai nguyen Moi truong dia phuong.
`);

add('legal','kb_legal_vi_bang_giay_tay','rui_ro','Mua ban bang vi bang va giay tay - rui ro phap ly', `
VI BANG do Thua phat lai lap CHI la van ban ghi nhan su kien, hanh vi co that (viec giao tien, ban giao nha) - KHONG phai hop dong co cong chung va KHONG co gia tri chuyen quyen so huu. Vi bang khong thay the hop dong mua ban cong chung.
MUA GIAY TAY (khong cong chung): khong duoc phap luat bao ve day du, rui ro tranh chap cao, khong the sang ten so. Chi nen xem la giai phap tam thoi va can chuyen sang cong chung cang som cang tot.
CANH BAO: neu ben ban chi co vi bang hoac giay tay, phai canh bao khach ve rui ro va khuyen nghi tham van luat su / Van phong Dang ky Dat dai truoc khi xuong tien.
`);

add('legal','kb_legal_nguoi_nuoc_ngoai','so_huu','Quyen so huu nha o cua nguoi nuoc ngoai', `
Nguoi nuoc ngoai duoc so huu nha o tai Viet Nam theo Luat Nha O, nhung co gioi han: chi duoc so huu can ho/nha o trong du an thuong mai duoc phep ban cho nguoi nuoc ngoai; co gioi han ty le so luong can trong mot toa/khu vuc; thoi han so huu thuong la 50 nam co the gia han. Khong duoc so huu nha gan khu vuc an ninh quoc phong.
Can xac minh du an co nam trong danh muc duoc phep ban cho nguoi nuoc ngoai va ty le con lai truoc khi tu van.
`);

add('legal','kb_legal_khung_luat_2024','luat','Khung phap ly BDS moi nhat (hieu luc 2024)', `
Ba luat quan trong nhat dieu chinh giao dich BDS, cung hieu luc tu 01/08/2024, thay the cac quy dinh cu cung ten:
- Luat Dat dai 2024: quy dinh ve quyen su dung dat, bang gia dat, boi thuong, chuyen muc dich su dung.
- Luat Nha o 2023: quy dinh so huu nha, so huu cua nguoi nuoc ngoai, nha chung cu.
- Luat Kinh doanh BDS 2023: quy dinh dieu kien ban nha hinh thanh trong tuong lai, dat coc, bao lanh ngan hang, thanh toan theo tien do.
NGUYEN TAC: khi tra loi phap ly luon ghi ro luat va nam hieu luc; KHONG ap dung luat cu cho giao dich phat sinh sau ngay hieu luc; neu chua chac chan, khuyen khach hoi Van phong Dang ky Dat dai hoac luat su.
`);

add('legal','kb_legal_thue_phi_sang_ten','thue_phi','Thue va phi khi chuyen nhuong BDS', `
Khi chuyen nhuong BDS, cac khoan thue phi pho bien:
- Thue thu nhap ca nhan: thong thuong 2% tren gia chuyen nhuong (ben ban chiu, tru truong hop mien nhu chuyen nhuong nha o duy nhat theo dieu kien luat dinh).
- Le phi truoc ba: 0,5% tren gia tri BDS (ben mua chiu khi sang ten).
- Phi cong chung: tinh theo bieu phi luy tien tren gia tri hop dong.
- Phi tham dinh, phi cap doi so, phi do dac neu co.
LUU Y: cac muc tren la thong le pho bien; con so cu the phu thuoc bang gia dat va thoi diem - can xac minh tai co quan thue/cong chung. KHONG khang dinh so tuyet doi neu chua co du lieu chinh thuc.
`);

add('legal','kb_legal_quy_trinh_sang_ten','quy_trinh','Quy trinh cong chung va sang ten BDS', `
Quy trinh chuan chuyen nhuong BDS co so:
1. Kiem tra phap ly: so that, khong tranh chap, khong the chap (hoac giai chap), dung quy hoach.
2. Dat coc / thoa thuan: lap hop dong dat coc ro dieu kien, so tien, thoi han.
3. Cong chung hop dong mua ban tai Van phong cong chung (co mat hai ben, CMND/CCCD, so goc).
4. Ke khai va nop thue TNCN + le phi truoc ba tai co quan thue.
5. Nop ho so sang ten tai Van phong Dang ky Dat dai, nhan so moi dung ten ben mua.
Thoi gian sang ten thong thuong 15-30 ngay lam viec tuy dia phuong.
`);

add('finance','kb_fin_pmt_tra_gop','cong_thuc','Cong thuc tra gop PMT va lich amortization', `
Cong thuc tra gop deu hang thang (annuity):
PMT = P x r x (1+r)^n / ((1+r)^n - 1)
Trong do: P = so tien vay goc; r = lai suat nam / 12 (lai suat thang); n = so thang vay.
Lam tron ket qua den 100.000 VND cho de doc.
Bang sanity-check nhanh (lai 8%/nam):
- Vay 1 ty, 20 nam: khoang 8,4 tr/thang
- Vay 1 ty, 15 nam: khoang 9,6 tr/thang
- Vay 1 ty, 25 nam: khoang 7,7 tr/thang
Lich amortization: thang dau tra lai nhieu goc it; cang ve sau ty le goc tang dan. Tong lai phai tra = tong PMT x so thang - goc ban dau.
`);

add('finance','kb_fin_ltv_dti','chi_so','Chi so LTV va DTI - kha nang vay an toan', `
LTV (Loan-to-Value) = so tien vay / gia tri tai san. Nguong an toan pho bien: LTV <= 70%, tuc khach nen co san >= 30% gia tri BDS. Nhieu ngan hang cho vay toi 70-85% nhung LTV cang cao rui ro cang lon.
DTI (Debt-to-Income) = tong nghia vu tra no hang thang / thu nhap hang thang. Nguong an toan: DTI <= 40-50%. Neu khoan tra gop vuot qua nua thu nhap thi rui ro tai chinh cao, khong nen khuyen khach vay them.
Khi tu van: hoi thu nhap va no hien tai de uoc luong DTI truoc khi de xuat khoan vay. Luon nhac khach chua tinh chi phi sinh hoat va du phong.
`);

add('finance','kb_fin_lai_suat','lai_suat','Lai suat co dinh, tha noi va bien do', `
LAI SUAT UU DAI: nhieu ngan hang ap lai suat thap trong 6-24 thang dau (giai doan co dinh), sau do chuyen sang tha noi.
LAI SUAT THA NOI = lai suat co so (hoac lai suat tiet kiem 12-13 thang) + BIEN DO (thuong 3-4%/nam). Khach can hieu sau uu dai lai suat co the tang dang ke.
NGUYEN TAC TU VAN: luon tinh ca kich ban lai suat sau uu dai (tha noi) de khach khong bat ngo. KHONG chi quang cao lai suat uu dai thap. Ghi ro: lai suat tham khao - can xac minh voi ngan hang truoc khi ky hop dong tin dung.
`);

add('finance','kb_fin_true_cost','chi_phi','Chi phi thuc te (True Cost) cua khoan vay', `
Tong chi phi thuc te cua mot khoan vay khong chi la so tien vay:
True Cost = (Tong PMT x so thang - goc) [tong lai] + bao hiem khoan vay + phi tham dinh + phi phat tra no truoc han (neu tra som) + phi cong chung the chap.
VI DU minh hoa: vay 2 ty, 20 nam, lai binh quan 10%/nam thi tong lai phai tra co the xap xi bang chinh so tien goc vay ban dau.
BAO HIEM KHOAN VAY va PHI PHAT TRA TRUOC HAN thuong bi bo qua nhung anh huong lon. Luon trinh bay tong chi phi de khach thay buc tranh day du, KHONG to hong de chot deal.
`);

add('market','kb_mkt_dinh_gia','dinh_gia','Cac phuong phap dinh gia BDS', `
Ba phuong phap dinh gia BDS pho bien:
1. PHUONG PHAP SO SANH: lay gia cac BDS tuong dong (cung khu vuc, dien tich, phap ly, thoi diem) da giao dich gan day de suy ra gia. Phuong phap chinh cho nha o, dat nen.
2. PHUONG PHAP THU NHAP: dinh gia dua tren dong tien cho thue tuong lai (phu hop BDS dau tu cho thue, thuong mai). Gia = thu nhap thue rong / ty suat von hoa.
3. PHUONG PHAP CHI PHI: gia tri = gia dat + chi phi xay dung thay the - khau hao. Phu hop tai san dac thu it giao dich.
Khi thieu du lieu giao dich thuc, dung benchmark khu vuc va ghi ro day la uoc tinh tham khao - chua xac minh thuc te.
`);

add('market','kb_mkt_yield','chi_so','Gross Yield va Price-to-Rent Ratio', `
GROSS YIELD (ty suat cho thue gop) = (gia thue nam / gia mua) x 100%.
Vi du: mua 5 ty, cho thue 25 tr/thang = 300 tr/nam thi Gross Yield = 300/5000 = 6%/nam.
Muc tham khao thi truong: yield > 5% duoc xem la tot cho dau tu cho thue; yield < 3,5% thuong kem hap dan neu khong ky vong tang gia.
PRICE-TO-RENT RATIO = gia mua / gia thue nam. Ty le cang thap cang co loi cho nguoi mua de cho thue. Ratio ~16-20 la vung can bang tham khao.
Luon lam ro day la uoc tinh tren gia thue tham khao - chua xac minh hop dong thue thuc te.
`);

add('market','kb_mkt_yeu_to_gia','yeu_to','Cac yeu to tac dong den gia BDS', `
Cac yeu to chinh anh huong gia tri BDS:
- VI TRI: khoang cach den trung tam, ket noi giao thong (metro, cao toc, duong vanh dai), gan KCN/truong/benh vien/cho.
- PHAP LY: so hong rieng gia cao hon dat chung/giay tay; dung quy hoach.
- HA TANG & TIEN ICH: cong vien, truong hoc, TTTM, an ninh, quan ly.
- THANH KHOAN: kha nang ban lai nhanh; san pham phổ thong (2PN, tam trung) thanh khoan tot hon.
- YEU TO VI MO: lai suat, tin dung BDS, quy hoach ha tang moi, xu huong dan cu.
Khi so sanh gia phai chuan hoa ve cung don vi (VND/m2) va cung loai hinh.
`);

add('market','kb_mkt_so_cap_thu_cap','thi_truong','Gia so cap (F1), thu cap va chenh lech', `
THI TRUONG SO CAP (F1): mua truc tiep tu chu dau tu, thuong co chinh sach thanh toan theo tien do, uu dai, nhung can kiem tra bao lanh ngan hang va tien do phap ly.
THI TRUONG THU CAP: mua ban lai giua cac ca nhan, san pham da co so hoac gan xong, phap ly ro hon nhung gia thuong cao hon F1 neu khu vuc tang gia.
CHENH LECH F1 - THU CAP phan anh ky vong thi truong: chenh cao cho thay nhu cau tot; chenh am (cat lo) canh bao thanh khoan yeu.
Khi tu van dinh gia, phai phan biet ro dang so sanh gia so cap hay thu cap de tranh lech chuan.
`);

add('product','kb_prod_phan_loai','loai_hinh','Phan loai san pham BDS va dac diem dau tu', `
CAC LOAI HINH BDS pho bien:
- CAN HO CHUNG CU: thanh khoan tot, phu hop o thuc va cho thue; luu y phi quan ly, so hong tung can, thoi han so huu.
- NHA PHO / NHA RIENG: so hong rieng, phu hop o thuc va tich luy; gia tri dat chiem ty trong lon.
- BIET THU / SHOPHOUSE: phan khuc cao, vua o vua kinh doanh/cho thue; von lon, thanh khoan cham hon.
- DAT NEN: tiem nang tang gia theo ha tang, nhung can kiem tra phap ly va quy hoach ky; rui ro phap ly cao neu phan lo tu phat.
- BDS NGHI DUONG (condotel, biet thu bien): phu thuoc cam ket cho thue cua CDT - phai kiem tra tinh phap ly cam ket, KHONG hua ty le loi nhuan neu chua co trong tai lieu.
`);

add('product','kb_prod_profile_khach','khach_hang','Profile khach hang va tieu chi phu hop', `
PHAN LOAI KHACH THEO MUC DICH:
- O THUC (end-user): quan tam trai nghiem song, tien ich, truong hoc, benh vien, an ninh; uu tien phap ly sach, gan noi lam viec.
- DAU TU CHO THUE: quan tam yield, thanh khoan, khu vuc nhu cau thue cao (gan KCN, dai hoc, trung tam); metric bat buoc Gross Yield, Price-to-Rent.
- LUOT SONG: quan tam tien do thanh toan, chenh lech F1-thu cap, thoi diem ra hang; rui ro thanh khoan.
- NGHI DUONG / SECOND HOME: quan tam vi tri, cam ket cho thue, uy tin van hanh.
Khi chua ro muc dich, dat cau hoi mo de xac dinh profile truoc khi tu van san pham cu the.
`);

add('product','kb_prod_chi_so_ban_giao','tu_van','Cac chi so can hoi va tinh trang ban giao', `
CAC THONG SO CAN LAM RO KHI TU VAN CAN HO/NHA:
- Dien tich thong thuy (thuc su dung) vs dien tich tim tuong (ghi hop dong) - luon hoi dien tich thong thuy khi so sanh gia.
- Huong can/huong ban cong, view, tang.
- So phong ngu/ve sinh, cong nang.
- Phi quan ly/thang, phi gui xe.
TINH TRANG BAN GIAO:
- Ban giao tho: chi ket cau, khach tu hoan thien - gia thap hon, can du chi phi noi that.
- Ban giao hoan thien co ban / full noi that: gia cao hon, o duoc ngay.
Luon lam ro tinh trang ban giao khi bao gia de khach so sanh dung.
`);

async function main() {
  console.log(`[KB SEED] Bat dau nap ${DOCS.length} tai lieu vao tenant ${DEFAULT_TENANT_ID}`);
  let totalChunks = 0;
  const byDomain: Record<string, number> = {};
  for (const d of DOCS) {
    const n = await indexDocument({
      tenantId: DEFAULT_TENANT_ID,
      sourceType: `knowledge_${d.domain}`,
      sourceId: d.id,
      title: d.title,
      content: d.content,
      metadata: { domain: d.domain, lang: 'vi', category: d.category, source: 'curated_kb', title: d.title },
    });
    totalChunks += n;
    byDomain[d.domain] = (byDomain[d.domain] || 0) + n;
    console.log(`  [OK] ${d.domain}/${d.id} -> ${n} chunks`);
  }
  console.log('[KB SEED] Hoan tat. Tong chunks:', totalChunks);
  console.log('[KB SEED] Theo domain:', JSON.stringify(byDomain));
  process.exit(0);
}
main().catch((e) => { console.error('[KB SEED] LOI:', e); process.exit(1); });
