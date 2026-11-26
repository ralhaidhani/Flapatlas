import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildLocalBundledManifest,
  getBundledDracoPath,
  groupManifestByStage,
  OFFLINE_PACK_REQUIRED_FILES,
} from '../models/modelManifest';
import { evaluateOfflinePackReadiness, formatBytes } from '../models/offlineManager';

const ROOT = process.cwd();

test('Prompt 12-4: index.html and src/index.css have zero external CDN or font network dependencies', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!/fonts\.googleapis\.com/i.test(indexHtml), 'index.html must not link Google Fonts');
  assert.ok(!/fonts\.gstatic\.com/i.test(indexHtml), 'index.html must not preconnect gstatic');
  assert.ok(!/esm\.sh|unpkg\.com|cdn\.jsdelivr\.net|cdn\.tailwindcss\.com/i.test(indexHtml));
  assert.ok(indexHtml.includes('./apple-touch-icon.png'), 'apple-touch-icon should be relative');
  assert.ok(indexHtml.includes('./icon.svg'), 'icon.svg should be relative');

  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  assert.ok(!/Plus Jakarta Sans|IBM Plex Mono|fonts\.googleapis\.com/i.test(indexCss));
  assert.ok(/system-ui/i.test(indexCss), 'index.css should use system font stack');
});

test('Prompt 12-4: all 7 GLBs + 4 JSONs are bundled in /public/models/ with valid headers/JSON', () => {
  const glbs = [
    'skeleton.glb',
    'muscles.glb',
    'skin.glb',
    'arteries.glb',
    'veins.glb',
    'nerves.glb',
    'organs.glb',
  ];
  for (const name of glbs) {
    const filePath = path.join(ROOT, 'public/models', name);
    assert.ok(fs.existsSync(filePath), `Missing bundled GLB: ${name}`);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    assert.equal(buf.toString('ascii'), 'glTF', `${name} must have valid glTF binary header`);
  }

  const jsons = [
    'vessel_index.json',
    'flap_pedicle_map.json',
    'angiosome_bp3d_map.json',
    'muscle_reference.json',
  ];
  for (const name of jsons) {
    const filePath = path.join(ROOT, 'public/models', name);
    assert.ok(fs.existsSync(filePath), `Missing bundled JSON: ${name}`);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(parsed && typeof parsed === 'object', `${name} must be valid JSON`);
  }
});

test('Prompt 12-4: Draco decoder files and PWA PNG icons are bundled locally and BASE_URL-aware', () => {
  const dracoFiles = ['draco_decoder.wasm', 'draco_wasm_wrapper.js', 'draco_decoder.js'];
  for (const name of dracoFiles) {
    const filePath = path.join(ROOT, 'public/draco', name);
    assert.ok(fs.existsSync(filePath), `Missing Draco file: ${name}`);
    assert.ok(fs.statSync(filePath).size > 1024, `${name} should be non-empty`);
  }

  assert.equal(getBundledDracoPath('./'), './draco/');
  assert.equal(getBundledDracoPath('/flapatlas-3d/'), '/flapatlas-3d/draco/');

  const icons = [
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png',
    'apple-touch-icon.png',
  ];
  for (const name of icons) {
    const filePath = path.join(ROOT, 'public', name);
    assert.ok(fs.existsSync(filePath), `Missing icon: ${name}`);
    const header = fs.readFileSync(filePath).subarray(0, 4);
    assert.deepEqual(Array.from(header), [0x89, 0x50, 0x4e, 0x47], `${name} must be a PNG`);
  }
});

test('Prompt 12-4: buildLocalBundledManifest has zero external URLs and puts skeleton+muscles+skin in Stage 1', () => {
  const manifest = buildLocalBundledManifest('./');
  assert.equal(manifest.length, 7);
  for (const entry of manifest) {
    assert.ok(!/^https?:\/\//i.test(entry.url), `Bundled entry must not be remote: ${entry.url}`);
    assert.ok(entry.url.startsWith('./models/'), `Bundled entry should use BASE_URL: ${entry.url}`);
    assert.equal(entry.fallbackUrls.length, 0, 'Bundled offline entry must have no CDN fallback');
  }

  const stages = groupManifestByStage(manifest);
  assert.deepEqual(
    stages[0].entries.map((e) => e.system),
    ['skeleton', 'muscles', 'skin']
  );
  assert.deepEqual(
    stages[1].entries.map((e) => e.system),
    ['arteries', 'veins', 'nerves']
  );
  assert.deepEqual(
    stages[2].entries.map((e) => e.system),
    ['organs']
  );
});

test('Prompt 12-4: Offline ready ✓ requires EVERY required file; coreReady unlocks after skeleton+muscles+skin+Draco', () => {
  assert.equal(OFFLINE_PACK_REQUIRED_FILES.length, 14);

  // Empty
  const empty = evaluateOfflinePackReadiness(new Set());
  assert.equal(empty.coreReady, false);
  assert.equal(empty.offlineReady, false);
  assert.equal(empty.cachedFiles, 0);

  // Core only (skeleton + muscles + skin + 3 Draco files)
  const coreIds = new Set(
    OFFLINE_PACK_REQUIRED_FILES.filter((f) => f.tier === 'core').map((f) => f.id)
  );
  const coreOnly = evaluateOfflinePackReadiness(coreIds);
  assert.equal(coreOnly.coreReady, true);
  assert.equal(coreOnly.offlineReady, false);
  assert.equal(coreOnly.coreCachedFiles, 6);

  // 13 of 14 files -> still NOT offlineReady
  const allMinusOne = new Set(OFFLINE_PACK_REQUIRED_FILES.slice(0, 13).map((f) => f.id));
  const almost = evaluateOfflinePackReadiness(allMinusOne);
  assert.equal(almost.offlineReady, false);

  // All 14 files -> offlineReady true
  const allIds = new Set(OFFLINE_PACK_REQUIRED_FILES.map((f) => f.id));
  const full = evaluateOfflinePackReadiness(allIds);
  assert.equal(full.coreReady, true);
  assert.equal(full.offlineReady, true);
  assert.equal(full.pct, 100);

  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('Prompt 12-4: vite.config.ts and .github/workflows/pages.yml match offline-first PWA & GitHub Pages spec', () => {
  const viteCfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  assert.ok(/base:\s*'\.\/'/.test(viteCfg), "vite.config.ts must set base: './'");
  assert.ok(/registerType:\s*'prompt'/.test(viteCfg), "VitePWA must use registerType: 'prompt'");
  assert.ok(/manifestFilename:\s*'manifest\.webmanifest'/.test(viteCfg));
  assert.ok(/orientation:\s*'any'/.test(viteCfg));
  assert.ok(/display:\s*'standalone'/.test(viteCfg));
  assert.ok(/navigateFallback:\s*'index\.html'/.test(viteCfg));
  assert.ok(/cleanupOutdatedCaches:\s*true/.test(viteCfg));
  assert.ok(/maximumFileSizeToCacheInBytes:\s*15\s*\*\s*1024\s*\*\s*1024/.test(viteCfg));
  assert.ok(!/fonts\.googleapis\.com|cdn\.jsdelivr\.net/i.test(viteCfg));

  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.ok(workflow.includes('actions/checkout@'));
  assert.ok(workflow.includes('actions/setup-node@'));
  assert.ok(workflow.includes('npm ci'));
  assert.ok(workflow.includes('npm run build'));
  assert.ok(workflow.includes('actions/upload-pages-artifact@'));
  assert.ok(workflow.includes('actions/deploy-pages@'));
});
