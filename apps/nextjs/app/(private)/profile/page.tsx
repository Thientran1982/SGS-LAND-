"use client";

export default function ProfilePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Profile
      </h1>
      {/* CSR — component migrated from pages/Profile.tsx */}
      <p style={{ color: "var(--text-secondary)" }}>Loading Profile...</p>
    </div>
  );
}
