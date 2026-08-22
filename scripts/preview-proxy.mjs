import httpProxy from "http-proxy";

const proxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:5000",
  changeOrigin: false,
  ws: true,
});

proxy.on("error", (error, req, res) => {
  // http-proxy passes an http.ServerResponse for normal requests, but passes
  // a net.Socket for failed WebSocket upgrades.  Treating both as a response
  // caused the preview proxy itself to crash while the target was booting.
  if (res && typeof res.writeHead === "function" && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
  }
  if (res && typeof res.end === "function" && !res.writableEnded) {
    res.end("Preview target is starting. Please reload in a moment.");
  } else if (res && typeof res.destroy === "function") {
    res.destroy();
  }
  console.error(`[PreviewProxy] ${error.message}`);
});

const server = proxy.listen(5050, "0.0.0.0", () => {
  console.log("[PreviewProxy] Forwarding 0.0.0.0:5050 to 127.0.0.1:5000");
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.on("error", (error) => {
  console.error(`[PreviewProxy] server error: ${error.message}`);
});