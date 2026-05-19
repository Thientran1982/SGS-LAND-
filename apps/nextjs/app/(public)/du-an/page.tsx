import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Building2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Dự Án Bất Động Sản | SGS LAND",
  description: "Khám phá các dự án BĐS lớn nhất TP.HCM, Đồng Nai, Bình Dương, Long An. Aqua City, The Global City, Vinhomes, Masterise Homes và nhiều dự án nổi bật khác.",
  alternates: { canonical: "https://sgsland.vn/du-an" },
};
export const revalidate = 21600;

const PROJECTS = [
  { slug: "aqua-city", name: "Aqua City Novaland", dev: "Novaland", loc: "Biên Hòa, Đồng Nai", scale: "1.000 ha", price: "Từ 6,5 tỷ", type: "Đại đô thị sinh thái", badge: "Đang bàn giao", hot: true },
  { slug: "the-global-city", name: "The Global City", dev: "Masterise Homes", loc: "An Phú, TP Thủ Đức", scale: "117 ha", price: "Từ 15 tỷ", type: "Đại đô thị thương mại", badge: "Đang mở bán", hot: true },
  { slug: "vinhomes-grand-park", name: "Vinhomes Grand Park", dev: "Vinhomes", loc: "TP Thủ Đức, TP.HCM", scale: "271 ha", price: "Từ 4,5 tỷ", type: "Siêu đô thị đa năng", badge: "Đang bàn giao", hot: false },
  { slug: "vinhomes-can-gio", name: "Vinhomes Cần Giờ", dev: "Vinhomes", loc: "Cần Giờ, TP.HCM", scale: "2.870 ha", price: "Từ 12 tỷ", type: "Siêu đô thị lấn biển", badge: "Đang bán", hot: true },
  { slug: "vinhomes-central-park", name: "Vinhomes Central Park", dev: "Vinhomes", loc: "Bình Thạnh, TP.HCM", scale: "43,9 ha", price: "Từ 5 tỷ", type: "Khu căn hộ - công viên", badge: "Thứ cấp", hot: false },
  { slug: "izumi-city", name: "Izumi City Nam Long", dev: "Nam Long Group", loc: "Biên Hòa, Đồng Nai", scale: "170 ha", price: "Từ 8,4 tỷ", type: "Đô thị chuẩn Nhật", badge: "Đang mở bán", hot: false },
  { slug: "masterise-homes", name: "Masterise Homes", dev: "Masterise Group", loc: "TP.HCM", scale: "Nhiều dự án", price: "Từ 5 tỷ", type: "Hệ sinh thái cao cấp", badge: "Đang bán", hot: false },
  { slug: "van-phuc-city", name: "Văn Phúc City", dev: "Văn Phúc Group", loc: "Thủ Đức, TP.HCM", scale: "198 ha", price: "Từ 15 tỷ", type: "Khu đô thị phức hợp", badge: "Thứ cấp", hot: false },
  { slug: "sala", name: "Sala Đại Quang Minh", dev: "Đại Quang Minh", loc: "TP Thủ Đức, TP.HCM", scale: "98 ha", price: "Từ 8 tỷ", type: "Đô thị ven sông", badge: "Thứ cấp", hot: false },
  { slug: "thu-thiem", name: "Thủ Thiêm", dev: "Nhiều chủ đầu tư", loc: "TP Thủ Đức, TP.HCM", scale: "657 ha", price: "Từ 20 tỷ", type: "Trung tâm tài chính mới", badge: "Đang phát triển", hot: false },
  { slug: "son-kim-land", name: "Sơn Kim Land", dev: "Sơn Kim Group", loc: "TP.HCM", scale: "Nhiều dự án", price: "Từ 6 tỷ", type: "BĐS cao cấp", badge: "Đang bán", hot: false },
  { slug: "manhattan", name: "Manhattan", dev: "Hưng Thịnh Land", loc: "Quận 7, TP.HCM", scale: "5,1 ha", price: "Từ 4,5 tỷ", type: "Căn hộ cao tầng", badge: "Thứ cấp", hot: false },
];

export default function DuAnPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Dự Án Bất Động Sản</h1>
        <p style={{ color: "var(--text-secondary)" }}>{PROJECTS.length} dự án lớn tại TP.HCM, Đồng Nai, Bình Dương, Long An</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PROJECTS.map((p) => (
          <Link key={p.slug} href={`/du-an/${p.slug}`}
            className="p-5 rounded-2xl flex flex-col gap-3 hover:scale-[1.01] transition-transform group"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="p-2.5 rounded-xl" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex gap-1.5">
                {p.hot && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#ef4444", color: "#fff" }}>HOT</span>}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{p.badge}</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-base mb-1 group-hover:text-indigo-500 transition-colors" style={{ color: "var(--text-primary)" }}>{p.name}</h2>
              <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>{p.dev} · {p.type}</p>
              <p className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <MapPin className="w-3 h-3 shrink-0" />{p.loc}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
              <div>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Quy mô</p>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.scale}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Giá</p>
                <p className="text-sm font-bold" style={{ color: "var(--primary-600)" }}>{p.price}</p>
              </div>
              <ArrowRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
