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
      aria-label="SGS LAND"
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
        <img
          src="/logo-white.png"
          alt="SGS Land logo"
          width={40}
          height={40}
          style={{ objectFit: "contain" }}
          aria-hidden
        />
      </div>
      {/* Brand */}
      <p
        style={{
          fontSize: "20px",
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
          fontSize: "14px",
          color: "#64748b",
          margin: "0 0 28px",
          letterSpacing: "0.025em",
        }}
      >
        SGS LAND ...
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
            background: "linear-gradient(90deg, var(--sgs-primary), #7FA8D0)",
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