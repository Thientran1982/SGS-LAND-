export default function MarketplaceLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pb-10 pt-3 sm:pt-24" style={{ background: "var(--bg-app)" }}>
      <div className="rounded-3xl overflow-hidden animate-pulse" style={{ background: "var(--sgs-hero-deep)", minHeight: 220 }} />
      <div className="flex items-center justify-between gap-3 mt-5 mb-4">
        <div className="h-10 w-56 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        <div className="h-10 w-28 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-10 rounded-xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-72 rounded-3xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        ))}
      </div>
    </div>
  );
}