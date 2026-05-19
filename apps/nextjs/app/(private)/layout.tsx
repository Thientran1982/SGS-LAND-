// Private layout — auth guard is handled by middleware.ts
// Pure Server Component: no hooks, no "use client" needed
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      {children}
    </div>
  );
}
