import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Listing } from "@/types";
import { ListingDetailPage } from "@/components/public/ListingDetailPage";

// SSR — listing prices change frequently, must be fresh
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const code = slug.split("-").pop() ?? slug; // e.g. "can-ho-aqua-city-LST123" → "LST123"

  let listing: Listing | null = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings/${code}`,
      { cache: "no-store" }
    );
    if (res.ok) listing = await res.json();
  } catch {}

  if (!listing) {
    return { title: "Bất động sản | SGS LAND" };
  }

  const price = listing.price >= 1e9
    ? `${(listing.price / 1e9).toFixed(2)} tỷ`
    : `${Math.round(listing.price / 1e6)} triệu`;

  return {
    title: `${listing.title} | ${price} | SGS LAND`,
    description: `${listing.title} — ${listing.location}. Giá: ${price}. ${listing.area}m², ${listing.bedrooms ?? ""}PN. Pháp lý: ${listing.legalStatus ?? "Đang cập nhật"}.`,
    alternates: { canonical: `https://sgsland.vn/bds/${slug}` },
    openGraph: {
      title: `${listing.title} | SGS LAND`,
      description: `Giá ${price} | ${listing.location} | ${listing.area}m²`,
      url: `https://sgsland.vn/bds/${slug}`,
      images: listing.images?.[0] ? [{ url: listing.images[0] }] : [],
    },
  };
}

export default async function ListingDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parts = slug.split("-");
  // Last part is the listing code (LST123456)
  const code = parts[parts.length - 1].startsWith("LST") || parts[parts.length - 1].startsWith("MCC")
    ? parts[parts.length - 1]
    : slug;

  let listing: Listing | null = null;
  let similarListings: Listing[] = [];

  try {
    const [listingRes, similarRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings/${code}`, { cache: "no-store" }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings?limit=4&similar=${code}`, { cache: "no-store" }),
    ]);

    if (listingRes.ok) listing = await listingRes.json();
    if (similarRes.ok) {
      const d = await similarRes.json();
      similarListings = d.data ?? [];
    }
  } catch {}

  if (!listing) notFound();

  return <ListingDetailPage listing={listing} similarListings={similarListings} />;
}
