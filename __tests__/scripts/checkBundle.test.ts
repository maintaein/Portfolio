import { cp, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BUNDLE_BUDGET, checkBudget, gzipSize, resolveBundleMetrics } from '@/scripts/check-bundle.mjs';

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

async function readLoadableManifest(root: string) {
  return JSON.parse(await readFile(path.join(root, 'react-loadable-manifest.json'), 'utf8')) as Record<string, unknown>;
}

function runMeasure(root: string) {
  return spawnSync(process.execPath, [scriptPath, '--measure', root], { encoding: 'utf8' });
}

function independentGzipSize(bytes: Buffer) {
  return gzipSync(bytes, { level: 9 }).byteLength;
}

// 이 파일의 테스트는 임시 디렉터리에 fixture를 통째로 복사하고 node 서브프로세스를
// 띄운다. 기본 5초는 전체 스위트가 병렬로 도는 상황에서 부족하다. 계획 3 Task 4가
// vi.mock('three')를 쓰는 무거운 테스트 파일 둘을 더하자 4건이 타임아웃했다.
// 실제 수행 시간이 아니라 다른 파일과의 CPU 경합 대기가 원인이므로 넉넉히 준다.
describe('check-bundle resolver', { timeout: 30_000 }, () => {
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

  it('지연 자산은 홈이 부르는 edge의 합집합이고 공유 chunk는 한 번만 센다', async () => {
    const root = await copyFixture();

    try {
      const metrics = resolveBundleMetrics(root);
      const expectedFiles = [
        'static/chunks/202.aaa111.js',
        'static/chunks/650.bbb222.js',
        'static/chunks/462.ccc333.js',
        'static/chunks/777.ddd444.js',
        'static/chunks/948.eee555.js',
        'static/chunks/131.fff666.js',
      ].sort();
      const expectedGzipBytes = await Promise.all(
        expectedFiles.map(async (file) => independentGzipSize(await readFixtureAsset(root, file))),
      );

      // 202는 gsap과 PreviewMorph edge가 함께 가리키고, shared.js는 First Load에 이미 있다.
      expect(metrics.deferred.files).toEqual(expectedFiles);
      expect(metrics.deferred.gzipBytes).toBe(expectedGzipBytes.reduce((sum, size) => sum + size, 0));
      expect(metrics.deferred.files).not.toContain('static/chunks/shared.js');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('홈이 부르지 않는 prototype 전용 edge와 chunk는 세지 않는다', async () => {
    const root = await copyFixture();

    try {
      const metrics = resolveBundleMetrics(root);

      expect(metrics.deferred.files).not.toContain('static/chunks/888.hhh888.js');
      // 같은 모듈 id를 prototype도 부르지만 그쪽 전용 chunk(512)는 홈 호출에 없다.
      expect(metrics.deferred.files).not.toContain('static/chunks/512.ggg777.js');
      expect(metrics.deferred.targets).not.toContain('@/components/blocks/PrototypeOnly');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('이름이 우연히 8자리 숫자인 해시 chunk도 edge에서 탈락시키지 않는다', async () => {
    const root = await copyFixture();

    try {
      await writeFile(path.join(root, 'static/chunks/12345678.zzz999.js'), 'window.__bundle_digit_named__ = true;');
      const manifest = await readLoadableManifest(root);
      const key = 'components\\sections\\ProjectsSection\\index.tsx -> @/components/blocks/PreviewMorph';
      (manifest[key] as { files: string[] }).files.push('static/chunks/12345678.zzz999.js');
      await writeFile(path.join(root, 'react-loadable-manifest.json'), JSON.stringify(manifest));

      const metrics = resolveBundleMetrics(root);
      expect(metrics.deferred.targets).toContain('@/components/blocks/PreviewMorph');
      expect(metrics.deferred.files).toContain('static/chunks/12345678.zzz999.js');
      expect(metrics.deferred.files).toContain('static/chunks/777.ddd444.js');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('홈 호출의 chunk 목록에 없는 숫자 chunk를 edge가 요구하면 조용히 빼지 않고 실패한다', async () => {
    const root = await copyFixture();

    try {
      // 홈 호출은 r.e(202), r.e(462)만 부르는데 edge는 부모가 미리 올리는 chunk 999도 요구한다.
      await writeFile(path.join(root, 'static/chunks/999.iii999.js'), 'window.__bundle_parent_loaded__ = true;');
      const manifest = await readLoadableManifest(root);
      const key = 'components\\sections\\ProjectsSection\\index.tsx -> @/components/blocks/PreviewMorph';
      (manifest[key] as { files: string[] }).files.push('static/chunks/999.iii999.js');
      await writeFile(path.join(root, 'react-loadable-manifest.json'), JSON.stringify(manifest));

      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/module 3462/);
      expect(result.stderr).toMatch(/PreviewMorph/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('지연 chunk 안의 중첩 import도 홈 지연 자산으로 센다', async () => {
    const root = await copyFixture();

    try {
      expect(resolveBundleMetrics(root).deferred.files).toContain('static/chunks/777.ddd444.js');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('나중에 홈에 추가된 dynamic import edge도 목록 수정 없이 측정한다', async () => {
    const root = await copyFixture();

    try {
      await writeFile(path.join(root, 'static/chunks/999.iii999.js'), 'window.__bundle_new_plugin__ = true;');
      const manifest = await readLoadableManifest(root);
      manifest['components\\sections\\NewSection\\index.tsx -> @/components/blocks/NewPlugin'] = {
        id: 9990,
        files: ['static/chunks/999.iii999.js'],
      };
      await writeFile(path.join(root, 'react-loadable-manifest.json'), JSON.stringify(manifest));
      const pagePath = path.join(root, 'static/chunks/page-abc123.js');
      await writeFile(
        pagePath,
        `${await readFile(pagePath, 'utf8')}r.e(999).then(r.bind(r,9990));`,
      );

      const metrics = resolveBundleMetrics(root);
      expect(metrics.deferred.files).toContain('static/chunks/999.iii999.js');
      expect(metrics.deferred.targets).toContain('@/components/blocks/NewPlugin');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('정적 Luminous는 지연 chunk 없이 정적 포함으로 구분한다', async () => {
    const root = await copyFixture();

    try {
      const metrics = resolveBundleMetrics(root);
      expect(metrics.luminous).toBe('static');
      expect(metrics.deferred.targets.some((target: string) => /Luminous/i.test(target))).toBe(false);
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
      expect(metrics.deferred.files).toContain('static/chunks/650.bbb222.js');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('홈에 @/lib/gsap 지연 edge가 없으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      const manifest = await readLoadableManifest(root);
      for (const key of Object.keys(manifest)) {
        if (key.endsWith('-> @/lib/gsap')) delete manifest[key];
      }
      await writeFile(path.join(root, 'react-loadable-manifest.json'), JSON.stringify(manifest));

      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/@\/lib\/gsap/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('gsap edge가 있어도 홈이 부르지 않으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      const pagePath = path.join(root, 'static/chunks/page-abc123.js');
      const page = await readFile(pagePath, 'utf8');
      await writeFile(pagePath, page.replace('r.bind(r,2650)', 'r.bind(r,1)'));

      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/@\/lib\/gsap/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('react-loadable manifest가 없으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      await rm(path.join(root, 'react-loadable-manifest.json'));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/react-loadable-manifest/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('client reference manifest가 없으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      await rm(path.join(root, 'server/app/page_client-reference-manifest.js'));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/client-reference-manifest/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('Luminous가 홈 client graph에 없으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      const manifestPath = path.join(root, 'server/app/page_client-reference-manifest.js');
      const source = await readFile(manifestPath, 'utf8');
      await writeFile(manifestPath, source.replace('LuminousFlowBackground', 'SomethingElse'));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Luminous/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('Luminous가 별도 chunk를 요구하면 정적 포함이 아니므로 실패한다', async () => {
    const root = await copyFixture();
    try {
      const manifestPath = path.join(root, 'server/app/page_client-reference-manifest.js');
      const source = await readFile(manifestPath, 'utf8');
      await writeFile(manifestPath, source.replace('"id":11,"name":"*","chunks":[]', '"id":11,"name":"*","chunks":["x"]'));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Luminous/);
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

  it('홈 edge가 가리키는 지연 자산이 없으면 실패한다', async () => {
    const root = await copyFixture();
    try {
      await rm(path.join(root, 'static/chunks/650.bbb222.js'));
      const result = runMeasure(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/asset/i);
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
    expect(JSON.parse(result.stdout)).toMatchObject({ luminous: 'static' });
  });
});

describe('check-bundle CLI', { timeout: 30_000 }, () => {
  async function runCheckIn(cwd: string) {
    return spawnSync(process.execPath, [scriptPath], { cwd, encoding: 'utf8' });
  }

  async function projectWithBuild() {
    const project = await mkdtemp(path.join(tmpdir(), 'bundle-project-'));
    await cp(fixtureRoot, path.join(project, '.next'), { recursive: true });
    return project;
  }

  it('측정이 되면 지연 청크와 Luminous 정적 포함을 함께 보고한다', async () => {
    const project = await projectWithBuild();
    try {
      const result = await runCheckIn(project);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('check-bundle: pass');
      expect(result.stdout).toContain('지연 청크');
      expect(result.stdout).toContain('Luminous: 정적 포함 (지연 청크 없음)');
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });

  it('gsap edge가 없으면 통과로 대체하지 않고 실패한다', async () => {
    const project = await projectWithBuild();
    try {
      const manifestPath = path.join(project, '.next/react-loadable-manifest.json');
      await writeFile(manifestPath, JSON.stringify({}));
      const result = await runCheckIn(project);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/@\/lib\/gsap/);
      expect(result.stdout).not.toContain('check-bundle: pass');
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});

// 사용자 결정(2026-10-21, Task 9): 크리스털 볼을 위해 지연 hard cap을 212에서 230KB로 올린다. target 180은 그대로(warn만).
it('지연 청크 hard cap은 230KB, target은 180KB이고 First Load 예산은 그대로다', () => {
  expect(BUNDLE_BUDGET).toEqual({ target: { firstLoad: 200, chunk: 180 }, hardCap: { firstLoad: 210, chunk: 230 } });
});

describe('checkBudget', () => {
  const budget = {
    target: { firstLoad: 200, chunk: 180 },
    hardCap: { firstLoad: 210, chunk: 230 },
  };

  it('target 안이면 pass', () => {
    expect(checkBudget({ firstLoad: 180, chunk: 150 }, budget).status).toBe('pass');
  });

  it('target 초과·hard cap 이하면 warn', () => {
    const r = checkBudget({ firstLoad: 205, chunk: 190 }, budget);
    expect(r.status).toBe('warn');
    expect(r.warnings).toHaveLength(2);
  });

  it('First Load hard cap 초과는 fail', () => {
    const r = checkBudget({ firstLoad: 211, chunk: 180 }, budget);
    expect(r.status).toBe('fail');
    expect(r.violations[0]).toContain('First Load');
  });

  it('두 hard cap을 모두 초과하면 둘 다 보고한다', () => {
    const r = checkBudget({ firstLoad: 211, chunk: 231 }, budget);
    expect(r.status).toBe('fail');
    expect(r.violations).toHaveLength(2);
  });

  it('target과 정확히 같으면 pass, hard cap과 같으면 warn', () => {
    expect(checkBudget({ firstLoad: 200, chunk: 180 }, budget).status).toBe('pass');
    expect(checkBudget({ firstLoad: 210, chunk: 230 }, budget).status).toBe('warn');
    expect(checkBudget({ firstLoad: 200, chunk: 213 }, budget).status).toBe('warn');
  });
});
