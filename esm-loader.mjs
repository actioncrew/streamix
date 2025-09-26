// esm-loader.mjs
import { existsSync, readFileSync } from "fs";
import { dirname, join as joinPath, resolve as resolvePath } from "path";
import stripJsonComments from "strip-json-comments";
import { load as loadTs, resolve as resolveTs } from "ts-node/esm";
import { createMatchPath } from "tsconfig-paths";
import { fileURLToPath, pathToFileURL } from "url";

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load tsconfig.json safely
const tsConfigRaw = readFileSync(resolvePath(__dirname, "tsconfig.json"), "utf8");
const tsConfig = JSON.parse(stripJsonComments(tsConfigRaw));

const compilerOptions = tsConfig.compilerOptions ?? {};
const baseUrl = compilerOptions.baseUrl
  ? resolvePath(__dirname, compilerOptions.baseUrl)
  : __dirname;
const paths = compilerOptions.paths ?? {};

const matchPath = createMatchPath(baseUrl, paths);

// Helpers to try candidate files
function tryResolveWithExtensions(absPath) {
  const exts = [".ts", ".tsx", ".js", ".jsx", ".json"];
  for (const ext of exts) {
    if (existsSync(absPath + ext)) {
      return absPath + ext;
    }
  }
  // Check for index files in a folder
  for (const ext of exts) {
    const idx = joinPath(absPath, "index" + ext);
    if (existsSync(idx)) {
      return idx;
    }
  }
  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  // 1. Try resolving via tsconfig-paths
  const resolvedPath = matchPath(specifier, undefined, undefined, [".ts", ".tsx", ".js", ".jsx", ".json"]);
  if (resolvedPath) {
    return resolveTs(pathToFileURL(resolvedPath).href, context, defaultResolve);
  }

  // 2. Handle relative imports without extension
  if (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")) {
    const parentFile = fileURLToPath(context.parentURL);
    const candidate = resolvePath(dirname(parentFile), specifier);
    const withExt = tryResolveWithExtensions(candidate);

    if (withExt) {
      return resolveTs(pathToFileURL(withExt).href, context, defaultResolve);
    }
  }

  // 3. Fallback to ts-node/esm default resolver
  return resolveTs(specifier, context, defaultResolve);
}

export { loadTs as load };

