import { cp, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { gzipSize, resolveBundleMetrics } from '@/scripts/check-bundle.mjs';

const fixtureRoot = path.resolve(process.cwd(), '__tests__/fixtures/bundle-manifests/valid');
const scriptPath = path.resolve(process.cwd(), 'scripts/check-bundle.mjs');

async function copyFixture() {
  const destination = await mkdtemp(path.join(tmpdir(), 'bundle-manifest-'));
  await cp(fixtureRoot, destination, { recursive: true });
  return destination;
}

async function readFixtureAsset(root: string, relativePath: string) {
  return readFile(path.join(root, relativePath));
}

function runMeasure(root: string) {
  return spawnSync(process.execPath, [scriptPath, '--measure', root], { encoding: 'utf8' });
}

function independentGzipSize(bytes: Buffer) {
  return gzipSync(bytes, { level: 9 }).byteLength;
}

describe('check-bundle resolver', () => {
  it('root page와 layout의 JS 합집합을 gzip level 9로 계산한다', async () => {
    const root = await copyFixture();

    try {
      const metrics = resolveBundleMetrics(root);
      const expectedFiles = [
        'static/chunks/shared.js',
        'static/chunks/page-abc123.js',
        'static/chunks/layout-def456.js',
      ].sort();
      const expectedGzipBytes = await Promise.all(
        expectedFiles.map(async (file) => independentGzipSize(await readFixtureAsset(root, file))),
      );

      expect(metrics.firstLoadJs.files).toEqual(expectedFiles);
      expect(metrics.firstLoadJs.gzipBytes).toBe(expectedGzipBytes.reduce((sum, size) => sum + size, 0));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('Hyperspeed 증가분에서 First Load JS 공유 청크를 한 번만 제외한다', async () => {
    const root = await copyFixture();

    try {
      const metrics = resolveBundleMetrics(root);
      const sharedBytes = await readFixtureAsset(root, 'static/chunks/shared.js');
      const hyperspeedBytes = await readFixtureAsset(root, 'static/chunks/hyperspeed-789abc.js');

      expect(metrics.firstLoadJs.files.filter((file) => file === 'static/chunks/shared.js')).toHaveLength(1);
      expect(metrics.hyperspeed?.files).toEqual(['static/chunks/hyperspeed-789abc.js']);
      expect(metrics.hyperspeed?.gzipBytes).toBe(independentGzipSize(hyperspeedBytes));
      expect(metrics.hyperspeed?.gzipBytes).not.toBe(
        independentGzipSize(sharedBytes) + independentGzipSize(hyperspeedBytes),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('해시 파일명이 바뀌어도 manifest가 가리킨 자산을 계산한다', async () => {
    const root = await copyFixture();

    try {
      await rename(path.join(root, 'static/chunks/page-abc123.js'), path.join(root, 'static/chunks/page-newhash.js'));
      await rename(path.join(root, 'static/chunks/layout-def456.js'), path.join(root, 'static/chunks/layout-newhash.js'));

      const manifestPath = path.join(root, 'app-build-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { pages: Record<string, string[]> };
      manifest.pages['/page'][1] = 'static/chunks/page-newhash.js';
      manifest.pages['/layout'][1] = 'static/chunks/layout-newhash.js';
      await writeFile(manifestPath, JSON.stringify(manifest));

      const metrics = resolveBundleMetrics(root);
      expect(metrics.firstLoadJs.files).toContain('static/chunks/page-newhash.js');
      expect(metrics.firstLoadJs.files).toContain('static/chunks/layout-newhash.js');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('Hyperspeed edge가 아직 없으면 First Load JS와 미구현 상태를 분리한다', async () => {
    const root = await copyFixture();

    try {
      await writeFile(
        path.join(root, 'react-loadable-manifest.json'),
        JSON.stringify({ 'components/blocks/Other.tsx -> @/components/blocks/Other': { id: 2, files: [] } }),
      );

      const metrics = resolveBundleMetrics(root);
      expect(metrics.firstLoadJs.gzipBytes).toBeGreaterThan(0);
      expect(metrics.hyperspeed).toBeNull();
      expect(metrics.hyperspeedStatus).toBe('not-built');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('root app path가 없으면 실패한다', async () => {
      const root = await copyFixture();
    try {
      await writeFile(path.join(root, 'app-path-routes-manifest.json'), JSON.stringify({ '/page': '/other' }));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/root app path/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('manifest가 가리키는 자산이 없으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      await rm(path.join(root, 'static/chunks/page-abc123.js'));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/asset/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('Hyperspeed exact edge가 두 개로 정규화되면 모호성으로 실패한다', async () => {
    const root = await copyFixture();
    try {
      const manifestPath = path.join(root, 'react-loadable-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
      manifest['components/blocks/HyperspeedBackground.tsx -> @/components/blocks/Hyperspeed'] = {
        id: 1002,
        files: ['static/chunks/hyperspeed-789abc.js'],
      };
      await writeFile(manifestPath, JSON.stringify(manifest));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/exactly one|ambiguous/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('importer는 맞지만 specifier가 다르면 누락된 edge로 실패한다', async () => {
    const root = await copyFixture();
    try {
      await writeFile(
        path.join(root, 'react-loadable-manifest.json'),
        JSON.stringify({
          'components/blocks/HyperspeedBackground.tsx -> @/components/blocks/Other': {
            id: 2,
            files: ['static/chunks/hyperspeed-789abc.js'],
          },
        }),
      );
      expect(() => resolveBundleMetrics(root)).toThrow(/edge/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('지원하지 않는 manifest schema는 실패한다', async () => {
    const root = await copyFixture();
    try {
      await writeFile(path.join(root, 'app-build-manifest.json'), JSON.stringify({ pages: [] }));
      expect(() => resolveBundleMetrics(root)).toThrow(/schema/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('gzipSize는 raw bytes가 아닌 독립 gzip level 9 결과와 일치한다', async () => {
    const root = await copyFixture();
    try {
      const file = path.join(root, 'static/chunks/page-abc123.js');
      const bytes = await readFile(file);
      expect(gzipSize(file)).toBe(independentGzipSize(bytes));
      expect(gzipSize(file)).not.toBe(bytes.byteLength);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('--measure가 JSON 측정 경로를 실행한다', () => {
    const result = spawnSync(process.execPath, [scriptPath, '--measure', fixtureRoot], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ hyperspeedStatus: 'measured' });
  });
});
