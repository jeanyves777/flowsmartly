/**
 * A static server that rewrites clean URLs to the export's files.
 *
 * `python -m http.server` does not: it serves `/flowagent.html` happily and
 * 404s `/flowagent`. Loading the `.html` form makes expo-router see
 * `/flowagent.html` as the path, match nothing, and render the not-found page —
 * which screenshots as a perfectly convincing 404 rather than as an error.
 * Every capture looked fine and every capture was of the wrong page.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2] ?? 'dist';
const port = Number(process.argv[3] ?? 8092);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolve(pathname) {
  // Normalised and re-rooted, so `..` cannot walk out of the export.
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates =
    clean === '/' || clean === '\\'
      ? [join(root, 'index.html')]
      : [join(root, clean), `${join(root, clean)}.html`, join(root, clean, 'index.html')];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* next */
    }
  }
  return undefined;
}

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  void resolve(pathname).then((file) => {
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://127.0.0.1:${String(port)}`);
});
