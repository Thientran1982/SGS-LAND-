import http from 'node:http';

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1) {
  process.stderr.write('[startup-smoke-fixture] invalid backend port\n');
  process.exit(2);
}

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  response.writeHead(404);
  response.end();
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`[startup-smoke-fixture] backend listening on ${port}\n`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);