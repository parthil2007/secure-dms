/**
 * Browser environment bootstrap for the headless smoke test.
 *
 * Installed with `node --require ./smoke/preload.cjs` so it runs BEFORE any
 * other module is evaluated. This matters: esbuild hoists the bundle's static
 * imports (`react-router-dom` → `react-dom`) to the very top, and react-dom
 * decides *at module-init time* whether the DOM exists (`canUseDOM`). In a real
 * browser `window` is always there first; here the preload reproduces exactly
 * that ordering. Without it react-dom falls back to its legacy IE<=9
 * `attachEvent` input polyfill and throws under jsdom.
 */
const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost:5173/login', pretendToBeVisual: true }
);

const w = dom.window;

globalThis.__sdmsDom = dom;
globalThis.window = w;
globalThis.document = w.document;
globalThis.localStorage = w.localStorage;
globalThis.HTMLElement = w.HTMLElement;
globalThis.HTMLInputElement = w.HTMLInputElement;
globalThis.Element = w.Element;
globalThis.Node = w.Node;
globalThis.getComputedStyle = w.getComputedStyle.bind(w);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = () => ({
    matches: false,
    media: '',
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });
}

// jsdom has no layout/observer support; charts only need it to size themselves.
globalThis.ResizeObserver =
  w.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

if (typeof w.scrollTo === 'function') w.scrollTo = () => {};
