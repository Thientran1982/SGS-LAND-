import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { AiChatWidgetWrapper } from "@/components/public/AiChatWidgetWrapper";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-app)" }}>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      {/* Floating AI Chat Widget */}
      <AiChatWidgetWrapper />
    </div>
  );
}
