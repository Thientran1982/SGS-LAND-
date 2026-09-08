"use client";
/**
 * Khung chat cua trang /livechat.
 * Dung chung MinhChatPanel cua @sgs/chat-widget -> noi thang toi agent Minh:
 * tao lead trong CRM, luu hoi thoai, socket.io realtime va human takeover.
 */
import { MinhChatPanel } from "@sgs/chat-widget";
import { useEffect, useState } from "react";

type AuthenticatedChatUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export default function LiveChatPanel({
  source = "WEB",
  title,
  description,
  initialMessage,
}: {
  source?: string;
  title?: string;
  description?: string;
  initialMessage?: string;
}) {
  const [authResolved, setAuthResolved] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedChatUser | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/auth/me", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json().catch(() => null);
        return data?.user || null;
      })
      .then((user) => {
        if (!alive) return;
        setAuthenticatedUser(user?.id ? user : null);
        setAuthResolved(true);
      })
      .catch(() => {
        if (alive) setAuthResolved(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!authResolved) {
    return (
      <div
        className="h-[520px] rounded-[20px] bg-slate-900/60 shadow-2xl animate-pulse"
        aria-label="Đang tải live chat"
      />
    );
  }

  return (
    <MinhChatPanel
      source={source}
      title={title}
      description={description}
      initialMessage={initialMessage}
      authenticatedUser={authenticatedUser}
      heightClass="h-[520px]"
      className="bg-slate-900/60 shadow-2xl"
    />
  );
}
