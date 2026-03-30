import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createServer } from './http/create-server.js';
import { config } from './config.js';

export function startServer({ port = config.port, host = config.host } = {}) {
  const app = createApp();
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`[${config.projectDisplayName}/${config.projectSlug}] listening on http://${host}:${server.address().port}`);
      resolve({ app, server, port: server.address().port, host });
    });
  });
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entryPath) {
  startServer();
}
