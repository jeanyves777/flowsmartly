import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

/** Local QA only: serve Expo's flat or directory routes without rewriting dist. */
export async function startPublicExportServer(root, port = 0) {
  root = path.resolve(root);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const requested = path.resolve(root, `.${pathname}`);
      if (requested !== root && !requested.startsWith(root + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      const route = requested.replace(/[\\/]+$/, '');
      const candidates = requested === root
        ? [path.join(root, 'index.html')]
        : [requested, `${route}.html`, path.join(requested, 'index.html')];
      for (const candidate of candidates) {
        if (!(await stat(candidate).catch(() => null))?.isFile()) continue;
        const body = await readFile(candidate);
        response.writeHead(200, { 'Content-Type': types[path.extname(candidate)] || 'application/octet-stream' });
        response.end(body);
        return;
      }
      response.writeHead(404).end('Not found');
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
