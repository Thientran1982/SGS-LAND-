import httpProxy from "http-proxy";

const proxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:5000",
  changeOrigin: false,
  ws: true,
});

proxy.on("error", (error, req, res) => {
  if (res && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
  }
  if (res && !res.writableEnded) {
    res.end("Preview target is starting. Please reload in a moment.");
  }
  console.error(`[PreviewProxy] ${error.message}`);
});

const server = proxy.listen(5050, "0.0.0.0", () => {
  console.log("[PreviewProxy] Forwarding 0.0.0.0:5050 to 127.0.0.1:5000");
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});