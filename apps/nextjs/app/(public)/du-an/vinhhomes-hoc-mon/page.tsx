import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailPage } from "@/components/public/ProjectDetailPage";
import { ALL_PROJECTS } from "@/data/projects";
import type { LandingProject } from "@/data/landing-projects";
import { SITE_URL } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vinhomes Hóc Môn — Thông tin dự án | SGS LAND",
  description:
    "Thông tin tham khảo về Vinhomes Hóc Môn: vị trí, quy mô, sản phẩm, giá, tiện ích và khung thẩm định. Giá, pháp lý, tiến độ và tư cách phân phối cần được xác minh.",
  alternates: { canonical: `${SITE_URL}/du-an/vinhhomes-hoc-mon` },
  openGraph: {
    type: "article",
    title: "Vinhomes Hóc Môn — Thông tin dự án",
    description:
      "Tổng hợp thông tin tham khảo về Vinhomes Hóc Môn và các nội dung cần kiểm tra trước giao dịch.",
    url: `${SITE_URL}/du-an/vinhomes-hoc-mon`,
    siteName: "SGS LAND",
    locale: "vi_VN",
  },
};

const HOC_MON: LandingProject = {
  slug: "vinhomes-hoc-mon",
  titleFull: "Vinhomes Hóc Môn – Thông tin dự án | SGS LAND",
  titleShort: "Vinhomes Hóc Môn",
  eyebrow: "Vinhomes • Hóc Môn, TP.HCM • Thông tin tham khảo",
  desc: "Vinhomes Hóc Môn, còn được nhắc đến với tên Vinhomes Smart City, là dự án được quan tâm tại khu vực Tây Bắc TP.HCM. Trang này tổng hợp thông tin tham khảo về vị trí, quy mô, sản phẩm và các điểm cần xác minh.",
  keywords: "Vinhomes Hóc Môn, Vinhomes Smart City, giá Vinhomes Hóc Môn, dự án Hóc Môn",
  heroImageAlt: "Thông tin tham khảo dự án Vinhomes Hóc Môn tại TP.HCM",
  heroGradient: "linear-gradient(rgba(6,48,31,.72),rgba(6,48,31,.55))",
  theme: {
    primary: "#0B3B32",
    deep: "#062F25",
    soft: "#E6F0EC",
    gold: "#C6923D",
    goldSoft: "#E7C98A",
    cream: "#F5F1E6",
  },
  geo: { lat: 10.8835, lng: 106.5937 },
  stats: [
    { num: "667 ha", lbl: "Quy mô được nhắc đến" },
    { num: "Cần xác minh", lbl: "Pháp lý từng phân khu" },
    { num: "Theo sản phẩm", lbl: "Mức giá tham khảo" },
    { num: "Tây Bắc TP.HCM", lbl: "Khu vực" },
  ],
  heroH1: "Vinhomes Hóc Môn",
  heroSub: "Vinhomes Hóc Môn — Hóc Môn, TP.HCM",
  heroMeta: "Vinhomes | Hóc Môn, TP.HCM | Giá, pháp lý và tiến độ cần xác minh",
  overviewParas: [
    "Vinhomes Hóc Môn được thị trường nhắc đến như một dự án đô thị quy mô lớn tại khu vực Tây Bắc TP.HCM, do Vinhomes được ghi nhận là chủ thể phát triển. Quy mô 667 ha và các mốc mở bán cần được đối chiếu với hồ sơ, thông báo chính thức và phạm vi phân kỳ tương ứng.",
    "Thông tin về giá, loại hình, quy hoạch, hạ tầng và tiện ích có thể thay đổi theo từng giai đoạn. Không nên xem thông tin quảng bá hoặc đăng ký quan tâm là bằng chứng về pháp lý, tiến độ hay quyền phân phối.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Vinhomes Hóc Môn / Vinhomes Smart City (tên gọi tham khảo)" },
    { k: "Chủ đầu tư được ghi nhận", v: "Vinhomes (Vingroup) — cần đối chiếu pháp nhân trong hồ sơ" },
    { k: "Vị trí", v: "Hóc Môn, TP.HCM" },
    { k: "Quy mô", v: "667 ha (số liệu tham khảo, cần xác minh theo hồ sơ)" },
    { k: "Loại hình", v: "Cần xác minh theo phân kỳ và sản phẩm được công bố" },
    { k: "Giá tham khảo", v: "Cần xác minh theo bảng giá có ngày cập nhật" },
    { k: "Mở bán / tiến độ", v: "Chưa xem là cam kết; cần thông báo chính thức" },
    { k: "Tư cách phân phối", v: "Yêu cầu xác nhận bằng văn bản trước giao dịch" },
  ],
  locationIntro:
    "Vinhomes Hóc Môn được ghi nhận tại khu vực Hóc Môn, phía Tây Bắc TP.HCM. Ranh dự án, điểm tiếp cận, thời gian di chuyển và tác động của các tuyến hạ tầng cần được kiểm tra theo bản đồ, tuyến đường và thời điểm thực tế.",
  googleMapsEmbedSrc:
    "https://www.google.com/maps?q=H%C3%B3c+M%C3%B4n+Ho+Chi+Minh+City&output=embed",
  faq: [
    {
      q: "Vinhomes Hóc Môn ở đâu?",
      a: "Dự án được nhắc đến tại khu vực Hóc Môn, TP.HCM. Ranh dự án và địa chỉ pháp lý cần được đối chiếu với hồ sơ chính thức thay vì chỉ dựa trên tên thương mại hoặc thông tin quảng bá.",
    },
    {
      q: "Vinhomes Hóc Môn có quy mô bao nhiêu?",
      a: "Số liệu 667 ha đang được sử dụng như thông tin tham khảo. Người mua cần kiểm tra quyết định chấp thuận, quy hoạch và phạm vi từng phân kỳ để biết quy mô áp dụng cho sản phẩm cụ thể.",
    },
    {
      q: "Giá Vinhomes Hóc Môn bao nhiêu?",
      a: "Chưa nên xem các mức giá trên thị trường là bảng giá chính thức. Giá cần được xác nhận theo loại hình, phân khu, diện tích, chính sách thanh toán và ngày cập nhật.",
    },
    {
      q: "Vinhomes Hóc Môn khi nào mở bán?",
      a: "Các mốc ra mắt hoặc mở bán chỉ là dự kiến nếu chưa có thông báo chính thức. Hãy yêu cầu tài liệu xác nhận từ chủ thể liên quan trước khi đặt chỗ hoặc ký kết.",
    },
    {
      q: "Pháp lý Vinhomes Hóc Môn đã hoàn tất chưa?",
      a: "Tình trạng pháp lý cần được kiểm tra theo đúng phân khu và sản phẩm, gồm quy hoạch, chấp thuận đầu tư, đất đai, xây dựng, hợp đồng và điều kiện cấp giấy nếu có.",
    },
    {
      q: "Có nên đặt chỗ Vinhomes Hóc Môn trước không?",
      a: "Không có khuyến nghị chung. Trước khi đặt chỗ, cần đọc điều khoản hoàn tiền, xác định chủ thể nhận tiền, kiểm tra tư cách phân phối và yêu cầu tài liệu dự án có ngày cập nhật.",
    },
  ],
  navLinks: [
    { href: "#tong-quan", label: "Tổng quan" },
    { href: "#thong-tin", label: "Thông tin dự án" },
    { href: "#vi-tri", label: "Vị trí" },
    { href: "#bang-gia", label: "Bảng giá" },
    { href: "#tien-ich", label: "Tiện ích" },
    { href: "#tham-dinh", label: "Thẩm định" },
    { href: "#faq", label: "FAQ" },
    { href: "#lien-he", label: "Liên hệ" },
  ],
  schemaName: "Vinhomes Hóc Môn",
  schemaDev: "Vinhomes (cần đối chiếu pháp nhân)",
  schemaLocality: "Hóc Môn, TP.HCM",
  schemaRegion: "TP.HCM",
  schemaAmenities: [
    "Tiện ích nội khu theo từng phân kỳ — cần xác minh",
    "Hạ tầng kết nối khu vực — cần đối chiếu tiến độ thực tế",
  ],
};

export default function VinhomesHocMonPage() {
  const listedProject = ALL_PROJECTS.find((project) => project.slug === HOC_MON.slug);
  if (!listedProject) notFound();

  return (
    <ProjectDetailPage
      slug={HOC_MON.slug}
      landingProject={HOC_MON}
      project={{
        name: listedProject.name,
        developer: listedProject.developer,
        location: listedProject.location,
        description: HOC_MON.desc,
        images: [],
      }}
      config={{
        details: HOC_MON.entityTable.map((row) => ({ label: row.k, value: row.v })),
        amenities: [{
          title: "Tiện ích và trạng thái cần kiểm tra",
          items: HOC_MON.schemaAmenities,
        }],
        faqs: HOC_MON.faq.map((item) => ({ q: item.q, a: item.a })),
      }}
    />
  );
}