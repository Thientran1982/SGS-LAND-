"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe, ShieldCheck, Cpu, Lock, BarChart3, Gift, ClipboardList, Scale,
  FileCheck2, Megaphone, Users, Coins, CheckCircle2, ChevronDown, Star,
} from "lucide-react";
import { useLang } from "@/components/shared/useLang";

type L = [string, string];

const BENEFITS: { icon: React.ComponentType<{ className?: string }>; t: L; d: L }[] = [
  {
    icon: Globe,
    t: ["Phủ sóng marketing tối đa", "Maximum marketing reach"],
    d: [
      "Tài sản của bạn được đăng trên hệ sinh thái SGS LAND, 50+ sàn đối tác, và kênh môi giới nội bộ hơn 5.000 môi giới đang hoạt động.",
      "Your property is listed across the SGS LAND ecosystem, 50+ partner marketplaces and an internal network of more than 5,000 active agents.",
    ],
  },
  {
    icon: ShieldCheck,
    t: ["Hoa hồng được bảo vệ bằng hợp đồng", "Commission protected by contract"],
    d: [
      "Hợp đồng ký gửi xác định rõ ràng mức hoa hồng, điều kiện phát sinh, thời hạn — không tranh cãi, không mờ ám. SGS LAND tuân thủ Luật KDBĐS 2023.",
      "The consignment contract states the fee, when it becomes payable and for how long — no ambiguity, no disputes. SGS LAND complies with the 2023 Real Estate Business Law.",
    ],
  },
  {
    icon: Cpu,
    t: ["Định giá AI chính xác", "Accurate AI valuation"],
    d: [
      "Mô hình định giá AVM của SGS LAND phân tích hàng ngàn điểm dữ liệu giúp chủ sở hữu có mức giá cạnh tranh — bán / cho thuê nhanh hơn.",
      "The SGS LAND AVM analyses thousands of data points so owners price competitively — and sell or let faster.",
    ],
  },
  {
    icon: Lock,
    t: ["An toàn thông tin", "Information security"],
    d: [
      "Thông tin tài sản và thông tin cá nhân được bảo mật theo NĐ 13/2023/NĐ-CP. Chỉ chia sẻ với khách mua / thuê sau khi có sự đồng ý của chủ sở hữu.",
      "Property and personal data are protected under Decree 13/2023/ND-CP, and shared with buyers or tenants only with the owner's consent.",
    ],
  },
  {
    icon: BarChart3,
    t: ["Báo cáo định kỳ", "Regular reporting"],
    d: [
      "Chủ sở hữu nhận báo cáo hàng tuần: số lượt xem, phản hồi thị trường, khách tiềm năng — minh bạch 100% qua dashboard hoặc email.",
      "Owners get a weekly report — views, market feedback and qualified prospects — fully transparent via dashboard or email.",
    ],
  },
  {
    icon: Gift,
    t: ["Không phí ký gửi ban đầu", "No upfront consignment fee"],
    d: [
      "Hoàn toàn miễn phí khi đăng ký ký gửi. Chi phí marketing (ảnh, video, quảng cáo) do SGS LAND chi trả. Hoa hồng chỉ thu khi giao dịch thành công.",
      "Registering costs nothing. SGS LAND pays for the marketing — photography, video and advertising. A fee is charged only on a successful transaction.",
    ],
  },
];

const COMMISSION: { type: L; rate: L; base: L; min: string; note: L }[] = [
  {
    type: ["Mua bán bất động sản", "Sale of property"],
    rate: ["1% – 2%", "1% – 2%"],
    base: ["Giá trị hợp đồng mua bán", "Value of the sale contract"],
    min: "30.000.000 VNĐ",
    note: ["Thu khi hợp đồng công chứng & tiền cọc / đặt cọc được thanh toán", "Payable once the contract is notarised and the deposit is paid"],
  },
  {
    type: ["Cho thuê (≥ 12 tháng)", "Lease (12 months or more)"],
    rate: ["1 tháng tiền thuê", "One month's rent"],
    base: ["Giá thuê tháng đầu tiên", "First month's rent"],
    min: "5.000.000 VNĐ",
    note: ["Thu khi hợp đồng thuê ký kết và tiền cọc được chuyển cho chủ nhà", "Payable once the lease is signed and the deposit reaches the owner"],
  },
  {
    type: ["Cho thuê (< 12 tháng)", "Lease (under 12 months)"],
    rate: ["50% tháng thuê", "50% of one month's rent"],
    base: ["Giá thuê tháng đầu tiên", "First month's rent"],
    min: "2.000.000 VNĐ",
    note: ["Thu khi hợp đồng thuê ký kết và tiền thuê tháng đầu được thanh toán", "Payable once the lease is signed and the first month's rent is paid"],
  },
];

const STEPS: { icon: React.ComponentType<{ className?: string }>; t: L; d: L; detail: L }[] = [
  {
    icon: ClipboardList,
    t: ["Tiếp nhận hồ sơ", "We receive your file"],
    d: [
      "Điền form đăng ký ký gửi. Chuyên viên SGS LAND liên hệ trong vòng 4 giờ làm việc để xác nhận thông tin và thu thập hồ sơ pháp lý ban đầu.",
      "Fill in the consignment form. An SGS LAND specialist calls within 4 working hours to confirm the details and collect the initial legal documents.",
    ],
    detail: [
      "Giấy chứng nhận quyền sử dụng đất, CMND/CCCD chủ sở hữu, giấy phép xây dựng (nếu có)",
      "Land use right certificate, the owner's ID card, and the building permit where applicable",
    ],
  },
  {
    icon: Scale,
    t: ["Thẩm định pháp lý", "Legal review"],
    d: [
      "Đội ngũ pháp lý SGS LAND kiểm tra tính hợp lệ của hồ sơ: tình trạng tranh chấp, quy hoạch, nghĩa vụ tài chính còn lại.",
      "Our legal team checks the file for disputes, zoning constraints and outstanding financial obligations.",
    ],
    detail: [
      "Hoàn thành trong 1–3 ngày làm việc. Kết quả thẩm định được thông báo bằng văn bản.",
      "Completed within 1–3 working days. The outcome is confirmed in writing.",
    ],
  },
  {
    icon: FileCheck2,
    t: ["Ký kết hợp đồng ký gửi", "Signing the consignment contract"],
    d: [
      "Hai bên ký Hợp đồng Ký gửi Bất động sản xác định rõ mức hoa hồng, thời hạn ký gửi, quyền và nghĩa vụ từng bên. Hợp đồng có giá trị pháp lý đầy đủ.",
      "Both parties sign a consignment contract setting out the fee, the term and each side's rights and obligations. It is fully legally binding.",
    ],
    detail: [
      "Căn cứ: Điều 41–42 Luật KDBĐS 2023 & Nghị định 96/2024/NĐ-CP.",
      "Basis: Articles 41–42 of the 2023 Real Estate Business Law and Decree 96/2024/ND-CP.",
    ],
  },
  {
    icon: Megaphone,
    t: ["Định giá & Triển khai marketing", "Valuation and marketing"],
    d: [
      "Định giá bằng AI (AVM) kết hợp thẩm định thực tế. Đăng tin trên SGS LAND, sàn giao dịch đối tác, mạng xã hội và kênh môi giới nội bộ.",
      "An AI (AVM) valuation combined with an on-site assessment, then listing on SGS LAND, partner marketplaces, social media and the internal agent network.",
    ],
    detail: [
      "Bộ ảnh chuyên nghiệp, video thực tế, mô tả chuẩn SEO — tất cả miễn phí khi ký gửi.",
      "Professional photography, walkthrough video and SEO copy — all free with a consignment.",
    ],
  },
  {
    icon: Users,
    t: ["Kết nối khách & Đàm phán", "Buyer matching and negotiation"],
    d: [
      "Môi giới SGS LAND dẫn dắt toàn bộ quá trình xem nhà, đàm phán giá, điều khoản hợp đồng mua bán / thuê — chủ sở hữu không cần trực tiếp gặp gỡ.",
      "SGS LAND agents run the viewings and negotiate price and terms — the owner never has to meet prospects in person.",
    ],
    detail: [
      "Chủ sở hữu được cập nhật tiến độ định kỳ qua app hoặc email.",
      "Owners receive regular progress updates in the app or by email.",
    ],
  },
  {
    icon: Coins,
    t: ["Ký kết & Thu hoa hồng", "Closing and commission"],
    d: [
      "Sau khi hợp đồng mua bán / thuê được ký kết hợp lệ và tiền cọc hoặc tiền mua được chuyển vào tài khoản của chủ sở hữu, hoa hồng của SGS LAND được thanh toán theo hợp đồng ký gửi.",
      "Once the sale or lease contract is validly signed and the deposit or purchase price reaches the owner's account, the SGS LAND fee falls due under the consignment contract.",
    ],
    detail: [
      "Hoa hồng chỉ phát sinh khi giao dịch thành công — không thu phí nếu không giao dịch.",
      "The fee arises only on a successful transaction — nothing is charged otherwise.",
    ],
  },
];

const LEGAL: { t: L; d: L }[] = [
  {
    t: ["1. Hợp đồng ký gửi có giá trị pháp lý", "1. The consignment contract is legally binding"],
    d: [
      "Ngay sau khi hai bên ký kết Hợp đồng Ký gửi Bất động sản, SGS LAND có đầy đủ căn cứ pháp lý để yêu cầu thanh toán hoa hồng theo Điều 41 Luật KDBĐS 2023 khi giao dịch thành công — kể cả trường hợp chủ sở hữu tự ý hủy hợp đồng mua bán sau khi đã có sự giới thiệu của SGS LAND.",
      "As soon as both parties sign, SGS LAND has full legal grounds under Article 41 of the 2023 Real Estate Business Law to claim its fee on a successful transaction — including where the owner unilaterally cancels a sale after an SGS LAND introduction.",
    ],
  },
  {
    t: ["2. Điều kiện phát sinh hoa hồng", "2. When the fee becomes payable"],
    d: [
      "Hoa hồng phát sinh khi (a) hợp đồng mua bán được công chứng hợp lệ hoặc hợp đồng thuê được ký bởi cả hai bên; và (b) tiền đặt cọc hoặc tiền thuê tháng đầu tiên được chuyển vào tài khoản của chủ sở hữu.",
      "The fee arises when (a) the sale contract is validly notarised or the lease is signed by both parties; and (b) the deposit or first month's rent has been transferred to the owner's account.",
    ],
  },
  {
    t: ["3. Bảo lưu khách hàng", "3. Client protection period"],
    d: [
      "Trong thời hạn 90 ngày kể từ ngày hết hạn hợp đồng ký gửi, nếu chủ sở hữu tự ký giao dịch với khách hàng đã được SGS LAND giới thiệu trước đó, hoa hồng vẫn phát sinh theo giá trị hợp đồng.",
      "For 90 days after the consignment contract expires, a transaction closed directly with a client previously introduced by SGS LAND still attracts the fee, based on the contract value.",
    ],
  },
  {
    t: ["4. Giải quyết tranh chấp", "4. Dispute resolution"],
    d: [
      "Mọi tranh chấp về hoa hồng được giải quyết theo hợp đồng ký gửi, tại Tòa án có thẩm quyền tại TP. Hồ Chí Minh, theo pháp luật Việt Nam hiện hành.",
      "Any fee dispute is resolved under the consignment contract before the competent court in Ho Chi Minh City, under the laws of Vietnam.",
    ],
  },
];

const FAQ: { q: L; a: L }[] = [
  {
    q: ["Ký gửi bất động sản là gì?", "What is property consignment?"],
    a: [
      "Ký gửi bất động sản là việc chủ sở hữu ủy quyền cho SGS LAND thực hiện toàn bộ hoạt động marketing, môi giới và hỗ trợ pháp lý để mua bán hoặc cho thuê tài sản. Hai bên ký Hợp đồng Ký gửi theo quy định Luật KDBĐS 2023.",
      "Consignment means the owner authorises SGS LAND to handle all marketing, brokerage and legal support for selling or letting the property. Both parties sign a consignment contract under the 2023 Real Estate Business Law.",
    ],
  },
  {
    q: ["Hoa hồng được tính như thế nào và khi nào phải trả?", "How is the fee calculated and when is it due?"],
    a: [
      "Hoa hồng chỉ phát sinh khi giao dịch thành công: (1) Mua bán: 1–2% giá trị hợp đồng, thu khi hợp đồng công chứng; (2) Cho thuê ≥12 tháng: 1 tháng tiền thuê; (3) Cho thuê <12 tháng: 50% tháng thuê. Không có bất kỳ khoản phí nào nếu không giao dịch.",
      "Only on a successful transaction: (1) sale — 1–2% of contract value, due on notarisation; (2) lease of 12 months or more — one month's rent; (3) lease under 12 months — 50% of a month's rent. Nothing at all if no deal closes.",
    ],
  },
  {
    q: ["Tôi có cần đặt cọc hay trả phí trước không?", "Do I need to pay a deposit or any fee upfront?"],
    a: [
      "Hoàn toàn không. SGS LAND không thu bất kỳ khoản phí nào trước khi giao dịch thành công. Toàn bộ chi phí marketing — ảnh, video, quảng cáo — do SGS LAND chi trả.",
      "No. SGS LAND charges nothing before a transaction completes, and covers all marketing costs — photography, video and advertising.",
    ],
  },
  {
    q: ["Thời hạn hợp đồng ký gửi là bao lâu?", "How long does a consignment contract run?"],
    a: [
      "Thông thường 3–6 tháng, có thể gia hạn theo thỏa thuận. Trong thời hạn hợp đồng, chủ sở hữu không ký giao dịch độc lập với khách hàng do SGS LAND giới thiệu để tránh tranh chấp hoa hồng.",
      "Typically 3–6 months, renewable by agreement. During the term the owner should not deal directly with clients introduced by SGS LAND, to avoid a fee dispute.",
    ],
  },
  {
    q: ["Tôi có thể tự bán trong thời gian ký gửi không?", "Can I sell it myself during the term?"],
    a: [
      "Có thể — nếu khách mua là người chủ sở hữu tự tìm, không qua SGS LAND. Tuy nhiên, nếu khách mua đã từng được SGS LAND giới thiệu, hoa hồng vẫn phát sinh theo hợp đồng ký gửi (điều khoản bảo lưu khách hàng thường 90 ngày).",
      "Yes — if you found the buyer yourself, independently of SGS LAND. If the buyer was previously introduced by SGS LAND, the fee still applies under the client protection clause (normally 90 days).",
    ],
  },
  {
    q: ["SGS LAND có đảm bảo bán được không?", "Do you guarantee a sale?"],
    a: [
      "SGS LAND cam kết nỗ lực tiếp thị tối đa, nhưng kết quả giao dịch phụ thuộc vào thị trường và giá kỳ vọng của chủ sở hữu. Chúng tôi tư vấn định giá thực tế để tối ưu khả năng giao dịch nhanh.",
      "We commit to a full marketing effort, but the outcome depends on the market and the owner's price expectations. We advise on realistic pricing to maximise the chance of a quick deal.",
    ],
  },
  {
    q: ["Tài liệu pháp lý cần chuẩn bị gồm những gì?", "Which legal documents do I need?"],
    a: [
      "Tối thiểu: (1) Sổ đỏ / Sổ hồng (Giấy CNQSDĐ) bản gốc hoặc photo công chứng; (2) CMND/CCCD của chủ sở hữu; (3) Giấy phép xây dựng (nếu nhà ở). Đội ngũ SGS LAND sẽ hướng dẫn chi tiết sau khi tiếp nhận yêu cầu.",
      "At minimum: (1) the red or pink book (land use right certificate), original or notarised copy; (2) the owner's ID card; (3) the building permit for a house. Our team will guide you in detail once we receive your request.",
    ],
  },
  {
    q: ["Vùng địa lý SGS LAND đang hoạt động?", "Which areas do you cover?"],
    a: [
      "SGS LAND hiện hoạt động tập trung tại TP. Hồ Chí Minh và các tỉnh lân cận (Bình Dương, Đồng Nai, Long An). Đang mở rộng sang Hà Nội và Đà Nẵng. Liên hệ để kiểm tra khả năng ký gửi tại khu vực của bạn.",
      "Mainly Ho Chi Minh City and the neighbouring provinces (Binh Duong, Dong Nai, Long An), with Hanoi and Da Nang opening soon. Contact us to check coverage in your area.",
    ],
  },
];

const PROPERTY_TYPES: L[] = [
  ["Nhà phố", "Townhouse"],
  ["Căn hộ chung cư", "Apartment"],
  ["Đất nền", "Land"],
  ["Biệt thự / Villa", "Villa"],
  ["Nhà mặt tiền thương mại", "Commercial frontage"],
  ["Văn phòng / Mặt bằng", "Office / retail space"],
  ["Kho / Xưởng", "Warehouse / factory"],
  ["Khác", "Other"],
];

/* Backend Express bat buoc double-submit CSRF: doc cookie csrf_token, gui kem header.
   Cookie duoc set boi bat ky GET /api/* nao, nen goi mot lan neu chua co. */
function readCookie(name: string) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
async function csrfToken() {
  let t = readCookie("csrf_token");
  if (!t) {
    await fetch("/api/auth/me", { credentials: "include" }).catch(() => {});
    t = readCookie("csrf_token");
  }
  return t;
}

export default function ConsignmentView() {
  const lang = useLang();
  const i = lang === "en" ? 1 : 0;
  const lp = (p: string) => (lang === "en" ? "/en" + p : p);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", propertyType: "",
    transaction: "SELL", address: "", area: "", price: "", notes: "", agreed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreed) {
      setError(i ? "Please accept the terms before submitting." : "Vui lòng đồng ý điều khoản trước khi gửi.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/public/consignment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": await csrfToken() },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || (i ? "System error" : "Lỗi hệ thống"));
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : i ? "System error" : "Lỗi hệ thống");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full px-4 py-3 rounded-xl text-base outline-none transition-colors";
  const fieldStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    color: "var(--text-primary)",
  } as React.CSSProperties;
  const labelCls = "block text-sm font-semibold mb-1.5";

  return (
    <div>
      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24" style={{ background: "var(--sgs-primary-deep, #0F2740)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <span
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-6"
            style={{ background: "rgba(255,255,255,0.10)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.20)" }}
          >
            <Star className="w-4 h-4" style={{ color: "var(--sgs-accent, #C8963E)" }} />
            {i ? "Trusted property consignment in Ho Chi Minh City" : "Nền tảng ký gửi BĐS uy tín số 1 TP. Hồ Chí Minh"}
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6" style={{ color: "#FFFFFF" }}>
            {i ? "Consign your property" : "Ký gửi bất động sản"}
            <br />
            <span style={{ color: "var(--sgs-accent, #C8963E)" }}>
              {i ? "Free · Secure · Effective" : "Miễn phí · An toàn · Hiệu quả"}
            </span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.82)" }}>
            {i
              ? "You authorise, we handle the rest: AI marketing, contract and legal work, and matching with buyers or tenants. A fee is charged only when the deal closes — nothing if it does not."
              : "Chủ sở hữu ủy quyền — SGS LAND lo toàn bộ: marketing AI, pháp lý hợp đồng, kết nối khách mua/thuê. Hoa hồng chỉ thu khi giao dịch thành công. Không phí nếu không giao dịch."}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#dang-ky"
              className="px-8 py-4 rounded-2xl font-bold text-base"
              style={{ background: "var(--sgs-accent, #C8963E)", color: "#1B2A3A" }}
            >
              {i ? "Register now →" : "Đăng ký ký gửi ngay →"}
            </a>
            <Link
              href={lp("/contact")}
              className="px-8 py-4 rounded-2xl font-semibold text-base"
              style={{ border: "2px solid rgba(255,255,255,0.30)", color: "#FFFFFF" }}
            >
              {i ? "Free consultation" : "Liên hệ tư vấn miễn phí"}
            </Link>
          </div>
        </div>
      </section>

      {/* Loi ich */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            {i ? "Why SGS LAND?" : "Tại sao chọn SGS LAND?"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {BENEFITS.map((b) => (
              <div
                key={b.t[0]}
                className="p-6 rounded-2xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <span
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}
                >
                  <b.icon className="w-6 h-6" />
                </span>
                <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>{b.t[i]}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{b.d[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bieu phi */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20" style={{ background: "var(--bg-elevated)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            {i ? "Commission schedule" : "Biểu phí hoa hồng"}
          </h2>
          <p className="text-center text-base mb-10" style={{ color: "var(--text-secondary)" }}>
            {i ? "Charged only on a completed transaction." : "Chỉ thu khi giao dịch hoàn tất."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {[
                    i ? "Transaction" : "Loại giao dịch",
                    i ? "Rate" : "Mức phí",
                    i ? "Calculated on" : "Tính trên",
                    i ? "Minimum" : "Tối thiểu",
                    i ? "Payable when" : "Thời điểm thu",
                  ].map((h) => (
                    <th key={h} className="py-3 pr-4 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMMISSION.map((c) => (
                  <tr key={c.type[0]} style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <td className="py-4 pr-4 font-semibold text-base" style={{ color: "var(--text-primary)" }}>{c.type[i]}</td>
                    <td className="py-4 pr-4 font-bold text-base" style={{ color: "var(--primary-600)" }}>{c.rate[i]}</td>
                    <td className="py-4 pr-4 text-sm" style={{ color: "var(--text-secondary)" }}>{c.base[i]}</td>
                    <td className="py-4 pr-4 text-sm" style={{ color: "var(--text-secondary)" }}>{c.min}</td>
                    <td className="py-4 text-sm" style={{ color: "var(--text-secondary)" }}>{c.note[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quy trinh */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12" style={{ color: "var(--text-primary)" }}>
            {i ? "The consignment process" : "Quy trình ký gửi"}
          </h2>
          {STEPS.map((s, n) => (
            <div key={s.t[0]} className="flex gap-4 sm:gap-6">
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-2xl font-bold text-base flex items-center justify-center shrink-0"
                  style={{ background: "var(--primary-600)", color: "#FFFFFF" }}
                >
                  {String(n + 1).padStart(2, "0")}
                </div>
                {n < STEPS.length - 1 && <div className="w-0.5 flex-1 mt-2" style={{ background: "var(--border-default)" }} />}
              </div>
              <div className="pb-10 flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--primary-600)", display: "inline-flex" }}><s.icon className="w-5 h-5" /></span>
                  {s.t[i]}
                </h3>
                <p className="text-base leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>{s.d[i]}</p>
                <p className="text-sm leading-relaxed px-3 py-2 rounded-lg"
                  style={{ background: "var(--primary-subtle)", color: "var(--text-secondary)" }}>
                  {s.detail[i]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cam ket phap ly */}
      <section className="px-4 sm:px-6 lg:px-8 py-16" style={{ background: "var(--sgs-primary-deep, #0F2740)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-4 items-start">
            <Lock className="w-8 h-8 shrink-0" style={{ color: "var(--sgs-accent, #C8963E)" }} />
            <div>
              <h2 className="text-2xl font-bold mb-5" style={{ color: "#FFFFFF" }}>
                {i ? "Our legal commitment on fees" : "Cam kết pháp lý về hoa hồng"}
              </h2>
              <div className="space-y-4">
                {LEGAL.map((l) => (
                  <p key={l.t[0]} className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.80)" }}>
                    <strong style={{ color: "#FFFFFF" }}>{l.t[i]}:</strong> {l.d[i]}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20" style={{ background: "var(--bg-elevated)" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10" style={{ color: "var(--text-primary)" }}>
            {i ? "Frequently asked questions" : "Câu hỏi thường gặp"}
          </h2>
          <div className="space-y-3">
            {FAQ.map((f, n) => (
              <div key={f.q[0]} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === n ? null : n)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{f.q[i]}</span>
                  <ChevronDown
                    className="w-5 h-5 shrink-0 transition-transform"
                    style={{ color: "var(--text-tertiary)", transform: openFaq === n ? "rotate(180deg)" : "none" }}
                  />
                </button>
                {openFaq === n && (
                  <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.a[i]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form dang ky */}
      <section id="dang-ky" className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 scroll-mt-24">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            {i ? "Register a consignment" : "Đăng ký ký gửi"}
          </h2>
          <p className="text-center text-base mb-10" style={{ color: "var(--text-secondary)" }}>
            {i ? "Send your details — a specialist calls you within 4 working hours." : "Điền thông tin — chuyên viên SGS LAND liên hệ trong 4 giờ làm việc."}
          </p>

          {submitted ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}>
              <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: "var(--sgs-verified, #0F9D6E)" }} />
              <h3 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                {i ? "Registration received" : "Đăng ký thành công!"}
              </h3>
              <p className="text-base mb-2" style={{ color: "var(--text-secondary)" }}>
                {i ? "We have your consignment request." : "Chúng tôi đã nhận được yêu cầu ký gửi của bạn."}
              </p>
              <p className="text-base mb-6" style={{ color: "var(--text-secondary)" }}>
                {i
                  ? "An SGS LAND specialist will call the number you provided within 4 working hours."
                  : "Chuyên viên SGS LAND sẽ liên hệ qua số điện thoại bạn đã cung cấp trong vòng 4 giờ làm việc."}
              </p>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                {i ? "Any questions: " : "Mọi thắc mắc vui lòng liên hệ: "}
                <a href="mailto:info@sgsland.vn" style={{ color: "var(--primary-600)" }}>info@sgsland.vn</a>
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-2xl p-6 sm:p-8 space-y-5"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="pb-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--primary-600)" }}>
                  {i ? "Owner details" : "Thông tin chủ sở hữu"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                      {i ? "Full name" : "Họ và tên"} <span style={{ color: "#DC2626" }}>*</span>
                    </label>
                    <input type="text" name="name" value={form.name} onChange={change} required
                      placeholder={i ? "Jane Doe" : "Nguyễn Văn A"} className={field} style={fieldStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                      {i ? "Phone" : "Số điện thoại"} <span style={{ color: "#DC2626" }}>*</span>
                    </label>
                    <input type="tel" name="phone" value={form.phone} onChange={change} required
                      placeholder="0901 234 567" className={field} style={fieldStyle} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Email</label>
                  <input type="email" name="email" value={form.email} onChange={change}
                    placeholder={i ? "you@email.com (for confirmation and reports)" : "email@cua-ban.com (nhận xác nhận và báo cáo)"}
                    className={field} style={fieldStyle} />
                </div>
              </div>

              <div className="pb-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--primary-600)" }}>
                  {i ? "Property details" : "Thông tin bất động sản"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                      {i ? "Property type" : "Loại bất động sản"}
                    </label>
                    <select name="propertyType" value={form.propertyType} onChange={change} className={field} style={fieldStyle}>
                      <option value="">{i ? "-- Select --" : "-- Chọn loại --"}</option>
                      {PROPERTY_TYPES.map((p) => (
                        <option key={p[0]} value={p[0]}>{p[i]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                      {i ? "Purpose" : "Mục đích giao dịch"}
                    </label>
                    <div className="flex gap-4 mt-3">
                      {(["SELL", "RENT"] as const).map((v) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="transaction" value={v} checked={form.transaction === v} onChange={change}
                            style={{ accentColor: "var(--primary-600)" }} />
                          <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                            {v === "SELL" ? (i ? "Sell" : "Bán") : (i ? "Lease" : "Cho thuê")}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                    {i ? "Property address" : "Địa chỉ bất động sản"} <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input type="text" name="address" value={form.address} onChange={change} required
                    placeholder={i ? "Number, street, ward, district, province" : "Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"}
                    className={field} style={fieldStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                      {i ? "Area (m²)" : "Diện tích (m²)"}
                    </label>
                    <input type="number" name="area" value={form.area} onChange={change}
                      placeholder={i ? "e.g. 80" : "Ví dụ: 80"} className={field} style={fieldStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                      {i ? "Expected price" : "Giá mong muốn"}
                    </label>
                    <input type="text" name="price" value={form.price} onChange={change}
                      placeholder={i ? "e.g. 5 billion VND or 15 million/month" : "Ví dụ: 5 tỷ hoặc 15 triệu/tháng"}
                      className={field} style={fieldStyle} />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
                  {i ? "Notes" : "Ghi chú thêm"}
                </label>
                <textarea name="notes" value={form.notes} onChange={change} rows={3}
                  placeholder={i ? "Legal status, amenities, standout features, special requests…" : "Tình trạng pháp lý, tiện ích, đặc điểm nổi bật, yêu cầu đặc biệt..."}
                  className={field} style={fieldStyle} />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="agreed" checked={form.agreed} onChange={change}
                  className="mt-1 w-4 h-4 shrink-0" style={{ accentColor: "var(--primary-600)" }} />
                <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {i ? "I agree that SGS LAND may contact me and process my personal data under the " : "Tôi đồng ý để SGS LAND liên hệ tư vấn và xử lý thông tin cá nhân theo "}
                  <Link href={lp("/privacy")} style={{ color: "var(--primary-600)", textDecoration: "underline" }}>
                    {i ? "privacy policy" : "Chính sách bảo mật"}
                  </Link>
                  {i
                    ? ". I understand a fee arises only on a successful transaction, as set out in the consignment contract."
                    : ". Tôi hiểu rằng hoa hồng chỉ phát sinh khi giao dịch thành công và được xác lập trong hợp đồng ký gửi."}
                </span>
              </label>

              {error && (
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-base transition-opacity"
                style={{ background: "var(--primary-600)", color: "#FFFFFF", opacity: submitting ? 0.6 : 1 }}>
                {submitting ? (i ? "Sending…" : "Đang gửi...") : i ? "Send consignment request →" : "Gửi yêu cầu ký gửi →"}
              </button>

              <p className="text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
                {i ? "Or contact us directly: " : "Hoặc liên hệ trực tiếp: "}
                <a href="mailto:info@sgsland.vn" className="font-semibold" style={{ color: "var(--primary-600)" }}>info@sgsland.vn</a>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
