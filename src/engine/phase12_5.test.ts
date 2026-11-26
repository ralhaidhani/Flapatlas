import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import capacitorConfig from '../../capacitor.config';
import { dismissTopBackLayer } from '../hooks/useBackNavigation';
import { useAtlasStore } from '../store/useAtlasStore';

const ROOT = process.cwd();

test('Prompt 12-5: capacitor.config.ts defines required appId, appName, webDir, and androidScheme', () => {
  assert.equal(capacitorConfig.appId, 'com.flapatlas.app');
  assert.equal(capacitorConfig.appName, 'FlapAtlas 3D');
  assert.equal(capacitorConfig.webDir, 'dist');
  assert.equal(capacitorConfig.server?.androidScheme, 'https');
});

test('Prompt 12-5: package.json includes all four Capacitor packages and build:android script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  assert.ok(allDeps['@capacitor/core'], '@capacitor/core must be installed');
  assert.ok(allDeps['@capacitor/cli'], '@capacitor/cli must be installed');
  assert.ok(allDeps['@capacitor/android'], '@capacitor/android must be installed');
  assert.ok(allDeps['@capacitor/app'], '@capacitor/app must be installed');
  assert.ok(pkg.scripts?.['build:android'], 'build:android script must be present');
  assert.ok(pkg.scripts['build:android'].includes('cap sync android'));
});

test('Prompt 12-5: .github/workflows/android.yml has full cloud debug APK build pipeline', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/android.yml'), 'utf8');
  assert.ok(workflow.includes('actions/checkout@'));
  assert.ok(workflow.includes('actions/setup-node@'));
  assert.ok(workflow.includes('npm ci'));
  assert.ok(workflow.includes('npm run build'));
  assert.ok(workflow.includes('npx cap add android'));
  assert.ok(workflow.includes('if [ ! -d "android" ]'), 'cap add android must run only if /android is absent');
  assert.ok(workflow.includes('npx cap sync android'));
  assert.ok(workflow.includes('actions/setup-java@'));
  assert.ok(workflow.includes('temurin'));
  assert.ok(workflow.includes('./gradlew assembleDebug'));
  assert.ok(workflow.includes('actions/upload-artifact@'));
  assert.ok(workflow.includes('android/app/build/outputs/apk/debug/app-debug.apk'));
});

test('Prompt 12-5: hardware Back handler wires @capacitor/app and follows menu -> sheet -> mode -> exit priority', () => {
  const hookSrc = fs.readFileSync(path.join(ROOT, 'src/hooks/useBackNavigation.ts'), 'utf8');
  assert.ok(hookSrc.includes('@capacitor/app'));
  assert.ok(hookSrc.includes("addListener('backButton'"));
  assert.ok(hookSrc.includes('exitApp'));

  // Verify layered dismissal order
  const st = useAtlasStore.getState();
  st.setMenuOpen(true);
  st.setSheetSnap('half');
  st.setMeasureMode(true);

  assert.equal(dismissTopBackLayer(), true);
  assert.equal(useAtlasStore.getState().menuOpen, false);
  assert.equal(useAtlasStore.getState().sheetSnap, 'half');

  assert.equal(dismissTopBackLayer(), true);
  assert.equal(useAtlasStore.getState().sheetSnap, 'collapsed');
  assert.equal(useAtlasStore.getState().measureMode, true);

  assert.equal(dismissTopBackLayer(), true);
  assert.equal(useAtlasStore.getState().measureMode, false);

  assert.equal(dismissTopBackLayer(), false);
});
