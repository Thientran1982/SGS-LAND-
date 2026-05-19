"use client";

export default function TasksPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Tasks
      </h1>
      {/* CSR — component migrated from pages/Tasks.tsx */}
      <p style={{ color: "var(--text-secondary)" }}>Loading Tasks...</p>
    </div>
  );
}
