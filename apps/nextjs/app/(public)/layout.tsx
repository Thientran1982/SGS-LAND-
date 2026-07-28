// Force all public pages through normal SSR instead of the limited Next.js 15
// prerender phase — PublicHeader is "use client" and calls useState/useEffect
// which crash under the ContextOnlyDispatcher.
export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { Providers } from "@/components/shared/Providers";
import { PublicHeader } from "@/components/public/PublicHeaderNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { AiChatWidgetWrapper } from "@/components/public/AiChatWidgetWrapper";
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const _c = await cookies();
  const _authed = Boolean(_c.get("token")?.value || _c.get("auth_token")?.value || _c.get("sgs_token")?.value);
  return (
    <Providers>
      <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-app)" }}>
        <PublicHeader authed={_authed} />
        <main className="flex-1">{children}</main>
        <PublicFooter />
        {/* Floating AI Chat Widget */}
        <AiChatWidgetWrapper />
      </div>
    </Providers>
  );
}