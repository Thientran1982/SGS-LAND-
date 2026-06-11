import type { NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
        fontFamily: "sans-serif",
        textAlign: "center",
        padding: "1rem",
      }}
    >
      <h1 style={{ fontSize: "4rem", fontWeight: "bold", margin: 0 }}>
        {statusCode ?? "Lỗi"}
      </h1>
      <p style={{ color: "#6b7280", maxWidth: "28rem" }}>
        {statusCode === 404
          ? "Không tìm thấy trang bạn yêu cầu."
          : "Đã xảy ra lỗi phía máy chủ."}
      </p>
      <a
        href="/"
        style={{
          backgroundColor: "#4f46e5",
          color: "#fff",
          padding: "0.75rem 1.5rem",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontSize: "0.875rem",
          fontWeight: "500",
        }}
      >
        Về trang chủ
      </a>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
