export default function RootLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-app, #0c0c14)",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Đang tải"
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "2px solid rgba(148, 163, 184, 0.35)",
          borderTopColor: "var(--primary-600, #4f46e5)",
          borderRadius: "9999px",
          animation: "sgsSpin 0.8s linear infinite",
        }}
      />
      <style>{`
        @keyframes sgsSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}