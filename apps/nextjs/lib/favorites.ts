export const FAVORITES_STORAGE_KEY = "sgs_favorites";
const FAVORITES_CHANGE_EVENT = "sgs-favorites-change";

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const next = Array.from(new Set(ids)).slice(0, 300);
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT, { detail: next }));
  } catch {
    // Private browsing or a full storage quota should not break the card.
  }
}

export function toggleFavoriteId(id: string): { ids: string[]; saved: boolean } {
  const current = readFavoriteIds();
  const saved = !current.includes(id);
  const ids = saved ? [id, ...current] : current.filter((item) => item !== id);
  writeFavoriteIds(ids);
  return { ids, saved };
}

export function subscribeFavoriteChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_STORAGE_KEY) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(FAVORITES_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(FAVORITES_CHANGE_EVENT, onCustom);
  };
}