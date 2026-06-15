import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";

interface Term { id:string; term:string; definition:string; category:string; lawRef?:string|null; }

const TERMS: Term[] = [
  { id: "bat-dong-san", term: "Bat dong san", definition: "Tai san khong di chuyen duoc gom dat dai, nha o, cong trinh xay dung tren dat.", category: "Co ban",  lawRef: "Dieu 3 LD2024", },
  { id: "quyen-su-dung-dat", term: "Quyen su dung dat", definition: "Quyen Nha nuoc trao cho nguoi dan, to chuc de su dung dat trong thoi han nhat dinh.", category: "Phap ly",  lawRef: "Dieu 166 LD2024", },
  { id: "so-do", term: "So do (GCNQSDD)", definition: "Giay chung nhan quyen su dung dat, quyen so huu nha o va tai san gan lien voi dat.", category: "Giay to",  lawRef: "Dieu 135 LD2024", },
  { id: "hop-dong-mua-ban", term: "Hop dong mua ban BDS", definition: "Van ban phap ly rang buoc giua ben ban va ben mua BDS, phai cong chung theo quy dinh.", category: "Giao dich",  lawRef: "Dieu 430 BLDS 2015", },
  { id: "the-chap", term: "The chap bat dong san", definition: "Dung BDS lam tai san bao dam cho nghia vu vay von tai to chuc tin dung.", category: "Tai chinh",  lawRef: "Dieu 317 BLDS 2015", },
  { id: "gia-thi-truong", term: "Gia thi truong BDS", definition: "Muc gia do cung va cau tren thi truong quyet dinh, phan anh gia tri thuc te.", category: "Dinh gia", },
  { id: "gia-dat-nn", term: "Bang gia dat Nha nuoc", definition: "Bang gia dat do UBND tinh ban hanh, lam co so tinh thue, phi lien quan den dat dai.", category: "Phap ly",  lawRef: "Dieu 159 LD2024", },
  { id: "dien-tich-tt", term: "Dien tich thong thuy", definition: "Dien tich su dung thuc te, do tu mat tuong den mat tuong, khong tinh do day tuong ngoai.", category: "Do luong", },
  { id: "dat-nen", term: "Dat nen", definition: "Lo dat chua xay dung, co the xay nha ngay sau khi duoc cap phep trong du an phat trien.", category: "Phan loai", },
  { id: "dat-tho-cu", term: "Dat tho cu", definition: "Dat o tai nong thon, thu tuc chuyen nhuong don gian hon dat do thi.", category: "Phan loai",  lawRef: "Dieu 197 LD2024", },
  { id: "dat-do-thi", term: "Dat do thi", definition: "Dat o tai khu vuc do thi, thanh pho, thi xa, thi tran, co ha tang day du.", category: "Phan loai",  lawRef: "Dieu 199 LD2024", },
  { id: "quy-hoach", term: "Quy hoach su dung dat", definition: "Ban do xac dinh muc dich su dung dat do co quan nha nuoc co tham quyen phe duyet.", category: "Quy hoach",  lawRef: "Dieu 61 LD2024", },
  { id: "mat-do-xd", term: "Mat do xay dung", definition: "Ti le dien tich xay dung cong trinh tren tong dien tich lo dat, tinh bang phan tram.", category: "Quy hoach", },
  { id: "can-ho-cc", term: "Can ho chung cu", definition: "Don vi nha o doc lap trong toa nha chung cu co day du tien nghi, so dung chung toa nha.", category: "Phan loai",  lawRef: "Dieu 2 Luat Nha o 2023", },
  { id: "shophouse", term: "Shophouse", definition: "Nha pho thuong mai ket hop nha o tang tren va cua hang kinh doanh tang tret.", category: "Phan loai", },
  { id: "villa", term: "Biet thu (Villa)", definition: "Nha o rieng biet co san vuon, dac trung cao cap, quy mo va thiet ke doc lap.", category: "Phan loai", },
  { id: "condotel", term: "Condotel", definition: "Can ho khach san cho thue, chu so huu nhan thu nhap tu khai thac, khong co so do long term.", category: "Phan loai", },
  { id: "officetel", term: "Officetel", definition: "Can ho ket hop van phong va nha o, thoi han su dung 50 nam.", category: "Phan loai", },
  { id: "moi-gioi", term: "Moi gioi BDS", definition: "Ca nhan co chung chi hanh nghe, trung gian giua nguoi ban va nguoi mua bat dong san.", category: "Nghe nghiep",  lawRef: "Luat KD BDS 2023", },
  { id: "chu-dau-tu", term: "Chu dau tu", definition: "To chuc hoac ca nhan co quyen quan ly, trien khai du an BDS theo giay phep xay dung.", category: "Chu the",  lawRef: "Luat KD BDS 2023", },
  { id: "thu-hoi-dat", term: "Thu hoi dat", definition: "Nha nuoc lay lai dat vi muc dich quoc phong, kinh te - xa hoi, de boi thuong.", category: "Phap ly",  lawRef: "Dieu 78 LD2024", },
  { id: "dat-coc", term: "Dat coc", definition: "Khoan tien nguoi mua dat truoc de giu cho mua BDS, thuong 10-30% gia tri hop dong.", category: "Giao dich",  lawRef: "Dieu 328 BLDS 2015", },
  { id: "phi-truoc-ba", term: "Le phi truoc ba", definition: "Phi nop khi dang ky bien dong quyen su dung dat, tinh theo % gia tri BDS.", category: "Thue phi",  lawRef: "ND 10/2022", },
  { id: "thue-tncn", term: "Thue TNCN chuyen nhuong", definition: "Thue thu nhap ca nhan khi ban BDS, muc 2% gia chuyen nhuong.", category: "Thue phi",  lawRef: "Luat Thue TNCN", },
  { id: "vay-mua-nha", term: "Vay mua nha", definition: "Khoan vay tu ngan hang de mua BDS, the chap chinh tai san do lam bao dam.", category: "Tai chinh", },
  { id: "ltv", term: "Ti le LTV", definition: "Ti le khoan vay so voi gia tri tai san, ngan hang VN cho vay toi da 70-80%.", category: "Tai chinh", },
  { id: "dat-quy-hoach", term: "Dat quy hoach dinh chi", definition: "Dat bi quy hoach vao muc dich khac, han che chuyen nhuong, xay dung cho den khi thu hoi.", category: "Quy hoach", },
  { id: "du-an-htttl", term: "Du an hinh thanh trong tuong lai", definition: "Du an BDS dang xay dung, nguoi mua dat coc truoc va nhan nha sau khi hoan thanh.", category: "Giao dich",  lawRef: "Luat KD BDS 2023", },
  { id: "bao-lanh-nh", term: "Bao lanh ngan hang du an", definition: "Cam ket ngan hang dam bao nghia vu chu dau tu voi nguoi mua neu du an giao cham.", category: "Tai chinh",  lawRef: "Dieu 26 Luat KD BDS 2023", },
  { id: "cam-ket-thu-nhap", term: "Cam ket bao thu nhap", definition: "Chu dau tu cam ket tra thu nhap cho thue co dinh 5-10 nam cho condotel va officetel.", category: "Giao dich", },
  { id: "yield", term: "Ty suat sinh loi Yield", definition: "Thu nhap cho thue hang nam chia cho gia tri tai san, pho bien 4-8% tai Viet Nam.", category: "Tai chinh", },
  { id: "roi", term: "Ti le hoan von ROI", definition: "Ti le loi nhuan so voi von dau tu ban dau, dung de danh gia hieu qua dau tu BDS.", category: "Tai chinh", },
  { id: "thanh-khoan", term: "Tinh thanh khoan BDS", definition: "Kha nang mua ban BDS nhanh chong ma khong mat nhieu gia tri, vi tri tot giup tang thanh khoan.", category: "Thi truong", },
  { id: "bong-bong", term: "Bong bong bat dong san", definition: "Gia BDS tang cao bat hop ly so voi gia tri thuc, nguy co do vo khi cung thua cau.", category: "Thi truong", },
  { id: "dinh-gia", term: "Dinh gia bat dong san", definition: "Qua trinh xac dinh gia tri BDS dua tren phap ly, vi tri, thi truong, hien trang vat chat.", category: "Dinh gia", },
  { id: "pp-so-sanh", term: "Phuong phap so sanh", definition: "Dinh gia BDS bang cach tham chieu gia BDS tuong tu da giao dich tren thi truong.", category: "Dinh gia", },
  { id: "pp-thu-nhap", term: "Phuong phap von hoa thu nhap", definition: "Dinh gia BDS dua tren dong tien cho thue du kien, ap dung cho BDS sinh loi.", category: "Dinh gia", },
  { id: "ai-dinh-gia", term: "Dinh gia AI", definition: "Ung dung tri tue nhan tao du doan gia BDS dua tren big data giao dich, vi tri, ha tang.", category: "Cong nghe", },
  { id: "proptech", term: "PropTech", definition: "Cong nghe ung dung trong BDS bao gom AI, blockchain, VR/AR, IoT, big data.", category: "Cong nghe", },
  { id: "vr-360", term: "Tham quan ao 360 do", definition: "Cong nghe xem nha tu xa qua hinh anh 360 do hoac VR, tiet kiem thoi gian xem nha.", category: "Cong nghe", },
  { id: "bigdata", term: "Big Data BDS", definition: "Du lieu lon ve giao dich, gia ca, xu huong dung cho phan tich va du bao thi truong BDS.", category: "Cong nghe", },
  { id: "escrow", term: "Tai khoan phong toa Escrow", definition: "Tai khoan trung gian giu tien mua nha, chi giai ngan khi du dieu kien chuyen nhuong.", category: "Tai chinh", },
  { id: "flipping", term: "Flipping BDS", definition: "Mua BDS gia re, cai tao roi ban nhanh de thu loi nhuan ngan han.", category: "Dau tu", },
  { id: "buy-hold", term: "Buy and Hold", definition: "Mua BDS giu dai han de huong loi tu tang gia va thu nhap cho thue ben vung.", category: "Dau tu", },
  { id: "due-diligence", term: "Tham dinh phap ly", definition: "Kiem tra toan dien phap ly, ky thuat, tai chinh BDS truoc khi quyet dinh mua.", category: "Giao dich", },
  { id: "reit", term: "Quy dau tu BDS REIT", definition: "Quy tap hop von nhieu nha dau tu de so huu danh muc BDS, phan phoi co tuc dinh ky.", category: "Tai chinh", },
  { id: "aqua-city", term: "Aqua City Novaland", definition: "Do thi sinh thai 1000ha tai Long Thanh Dong Nai, phat trien boi Novaland, gan san bay quoc te.", category: "Du an", },
  { id: "long-thanh", term: "San bay Long Thanh", definition: "San bay quoc te Long Thanh Dong Nai, cong suat 25 trieu hanh khach/nam giai doan 1.", category: "Ha tang", },
  { id: "luat-dat-dai-2024", term: "Luat Dat Dai 2024", definition: "Luat so 31/2024/QH15 hieu luc 1/1/2025, thay Luat 2013, nhieu diem moi ve dinh gia, thu hoi dat.", category: "Van ban",  lawRef: "Luat 31/2024", },
  { id: "luat-nha-o-2023", term: "Luat Nha o 2023", definition: "Luat so 27/2023/QH15 hieu luc 1/8/2024, quy dinh phat trien, quan ly, su dung nha o.", category: "Van ban",  lawRef: "Luat 27/2023", },
  { id: "luat-kd-bds-2023", term: "Luat KD BDS 2023", definition: "Luat so 29/2023/QH15 hieu luc 1/8/2024, quy dinh moi gioi, san giao dich, du an BDS.", category: "Van ban",  lawRef: "Luat 29/2023", },
  { id: "chung-chi-mg", term: "Chung chi moi gioi BDS", definition: "Chung chi bat buoc de hanh nghe moi gioi, do Bo Xay dung cap, gia han 5 nam.", category: "Nghe nghiep",  lawRef: "Luat KD BDS 2023", },
  { id: "san-gdbs", term: "San giao dich BDS", definition: "Don vi kinh doanh dich vu moi gioi, dinh gia, quan ly BDS co dang ky phap ly.", category: "Nghe nghiep",  lawRef: "Dieu 61 Luat KD BDS 2023", },
  { id: "chuyen-muc-dich", term: "Chuyen muc dich su dung dat", definition: "Thay doi muc dich tu nong nghiep sang phi nong nghiep hoac tu dich vu sang o, can xin phep.", category: "Phap ly",  lawRef: "Dieu 121 LD2024", },
  { id: "dat-nong-nghiep", term: "Dat nong nghiep", definition: "Dat su dung vao muc dich trong trot, chan nuoi, thuy san, rung theo quy dinh.", category: "Phan loai",  lawRef: "Dieu 10 LD2024", },
  { id: "tai-dinh-cu", term: "Tai dinh cu", definition: "Sap xep noi o moi cho nguoi bi thu hoi dat bang tien, nha dat, hoac lo dat khac.", category: "Phap ly",  lawRef: "Dieu 111 LD2024", },
  { id: "tranh-chap-dat", term: "Tranh chap dat dai", definition: "Mau thuan ve quyen su dung dat, giai quyet qua hoa giai hoac toa an nhan dan.", category: "Phap ly",  lawRef: "Dieu 235 LD2024", },
  { id: "mat-tien", term: "Mat tien duong", definition: "Vi tri BDS tiep giap truc tiep mat duong, gia cao do tien ich kinh doanh tot.", category: "Vi tri", },
  { id: "vi-tri-vang", term: "Vi tri vang", definition: "BDS tai khu trung tam, mat tien duong lon, phat trien thuong mai, gia tri cao nhat.", category: "Vi tri", },
  { id: "thu-nhap-tieu-dong", term: "Thu nhap tieu dong", definition: "Thu nhap deu deu tu cho thue BDS ma khong can quan ly tich cuc.", category: "Dau tu", },
  { id: "vinhomes", term: "Vinhomes", definition: "Thuong hieu BDS cao cap cua Vingroup, chu dau tu Vinhomes Grand Park, Ocean Park.", category: "Thuong hieu", },
  { id: "novaland", term: "Novaland Group", definition: "Tap doan BDS hang dau VN, chu dau tu Aqua City, NovaWorld Phan Thiet, Ho Tram Strip.", category: "Thuong hieu", },
  { id: "sgs-land", term: "SGS LAND", definition: "Nen tang BDS AI hang dau TP.HCM, chuyen dinh gia tu dong, tim kiem BDS thong minh.", category: "Thuong hieu", },
  { id: "he-so-sdd", term: "He so su dung dat", definition: "Tong san GFA chia cho dien tich lo dat, xac dinh quy mo toi da cua cong trinh.", category: "Quy hoach", },
  { id: "lo-gioi", term: "Lo gioi", definition: "Ranh gioi phan cach giua dat xay dung va mat duong, he thong ky thuat ha tang.", category: "Quy hoach", },
  { id: "tien-do-tt", term: "Tien do thanh toan", definition: "Lich trinh cac dot thanh toan theo qua trinh xay dung, thuong 5-7 dot.", category: "Giao dich", },
  { id: "nghiem-thu", term: "Nghiem thu cong trinh", definition: "Kiem tra cong trinh hoan thanh dung thiet ke, an toan truoc khi ban giao su dung.", category: "Xay dung", },
  { id: "tien-ich", term: "Tien ich noi khu", definition: "Dich vu trong khuon vien du an: ho boi, gym, truong hoc, cong vien.", category: "Tien ich", },
  { id: "nha-o-xa-hoi", term: "Nha o xa hoi", definition: "Nha o danh cho nguoi thu nhap thap, gia thap theo quy dinh Nha nuoc, co ho tro.", category: "Phan loai",  lawRef: "Luat Nha o 2023", },
  { id: "nha-o-tm", term: "Nha o thuong mai", definition: "Nha o xay de kinh doanh theo co che thi truong, khong co uu dai Nha nuoc.", category: "Phan loai", },
  { id: "biet-thu-bien", term: "Biet thu bien", definition: "Biet thu ngay mat bien, gia tri cao, khai thac du lich, thuong co cam ket thue tu chu dau tu.", category: "Phan loai", },
  { id: "cam-ket-mua-lai", term: "Cam ket mua lai", definition: "Chu dau tu cam ket mua lai BDS sau 1-3 nam theo muc gia bao dam neu nguoi mua muon thoat.", category: "Giao dich", },
  { id: "cong-chung", term: "Cong chung hop dong", definition: "Xac thuc hop dong mua ban, chuyen nhuong BDS qua van phong cong chung co tham quyen.", category: "Giao dich", },
  { id: "dang-ky-bd", term: "Dang ky bien dong QSDD", definition: "Thu tuc cap nhat thay doi chu su dung dat tai Van phong Dang ky dat dai.", category: "Phap ly",  lawRef: "Dieu 133 LD2024", },
  { id: "hop-dong-thue-dat", term: "Hop dong thue dat Nha nuoc", definition: "Hop dong giua Nha nuoc va to chuc su dung dat thue, thoi han toi da 50 nam.", category: "Phap ly",  lawRef: "Dieu 170 LD2024", },
  { id: "crm-bds", term: "CRM bat dong san", definition: "Phan mem quan ly khach hang, theo doi tien trinh mua ban, ho tro moi gioi lam viec hieu qua.", category: "Cong nghe", },
  { id: "khu-cn", term: "BDS khu cong nghiep", definition: "Dat va cong trinh trong khu cong nghiep cho thue tu nuoc ngoai, tang gia theo dong von FDI.", category: "Phan loai", },
  { id: "bds-nd", term: "BDS nghi duong", definition: "Bat dong san tai khu nghi duong, bien, nui, khai thac du lich va cho thue nghi duong.", category: "Phan loai", },
  { id: "boi-thuong", term: "Boi thuong giai phong mat bang", definition: "Tien boi thuong cho chu dat bi thu hoi, tinh theo bang gia dat + ho tro di chuyen.", category: "Phap ly",  lawRef: "Dieu 95 LD2024", },
  { id: "hop-dong-cn", term: "Hop dong chuyen nhuong QSDD", definition: "Hop dong chinh thuc chuyen giao quyen su dung dat co cong chung vien, de lam so do.", category: "Giao dich",  lawRef: "Dieu 167 LD2024", },
  { id: "ket-qua-td", term: "Ket qua tham dinh gia", definition: "Bao cao cua cong ty dinh gia doc lap ve gia tri BDS, can thiet khi vay ngan hang.", category: "Dinh gia", },
  { id: "blockchain-bds", term: "Blockchain trong BDS", definition: "Ung dung blockchain luu tru, xac thuc giay to quyen so huu BDS, tang tinh minh bach.", category: "Cong nghe", },
  { id: "don-gia-xd", term: "Don gia xay dung", definition: "Chi phi xay dung tren moi m2 bao gom vat lieu, nhan cong de tinh gia thanh cong trinh.", category: "Xay dung", },
  { id: "tiep-can-tc", term: "Tiep can tai chinh", definition: "Kha nang vay von ngan hang, TCTD hoac nguon khac de tham gia dau tu BDS.", category: "Tai chinh", },
  { id: "gia-trich-tinh", term: "Gia trich tinh thue", definition: "Gia Nha nuoc quy dinh dung de tinh cac loai thue lien quan den giao dich BDS.", category: "Thue phi", },
  { id: "bds-giu-gia", term: "BDS giu gia tot", definition: "Bat dong san co gia tri tang theo thoi gian nho vi tri dep, ha tang phat trien.", category: "Dau tu", },
  { id: "ban-quyen-50nam", term: "Ban quyen su dung dat 50 nam", definition: "Quyen su dung dat phi nong nghiep o khu kinh te, du an dac biet, thoi han 50 nam.", category: "Phap ly",  lawRef: "Dieu 172 LD2024", },
  { id: "tham-chieu-gia", term: "Tham chieu gia BDS", definition: "Gia BDS tuong tu tren thi truong dung lam nen de so sanh dinh gia tai san can xem xet.", category: "Dinh gia", },
  { id: "tien-do-xd", term: "Tien do xay dung", definition: "Lich trinh hoan thanh tung hang muc cong trinh, lam co so giai ngan va ban giao nha.", category: "Xay dung", },
  { id: "lo-dat-lk", term: "Lo dat lien ke", definition: "Dat o trong du an, cac lo dat canh nhau, mua ban theo lo co so do rieng.", category: "Phan loai", },
  { id: "nen-dat-pl", term: "Nen dat phan lo", definition: "Lo dat nho hon trong du an duoc chia nho tu dat goc, co the xay nha o ngay.", category: "Phan loai", },
  { id: "gia-ban-tt", term: "Gia ban thi truong", definition: "Muc gia thuc te nguoi mua chap nhan tra, co the cao hon hoac thap hon gia niem yet.", category: "Dinh gia", },
  { id: "mo-ban", term: "Mo ban BDS", definition: "Su kien chinh thuc bat dau ban hang du an, thu hut moi gioi va khach hang tiem nang.", category: "Giao dich", },
  { id: "ban-gia-goc", term: "Ban gia goc", definition: "Mua BDS truc tiep tu chu dau tu khong qua moi gioi thu cap, dat gia goc tot nhat.", category: "Giao dich", },
  { id: "phi-ql-cc", term: "Phi quan ly chung cu", definition: "Khoan phi hang thang chu so huu dong gop cho ban quan ly duy tri dich vu chung.", category: "Van hanh", },
  { id: "khu-dt-moi", term: "Khu do thi moi", definition: "Khu vuc phat trien do thi theo quy hoach tong the, co ha tang dong bo, quy mo lon.", category: "Quy hoach", },
  { id: "to-hop-ch", term: "To hop can ho mixed-use", definition: "Du an ket hop nhieu chuc nang: o, thuong mai, van phong, khach san trong mot khu.", category: "Phan loai", },
];

const CATEGORIES = Array.from(new Set(TERMS.map(t => t.category))).sort();

export default function Glossary() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const filtered = useMemo(() => TERMS.filter(t => {
    const matchQ = !q || t.term.toLowerCase().includes(q.toLowerCase()) || t.definition.toLowerCase().includes(q.toLowerCase());
    const matchC = !cat || t.category === cat;
    return matchQ && matchC;
  }), [q, cat]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "name": "Tu dien Bat dong san Viet Nam",
    "description": "Dinh nghia 100+ thuat ngu bat dong san Viet Nam theo Luat Dat Dai 2024",
    "url": "https://sgsland.vn/tu-dien-bat-dong-san",
    "publisher": { "@type": "Organization", "name": "SGS LAND", "url": "https://sgsland.vn" },
    "hasDefinedTerm": TERMS.map(t => ({
      "@type": "DefinedTerm",
      "@id": `https://sgsland.vn/tu-dien-bat-dong-san#${t.id}`,
      "name": t.term,
      "description": t.definition,
      "inDefinedTermSet": "https://sgsland.vn/tu-dien-bat-dong-san",
      ...(t.lawRef ? { "legislationPassedBy": t.lawRef } : {})
    }))
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Tu dien Bat dong san Viet Nam - SGS LAND | 100+ Thuat ngu BDS</title>
        <meta name="description" content="Tu dien bat dong san Viet Nam day du 100+ thuat ngu theo Luat Dat Dai 2024: so do, quyen su dung dat, dien tich thong thuy, condotel va hon nua." />
        <link rel="canonical" href="https://sgsland.vn/tu-dien-bat-dong-san" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Tu dien Bat dong san Viet Nam</h1>
          <p className="text-blue-100 text-lg mb-2">Dinh nghia chinh xac {TERMS.length}+ thuat ngu BDS theo Luat Dat Dai 2024</p>
          <p className="text-blue-200 text-sm">Nguon tham khao: SGS LAND Research | Cap nhat thang 6/2026</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tim kiem thuat ngu..."
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          />
          <select value={cat} onChange={e => setCat(e.target.value)} className="border rounded-lg px-4 py-2">
            <option value="">Tat ca chu de</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <p className="text-gray-500 text-sm mb-6">Hien thi {filtered.length}/{TERMS.length} thuat ngu</p>

        {/* Terms grid */}
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <div
              key={t.id}
              id={t.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              itemScope
              itemType="https://schema.org/DefinedTerm"
            >
              <div className="flex items-start justify-between mb-2">
                <dt className="font-semibold text-gray-900 text-base" itemProp="name">{t.term}</dt>
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 whitespace-nowrap">{t.category}</span>
              </div>
              <dd className="text-gray-600 text-sm" itemProp="description">{t.definition}</dd>
              {t.lawRef && (
                <p className="mt-2 text-xs text-green-700 font-medium">
                  Tham chieu: {t.lawRef}
                </p>
              )}
              <link itemProp="inDefinedTermSet" href="https://sgsland.vn/tu-dien-bat-dong-san" />
            </div>
          ))}
        </dl>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Khong tim thay thuat ngu phu hop. Thu tim kiem khac.</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-blue-50 rounded-xl p-6 text-center">
          <h2 className="text-xl font-bold text-blue-900 mb-2">Can dinh gia bat dong san chuyen nghiep?</h2>
          <p className="text-blue-700 mb-4">SGS LAND cung cap dich vu dinh gia AI, bao cao thi truong va tu van BDS mien phi.</p>
          <a href="/ai-valuation" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Thu dinh gia AI ngay
          </a>
        </div>
      </div>
    </div>
  );
}
