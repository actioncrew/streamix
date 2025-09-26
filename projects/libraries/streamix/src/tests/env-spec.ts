// Environment detection
const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

const isBrowser =
  typeof window !== "undefined" &&
  typeof window.document !== "undefined";

// Suite-level wrappers (describe only accepts sync functions)
export function describeNode(name: string, fn: () => void) {
  return isNode ? describe(name, fn) : xdescribe(name, fn);
}

export function describeBrowser(name: string, fn: () => void) {
  return isBrowser ? describe(name, fn) : xdescribe(name, fn);
}

// Spec-level wrappers (it allows async callbacks with DoneFn)
export function itNode(name: string, fn: jasmine.ImplementationCallback) {
  return isNode ? it(name, fn) : xit(name, fn);
}

export function itBrowser(name: string, fn: jasmine.ImplementationCallback) {
  return isBrowser ? it(name, fn) : xit(name, fn);
}

// Export environment flags too
export { isBrowser, isNode };

