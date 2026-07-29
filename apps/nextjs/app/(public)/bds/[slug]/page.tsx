// @ts-nocheck
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Listing } from "@/types";
import { getLang, langAlternates } from "@/lib/lang";
import { ListingDetailPage } from "@/components/public/ListingDetailPage";
// SSR — listing prices change frequently, must be fresh
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLang();
  const en = lang === "en";
  const base = en ? `https://sgsland.vn/en/bds/${slug}` : `https://sgsland.vn/bds/${slug}`;
  // Extract trailing UUID (e.g. "can-ho-abc-a1b2c3d4-e5f6-7890-abcd-123456789012" → full UUID)
  const TRAILING_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidMatch = slug.match(TRAILING_UUID);
  const code = uuidMatch ? uuidMatch[0] : (slug.split("-").pop() ?? slug);
  let listing: Listing | null = null;
  try {
    const res = await fetch(      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings/${code}`,
      { cache: "no-store" }
    );
    if (res.ok) listing = await res.json();
  } catch {}
  if (!listing) {
    return {
      title: en ? "Property for sale" : "Bất động sản",
      alternates: { canonical: base, ...langAlternates(`/bds/${slug}`) },
      openGraph: { url: `https://sgsland.vn/bds/${slug}` },
    };
  }
  const price = listing.price >= 1e9
    ? (en ? `${(listing.price / 1e9).toFixed(2)}B VND` : `${(listing.price / 1e9).toFixed(2)} tỷ`)
    : (en ? `${Math.round(listing.price / 1e6)}M VND` : `${Math.round(listing.price / 1e6)} triệu`);
  return {
    title: `${listing.title} | ${price}`,
    description: en
      ? `${listing.title} — ${listing.location}. Price: ${price}. ${listing.area}m², ${listing.bedrooms ?? ""} bedrooms. Legal status: ${listing.legalStatus ?? "Updating"}.`
      : `${listing.title} — ${listing.location}. Giá: ${price}. ${listing.area}m², ${listing.bedrooms ?? ""}PN. Pháp lý: ${listing.legalStatus ?? "Đang cập nhật"}.`,
    alternates: { canonical: base, ...langAlternates(`/bds/${slug}`) },
    openGraph: {
      title: `${listing.title}`,
      description: en ? `Price ${price} | ${listing.location} | ${listing.area}m²` : `Giá ${price} | ${listing.location} | ${listing.area}m²`,
      url: base,
      images: listing.images?.[0] ? [{ url: listing.images[0] }] : [],
    },
  };
}
export default async function ListingDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Extract trailing UUID (same logic as generateMetadata)
  const TRAILING_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidMatch = slug.match(TRAILING_UUID);
  const code = uuidMatch ? uuidMatch[0] : (slug.split("-").pop() ?? slug);
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