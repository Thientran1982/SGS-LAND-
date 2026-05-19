"use client";

import dynamic from "next/dynamic";

// Lazy-load the heavy dashboard shell
const DashboardShell = dynamic(
  () => import("@/components/private/DashboardShell").then((m) => m.DashboardShell),
  { ssr: false, loading: () => <PrivatePageSkeleton title="Dashboard" /> }
);

export default function DashboardPage() {
  return <DashboardShell />;
}

function PrivatePageSkeleton({ title }: { title: string }) {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-6" style={{ background: "var(--border-default)" }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: "var(--border-default)" }} />
        ))}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: "var(--border-default)" }} />
    </div>
  );
}
