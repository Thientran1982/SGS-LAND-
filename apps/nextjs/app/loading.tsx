export default function RootLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-app, #0c0c14)",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
      aria-live="polite"
      aria-label="Đang khởi động hệ thống"
    >
      {/* Animated logo */}
      <div
        style={{
          width: 72,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(79, 70, 229, 0.12)",
          borderRadius: 22,
          marginBottom: 22,
          animation: "sgsGlow 2.4s ease-in-out infinite",
        }}
      >
        <svg
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1B3A5C"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 12l10 5 10-5" />
          <path d="M2 17l10 5 10-5" />
        </svg>
      </div>

      {/* Brand */}
      <p
        style={{
          fontSize: "1.125rem",
          fontWeight: 800,
          letterSpacing: "0.18em",
          color: "var(--text-primary, #f1f5f9)",
          margin: "0 0 6px",
        }}
      >
        SGS LAND
      </p>

      {/* Status */}
      <p
        style={{
          fontSize: "0.8125rem",
          color: "#64748b",
          margin: "0 0 28px",
          letterSpacing: "0.025em",
        }}
      >
        Đang khởi động hệ thống...
      </p>

      {/* Progress bar */}
      <div
        style={{
          width: 180,
          height: 2,
          background: "rgba(79, 70, 229, 0.15)",
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #1B3A5C, #7FA8D0)",
            borderRadius: 9999,
            animation: "sgsFill 6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        />
      </div>

      {/* Keyframe definitions */}
      <style>{`
        @keyframes sgsGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.35); }
          50%       { box-shadow: 0 0 0 14px rgba(79,70,229,0); }
        }
        @keyframes sgsFill {
          0%   { width: 0%; }
          20%  { width: 40%; }
          50%  { width: 65%; }
          80%  { width: 80%; }
          100% { width: 88%; }
        }
      `}</style>
    </div>
  );
}
