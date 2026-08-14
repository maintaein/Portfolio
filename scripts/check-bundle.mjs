import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT_IMPORTER = 'components/blocks/HyperspeedBackground.tsx';
const HYPERSPEED_SPECIFIER = '@/components/blocks/Hyperspeed';

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

function runMeasure() {
  const buildDir = path.resolve(process.cwd(), process.argv[3] ?? '.next');
  const metrics = resolveBundleMetrics(buildDir);
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}

if (process.argv[2] === '--measure') {
  try {
    runMeasure();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`check-bundle: ${message}\n`);
    process.exitCode = 1;
  }
}
