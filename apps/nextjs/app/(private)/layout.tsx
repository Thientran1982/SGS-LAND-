// Force all private (CRM) pages through normal SSR instead of the limited
// Next.js 15 prerender phase — CrmShell is a "use client" component that
// calls useState/useEffect which crash under the ContextOnlyDispatcher.
export const dynamic = "force-dynamic";
import { Providers } from "@/components/shared/Providers";
import { CrmShell } from "@/components/private/CrmShell";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <CrmShell>{children}</CrmShell>
    </Providers>
  );
}