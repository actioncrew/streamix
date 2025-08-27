// esm-loader.mjs
import { readFileSync } from 'fs';
import { dirname, resolve as resolvePath } from 'path';
import stripJsonComments from 'strip-json-comments';
import { load as loadTs, resolve as resolveTs } from 'ts-node/esm';
import { createMatchPath } from 'tsconfig-paths';
import { fileURLToPath, pathToFileURL } from 'url';

// Load and register tsconfig paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tsConfig = JSON.parse(stripJsonComments(readFileSync(resolvePath(__dirname, 'tsconfig.json'), 'utf8')));

const baseUrl = tsConfig.compilerOptions.baseUrl;
const paths = tsConfig.compilerOptions.paths;
const matchPath = createMatchPath(baseUrl, paths);

export function resolve(specifier, context, defaultResolve) {
  // Use tsconfig-paths to resolve the specifier
  const resolvedPath = matchPath(specifier, undefined, undefined, ['.ts', '.js', '.json']);

  if (resolvedPath) {
    // If tsconfig-paths resolves it, convert the absolute path to a URL
    // so it can be handled correctly on Windows in ESM mode.
    return resolveTs(pathToFileURL(resolvedPath).href, context, defaultResolve);
  }

  // If tsconfig-paths doesn't resolve it, fall back to the default
  return resolveTs(specifier, context, defaultResolve);
}

export { loadTs as load };

