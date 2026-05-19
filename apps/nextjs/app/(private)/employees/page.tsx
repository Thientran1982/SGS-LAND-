"use client";

export default function EmployeesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Employees
      </h1>
      {/* CSR — component migrated from pages/Employees.tsx */}
      <p style={{ color: "var(--text-secondary)" }}>Loading Employees...</p>
    </div>
  );
}
