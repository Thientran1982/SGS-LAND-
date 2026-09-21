"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { PublicListingCard } from "./MarketplacePage";
import { useLang } from "@/components/shared/useLang";
import { readFavoriteIds, subscribeFavoriteChanges } from "@/lib/favorites";

type PublicListing = Record<string, any> & { id: string };

export function FavoritesPage() {
  const lang = useLang();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const refreshIds = () => setFavoriteIds(readFavoriteIds());
    refreshIds();
    return subscribeFavoriteChanges(refreshIds);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (favoriteIds.length === 0) {
      setListings([]);
      setFailedCount(0);
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setFailedCount(0);
    Promise.all(
      favoriteIds.map(async (id) => {
        try {
          const response = await fetch(`/api/public/listings/${encodeURIComponent(id)}`, {
            cache: "no-store",
            credentials: "include",
          });
          if (!response.ok) return null;
          return await response.json() as PublicListing;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const available = results.filter((listing): listing is PublicListing => Boolean(listing?.id));
      setListings(available);
      setFailedCount(results.length - available.length);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [favoriteIds]);

  const isEnglish = lang === "en";
  const browseHref = isEnglish ? "/en/marketplace" : "/marketplace";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <section
        className="mb-8 overflow-hidden rounded-3xl px-5 py-7 sm:px-8"
        style={{
          background: "linear-gradient(120deg, var(--sgs-hero-deep, #0A2540), #1B3A5C)",
          color: "#fff",
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/75">
              <Heart className="h-4 w-4 fill-current" aria-hidden />
              {isEnglish ? "Your saved properties" : "Bộ sưu tập của bạn"}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {isEnglish ? "Favorites" : "Đã yêu thích"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              {isEnglish
                ? "Properties you saved with the heart button are collected here for quick viewing."
                : "Các sản phẩm bạn đã bấm biểu tượng trái tim sẽ được tập hợp ở đây để xem lại nhanh hơn."}
            </p>
          </div>
          <Link
            href={browseHref}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
            style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
          >
            {isEnglish ? "Browse more" : "Tìm thêm BĐS"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {failedCount > 0 && (
        <p className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
          {isEnglish
            ? `${failedCount} saved ${failedCount === 1 ? "property is" : "properties are"} no longer publicly available.`
            : `${failedCount} BĐS đã lưu hiện không còn hiển thị công khai.`}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-[390px] animate-pulse rounded-3xl" style={{ background: "var(--bg-elevated)" }} />
          ))}
        </div>
      ) : listings.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {listings.length} {isEnglish ? "saved properties" : "BĐS đã lưu"}
            </h2>
            <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              {isEnglish ? "Tap the heart to remove" : "Bấm trái tim để bỏ lưu"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => (
              <PublicListingCard key={listing.id} listing={listing} eager />
            ))}
          </div>
        </>
      ) : (
        <section className="rounded-3xl border px-6 py-16 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
            <Heart className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {isEnglish ? "Your favorites are empty" : "Bạn chưa có BĐS yêu thích"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            {isEnglish
              ? "When you find a property you like, tap the heart icon. You can return here to view it again."
              : "Khi thấy sản phẩm phù hợp, hãy bấm biểu tượng trái tim. Bạn có thể quay lại đây để xem lại bất cứ lúc nào."}
          </p>
          <Link href={browseHref} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: "var(--sgs-primary)" }}>
            {isEnglish ? "Explore properties" : "Khám phá BĐS"}
          </Link>
        </section>
      )}
    </div>
  );
}