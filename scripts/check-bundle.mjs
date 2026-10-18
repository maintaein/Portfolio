import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const GSAP_SPECIFIER = '@/lib/gsap';
const LUMINOUS_MODULE = 'components/blocks/LuminousFlowBackground/index.tsx';

// 예산 상수는 이 한 곳에만 둔다. KB(1024 bytes) 단위다.
const BUNDLE_BUDGET = {
  target: { firstLoad: 200, chunk: 180 },
  hardCap: { firstLoad: 210, chunk: 212 },
};

function readManifest(buildDir, fileName) {
  const file = path.join(buildDir, fileName);

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${fileName}: ${message}`);
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeImporter(importer) {
  return importer.replaceAll('\\', '/');
}

function manifestAssetPath(buildDir, asset) {
  const normalizedAsset = asset.replaceAll('\\', '/');
  const absoluteAsset = path.resolve(buildDir, normalizedAsset);
  const relativeAsset = path.relative(buildDir, absoluteAsset);

  if (relativeAsset.startsWith('..') || path.isAbsolute(relativeAsset)) {
    throw new Error(`Manifest asset escapes build directory: ${asset}`);
  }

  if (!existsSync(absoluteAsset)) {
    throw new Error(`Manifest asset does not exist: ${asset}`);
  }

  return normalizedAsset;
}

function resolveJavaScriptAssets(buildDir, entry, label) {
  if (!Array.isArray(entry) || entry.some((asset) => typeof asset !== 'string')) {
    throw new Error(`Unsupported ${label} manifest schema: expected an asset array`);
  }

  const assets = new Set();
  for (const asset of entry) {
    if (!asset.endsWith('.js')) continue;
    assets.add(manifestAssetPath(buildDir, asset));
  }

  if (assets.size === 0) {
    throw new Error(`${label} manifest has no JavaScript assets`);
  }

  return [...assets].sort();
}

function rootPageKey(appPathRoutesManifest) {
  if (!isRecord(appPathRoutesManifest)) {
    throw new Error('Unsupported app path routes manifest schema');
  }

  const rootEntries = Object.entries(appPathRoutesManifest).filter(([, appPath]) => appPath === '/');
  if (rootEntries.length !== 1) {
    throw new Error('Unable to resolve exactly one root app path');
  }

  const [pageKey] = rootEntries[0];
  if (!pageKey.endsWith('/page')) {
    throw new Error(`Unsupported root app path key: ${pageKey}`);
  }

  return pageKey;
}

function ancestorLayoutKeys(pageKey) {
  const segments = pageKey.split('/').filter(Boolean);
  if (segments.pop() !== 'page') {
    throw new Error(`Unsupported app page key: ${pageKey}`);
  }

  const layouts = [];
  for (let length = segments.length; length >= 0; length -= 1) {
    const prefix = segments.slice(0, length);
    layouts.push(`/${[...prefix, 'layout'].join('/')}`);
  }
  return layouts;
}

function resolveFirstLoadAssets(buildDir, pageKey) {
  const appBuildManifest = readManifest(buildDir, 'app-build-manifest.json');

  if (!isRecord(appBuildManifest) || !isRecord(appBuildManifest.pages)) {
    throw new Error('Unsupported app build manifest schema');
  }

  const entries = [pageKey, ...ancestorLayoutKeys(pageKey)];
  const assets = new Set();
  for (const entryKey of entries) {
    if (!(entryKey in appBuildManifest.pages)) {
      throw new Error(`Missing app build manifest entry: ${entryKey}`);
    }

    for (const asset of resolveJavaScriptAssets(buildDir, appBuildManifest.pages[entryKey], entryKey)) {
      assets.add(asset);
    }
  }

  return [...assets].sort();
}

function parseLoadableEdge(key) {
  if (typeof key !== 'string') {
    throw new Error('Unsupported react-loadable manifest schema: edge key must be a string');
  }

  const separator = key.indexOf(' -> ');
  if (separator === -1) {
    throw new Error('Unsupported react-loadable manifest schema: malformed edge');
  }

  return {
    importer: normalizeImporter(key.slice(0, separator)),
    specifier: key.slice(separator + 4),
  };
}

// 홈 chunk가 `r.e(청크id)...then(r.bind(r,모듈id))`로 부르는 지연 import 호출을 찾는다.
// react-loadable manifest의 edge는 importer가 아니라 대상 모듈 id로만 홈과 이어진다.
function findDynamicImportCalls(source) {
  const calls = [];
  for (const match of source.matchAll(/((?:[\w$]+\.e\(\d+\)[,\s]*)*)[\]\)]*\.then\([\w$]+\.bind\([\w$]+,(\d+)\)\)/g)) {
    calls.push({
      moduleId: Number(match[2]),
      chunkIds: [...match[1].matchAll(/\.e\((\d+)\)/g)].map((chunk) => Number(chunk[1])),
    });
  }
  return calls;
}

// 같은 대상 모듈을 다른 route(prototype 등)가 불러도 edge의 숫자 이름 chunk가
// 홈 호출이 요청한 chunk 안에 있을 때만 홈 edge로 본다.
function isHomeEdge(call, value) {
  return (
    value.id === call.moduleId &&
    Array.isArray(value.files) &&
    value.files.every((file) => {
      // Next의 라이브러리 분할 chunk 이름은 8자리 hex라 우연히 전부 숫자일 수 있다. 숫자 chunk id는 7자리 이하만 본다.
      const chunkId = /(?:^|\/)(\d{1,7})\.[^/]*\.js$/.exec(normalizeImporter(file))?.[1];
      return chunkId === undefined || call.chunkIds.includes(Number(chunkId));
    })
  );
}

function resolveDeferredAssets(buildDir, firstLoadAssets) {
  const manifest = readManifest(buildDir, 'react-loadable-manifest.json');
  if (!isRecord(manifest)) {
    throw new Error('Unsupported react-loadable manifest schema');
  }

  const edges = Object.entries(manifest).map(([key, value]) => {
    if (!isRecord(value)) {
      throw new Error('Unsupported react-loadable manifest schema: edge value must be an object');
    }
    return { ...parseLoadableEdge(key), value };
  });

  // 홈 chunk에서 시작해, 지연 chunk 안의 중첩 import까지 고정점까지 따라간다.
  const deferred = new Set();
  const homeEdges = new Set();
  const pending = [...firstLoadAssets];
  while (pending.length > 0) {
    const source = readFileSync(path.join(buildDir, pending.pop()), 'utf8');
    for (const call of findDynamicImportCalls(source)) {
      // 모듈 id가 같은 edge가 있는데 하나도 홈 호출의 chunk 목록과 맞지 않으면 측정이 조용히 빠지므로 실패시킨다.
      const sameModule = edges.filter((edge) => edge.value.id === call.moduleId);
      if (sameModule.length > 0 && !sameModule.some((edge) => isHomeEdge(call, edge.value))) {
        const names = sameModule.map((edge) => `${edge.importer} -> ${edge.specifier}`).join(', ');
        throw new Error(`Home dynamic import of module ${call.moduleId} matches no react-loadable edge by chunk list: ${names}`);
      }
      for (const edge of edges) {
        if (homeEdges.has(edge) || !isHomeEdge(call, edge.value)) continue;
        homeEdges.add(edge);
        for (const asset of resolveJavaScriptAssets(buildDir, edge.value.files, `${edge.importer} -> ${edge.specifier}`)) {
          if (firstLoadAssets.includes(asset) || deferred.has(asset)) continue;
          deferred.add(asset);
          pending.push(asset);
        }
      }
    }
  }

  if (![...homeEdges].some((edge) => edge.specifier === GSAP_SPECIFIER)) {
    throw new Error(`Home route has no dynamic import edge for ${GSAP_SPECIFIER}`);
  }

  const files = [...deferred].sort();
  return {
    files,
    // 홈 chunk는 importer가 아니라 대상 모듈만 가리키므로 대상(specifier)만 보고한다.
    targets: [...new Set([...homeEdges].map((edge) => edge.specifier))].sort(),
    gzipBytes: files.reduce((sum, asset) => sum + gzipSize(path.join(buildDir, asset)), 0),
  };
}

// Luminous는 정적 import라 별도 지연 chunk가 없어야 한다. client reference manifest에
// chunks가 빈 모듈로 올라와 있어야 First Load에 포함된 것으로 본다.
function resolveLuminousStatus(buildDir, pageKey) {
  const fileName = `server/app${pageKey}_client-reference-manifest.js`;
  const marker = `globalThis.__RSC_MANIFEST["${pageKey}"]=`;
  let source;
  try {
    source = readFileSync(path.join(buildDir, fileName), 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${fileName}: ${message}`);
  }

  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Unsupported client reference manifest schema: ${fileName}`);
  }

  const { clientModules } = JSON.parse(source.slice(start + marker.length).replace(/;\s*$/, ''));
  if (!isRecord(clientModules)) {
    throw new Error(`Unsupported client reference manifest schema: ${fileName}`);
  }

  const luminous = Object.entries(clientModules).find(([file]) => normalizeImporter(file).endsWith(`/${LUMINOUS_MODULE}`));
  if (!luminous) {
    throw new Error(`Luminous module is not in the home client graph: ${LUMINOUS_MODULE}`);
  }
  if (!Array.isArray(luminous[1].chunks) || luminous[1].chunks.length > 0) {
    throw new Error('Luminous must be statically included, but it loads separate chunks');
  }

  return 'static';
}

export function gzipSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).byteLength;
}

export function resolveBundleMetrics(buildDir) {
  const pageKey = rootPageKey(readManifest(buildDir, 'app-path-routes-manifest.json'));
  const firstLoadFiles = resolveFirstLoadAssets(buildDir, pageKey);
  const deferred = resolveDeferredAssets(buildDir, firstLoadFiles);

  return {
    firstLoadJs: {
      files: firstLoadFiles,
      gzipBytes: firstLoadFiles.reduce((sum, asset) => sum + gzipSize(path.join(buildDir, asset)), 0),
    },
    deferred,
    luminous: resolveLuminousStatus(buildDir, pageKey),
  };
}

// measured, budget 모두 KB(1024 bytes) 숫자다. 두 지표 모두 target 이하면 pass,
// hard cap을 넘는 지표가 하나라도 있으면 fail, 그 사이면 warn이다. 경계값은
// 낮은 쪽에 붙는다(target과 같으면 pass, hard cap과 같으면 fail이 아니다).
export function checkBudget(measured, budget) {
  const metrics = [
    { label: 'First Load JS', value: measured.firstLoad, target: budget.target.firstLoad, hardCap: budget.hardCap.firstLoad },
    { label: '지연 청크', value: measured.chunk, target: budget.target.chunk, hardCap: budget.hardCap.chunk },
  ];

  const warnings = [];
  const violations = [];

  for (const metric of metrics) {
    if (metric.value > metric.hardCap) {
      violations.push(`${metric.label} ${metric.value.toFixed(1)}KB가 hard cap ${metric.hardCap}KB를 초과했다`);
    } else if (metric.value > metric.target) {
      warnings.push(`${metric.label} ${metric.value.toFixed(1)}KB가 target ${metric.target}KB를 초과했다`);
    }
  }

  const status = violations.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
  return { status, warnings, violations };
}

function runMeasure() {
  const buildDir = path.resolve(process.cwd(), process.argv[3] ?? '.next');
  const metrics = resolveBundleMetrics(buildDir);
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}

function runCheck() {
  const buildDir = path.resolve(process.cwd(), '.next');
  const metrics = resolveBundleMetrics(buildDir);

  const firstLoadKb = metrics.firstLoadJs.gzipBytes / 1024;
  const chunkKb = metrics.deferred.gzipBytes / 1024;
  const result = checkBudget({ firstLoad: firstLoadKb, chunk: chunkKb }, BUNDLE_BUDGET);

  const lines = [
    `check-bundle: ${result.status}`,
    `First Load JS ${firstLoadKb.toFixed(1)}KB / target ${BUNDLE_BUDGET.target.firstLoad}KB, 지연 청크 ${chunkKb.toFixed(1)}KB / target ${BUNDLE_BUDGET.target.chunk}KB`,
    'Luminous: 정적 포함 (지연 청크 없음)',
  ];

  if (result.status !== 'pass') {
    lines.push(
      `hard cap: First Load JS ${BUNDLE_BUDGET.hardCap.firstLoad}KB / 지연 청크 ${BUNDLE_BUDGET.hardCap.chunk}KB`,
      ...result.warnings,
      ...result.violations,
      `First Load JS 자산: ${metrics.firstLoadJs.files.join(', ')}`,
      `지연 대상: ${metrics.deferred.targets.join(', ')}`,
      `지연 자산: ${metrics.deferred.files.join(', ')}`,
    );
  }

  process.stdout.write(`${lines.join('\n')}\n`);
  if (result.status === 'fail') process.exitCode = 1;
}

// vitest 워커 등 라이브러리로 import될 때는 process.argv[1]이 이 파일이
// 아니므로 CLI를 돌리지 않는다. `node scripts/check-bundle.mjs`로 직접 실행됐을
// 때만 아래 분기를 탄다.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun && process.argv[2] === '--measure') {
  try {
    runMeasure();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`check-bundle: ${message}\n`);
    process.exitCode = 1;
  }
} else if (isDirectRun && !process.argv[2]) {
  try {
    runCheck();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`check-bundle: ${message}\n`);
    process.exitCode = 1;
  }
}
