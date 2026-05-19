"use client";

export default function FavoritesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Favorites
      </h1>
      {/* CSR — component migrated from pages/Favorites.tsx */}
      <p style={{ color: "var(--text-secondary)" }}>Loading Favorites...</p>
    </div>
  );
}
