import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startPublicExportServer } from './serve-public-export.mjs';

test('serves flat and nested Expo routes without masking missing pages', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'v5-public-export-'));
  const server = await startPublicExportServer(root);
  try {
    await mkdir(path.join(root, 'solutions'), { recursive: true });
    await mkdir(path.join(root, 'nested'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), 'home');
    await writeFile(path.join(root, 'solutions/video-studio.html'), 'flat route');
    await writeFile(path.join(root, 'nested/index.html'), 'directory route');
    for (const [route, expected] of [['/', 'home'], ['/solutions/video-studio', 'flat route'], ['/solutions/video-studio/', 'flat route'], ['/nested/', 'directory route']]) {
      const response = await fetch(server.origin + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.equal(await response.text(), expected);
    }
    assert.equal((await fetch(server.origin + '/missing')).status, 404);
    assert.equal((await fetch(server.origin + '/%2e%2e%2foutside')).status, 403);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
