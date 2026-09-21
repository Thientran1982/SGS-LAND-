"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Heart, Reply } from "lucide-react";

export type ChatActionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const FAVORITES_STORAGE_PREFIX = "sgs_chat_favorites:";

function readFavorites(storageKey: string): string[] {
  try {
    const value = window.localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeFavorites(storageKey: string, ids: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Favorites remain available for the current session when storage is blocked.
  }
}

export function useChatMessageActions(scope: string) {
  const storageKey = FAVORITES_STORAGE_PREFIX + scope;
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFavoriteIds(readFavorites(storageKey));
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, [storageKey]);

  const toggleFavorite = useCallback((messageId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId];
      writeFavorites(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const copyMessage = useCallback(async (message: ChatActionMessage) => {
    const copyWithFallback = () => {
      const textarea = document.createElement("textarea");
      textarea.value = message.content;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("copy_failed");
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.content);
      } else {
        copyWithFallback();
      }
      setCopiedMessageId(message.id);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedMessageId(null), 1_500);
    } catch {
      try {
        copyWithFallback();
        setCopiedMessageId(message.id);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setCopiedMessageId(null), 1_500);
      } catch {
        setCopiedMessageId(null);
      }
    }
  }, []);

  return {
    favoriteIds,
    copiedMessageId,
    toggleFavorite,
    copyMessage,
  };
}

export function ChatMessageActions({
  message,
  isFavorite,
  copied,
  dark = false,
  onToggleFavorite,
  onReply,
  onCopy,
}: {
  message: ChatActionMessage;
  isFavorite: boolean;
  copied: boolean;
  dark?: boolean;
  onToggleFavorite: (messageId: string) => void;
  onReply: (message: ChatActionMessage) => void;
  onCopy: (message: ChatActionMessage) => void;
}) {
  const actionClass =
    `inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent p-0 transition-colors ${
      dark ? "hover:bg-white/10" : "hover:bg-black/5"
    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1`;
  const mutedColor = dark ? "rgba(255,255,255,0.72)" : "var(--cw-ink-dim, #8A8474)";
  const activeColor = dark ? "rgba(255,255,255,0.96)" : "var(--cw-gold, #C6923D)";

  return (
    <div className="mt-1 flex items-center gap-0.5" aria-label="Thao tác tin nhắn">
      <button
        type="button"
        aria-label={isFavorite ? "Bỏ yêu thích tin nhắn" : "Thêm tin nhắn vào yêu thích"}
        aria-pressed={isFavorite}
        title={isFavorite ? "Bỏ yêu thích" : "Yêu thích"}
        className={actionClass}
        style={{ color: isFavorite ? activeColor : mutedColor }}
        onClick={() => onToggleFavorite(message.id)}
      >
        <Heart className="h-3.5 w-3.5" fill={isFavorite ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        aria-label="Trả lời tin nhắn"
        title="Trả lời"
        className={actionClass}
        style={{ color: mutedColor }}
        onClick={() => onReply(message)}
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={copied ? "Đã sao chép tin nhắn" : "Sao chép tin nhắn"}
        title={copied ? "Đã sao chép" : "Sao chép"}
        className={actionClass}
        style={{ color: copied ? activeColor : mutedColor }}
        onClick={() => onCopy(message)}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}