import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT_IMPORTER = 'components/blocks/HyperspeedBackground.tsx';
const HYPERSPEED_SPECIFIER = '@/components/blocks/Hyperspeed';

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

function resolveFirstLoadAssets(buildDir) {
  const pageKey = rootPageKey(readManifest(buildDir, 'app-path-routes-manifest.json'));
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

function resolveHyperspeedAssets(buildDir, firstLoadAssets) {
  const manifest = readManifest(buildDir, 'react-loadable-manifest.json');
  if (!isRecord(manifest)) {
    throw new Error('Unsupported react-loadable manifest schema');
  }

  const importerEdges = [];
  for (const [key, value] of Object.entries(manifest)) {
    const edge = parseLoadableEdge(key);
    if (edge.importer === ROOT_IMPORTER) {
      if (!isRecord(value)) {
        throw new Error('Unsupported react-loadable manifest schema: edge value must be an object');
      }
      importerEdges.push({ edge, value });
    }
  }

  if (importerEdges.length === 0) {
    return { status: 'not-built', metrics: null };
  }

  const matchingEdges = importerEdges.filter(({ edge }) => edge.specifier === HYPERSPEED_SPECIFIER);
  if (matchingEdges.length !== 1) {
    throw new Error(
      `Hyperspeed dynamic import edge must map exactly one edge; found ${matchingEdges.length}`,
    );
  }

  const edgeFiles = matchingEdges[0].value.files;
  const assets = resolveJavaScriptAssets(buildDir, edgeFiles, 'Hyperspeed');
  const uniqueAssets = assets.filter((asset) => !firstLoadAssets.includes(asset));

  return {
    status: 'measured',
    metrics: {
      files: uniqueAssets,
      gzipBytes: uniqueAssets.reduce((sum, asset) => sum + gzipSize(path.join(buildDir, asset)), 0),
    },
  };
}

export function gzipSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).byteLength;
}

export function resolveBundleMetrics(buildDir) {
  const firstLoadFiles = resolveFirstLoadAssets(buildDir);
  const hyperspeed = resolveHyperspeedAssets(buildDir, firstLoadFiles);

  return {
    firstLoadJs: {
      files: firstLoadFiles,
      gzipBytes: firstLoadFiles.reduce((sum, asset) => sum + gzipSize(path.join(buildDir, asset)), 0),
    },
    hyperspeed: hyperspeed.metrics,
    hyperspeedStatus: hyperspeed.status,
  };
}

// measured, budget 모두 KB(1024 bytes) 숫자다. 두 지표 모두 target 이하면 pass,
// hard cap을 넘는 지표가 하나라도 있으면 fail, 그 사이면 warn이다. 경계값은
// 낮은 쪽에 붙는다(target과 같으면 pass, hard cap과 같으면 fail이 아니다).
export function checkBudget(measured, budget) {
  const metrics = [
    { label: 'First Load JS', value: measured.firstLoad, target: budget.target.firstLoad, hardCap: budget.hardCap.firstLoad },
    { label: 'Hyperspeed 청크', value: measured.chunk, target: budget.target.chunk, hardCap: budget.hardCap.chunk },
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
  const chunkBuilt = metrics.hyperspeedStatus !== 'not-built';
  const chunkKb = chunkBuilt ? metrics.hyperspeed.gzipBytes / 1024 : null;

  // 아직 안 빌드됐으면 chunk에 target과 정확히 같은 값을 넣어 판정에서 뺀다
  // (target과 같으면 pass이므로 warnings·violations에 기여하지 않는다).
  const measured = { firstLoad: firstLoadKb, chunk: chunkBuilt ? chunkKb : BUNDLE_BUDGET.target.chunk };
  const result = checkBudget(measured, BUNDLE_BUDGET);

  if (!chunkBuilt) {
    process.stdout.write('check-bundle: Hyperspeed 청크가 아직 빌드되지 않아 판정에서 제외한다 (First Load JS만 판정)\n');
  }

  const currentLine = chunkBuilt
    ? `First Load JS ${firstLoadKb.toFixed(1)}KB / target ${BUNDLE_BUDGET.target.firstLoad}KB, Hyperspeed 청크 ${chunkKb.toFixed(1)}KB / target ${BUNDLE_BUDGET.target.chunk}KB`
    : `First Load JS ${firstLoadKb.toFixed(1)}KB / target ${BUNDLE_BUDGET.target.firstLoad}KB`;
  process.stdout.write(`check-bundle: ${result.status}\n${currentLine}\n`);

  if (result.status === 'pass') {
    return;
  }

  const hardCapLine = chunkBuilt
    ? `hard cap: First Load JS ${BUNDLE_BUDGET.hardCap.firstLoad}KB / Hyperspeed 청크 ${BUNDLE_BUDGET.hardCap.chunk}KB`
    : `hard cap: First Load JS ${BUNDLE_BUDGET.hardCap.firstLoad}KB`;
  const assetLines = [`First Load JS 자산: ${metrics.firstLoadJs.files.join(', ')}`];
  if (chunkBuilt) {
    assetLines.push(`Hyperspeed 자산: ${metrics.hyperspeed.files.join(', ')}`);
  }

  if (result.status === 'warn') {
    process.stdout.write(`${hardCapLine}\n${result.warnings.join('\n')}\n${assetLines.join('\n')}\n`);
    return;
  }

  process.stdout.write(`${result.violations.join('\n')}\n${assetLines.join('\n')}\n`);
  process.exitCode = 1;
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
