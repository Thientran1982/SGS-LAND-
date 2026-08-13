"use client";
/**
 * Khung chat cua trang /livechat.
 * Dung chung MinhChatPanel cua @sgs/chat-widget -> noi thang toi agent Minh:
 * tao lead trong CRM, luu hoi thoai, socket.io realtime va human takeover.
 */
import { MinhChatPanel } from "@sgs/chat-widget";

export default function LiveChatPanel() {
  return (
    <MinhChatPanel
      source="WEB"
      heightClass="h-[520px]"
      className="bg-slate-900/60 shadow-2xl"
    />
  );
}
