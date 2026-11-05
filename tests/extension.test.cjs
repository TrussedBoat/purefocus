const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = (name) => readFileSync(`${__dirname}/../extension/${name}`, 'utf8');
const keys = ['youtubeHomeFeed', 'youtubeSuggestions', 'youtubeEndScreen'];
const classes = ['pf-hide-home-feed', 'pf-hide-suggestions', 'pf-hide-end-screen'];

function harness(saved = {}, hostname = 'www.youtube.com') {
  const active = new Set();
  const redirects = [];
  const listeners = {};
  const elements = [];
  const frames = new Map();
  const observers = [];
  let nextFrame = 0;
  function element(tag) {
    return {
      tag, children: [], classList: { add() {} },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, fn) { this[type] = fn; },
    };
  }
  const list = element('ul');
  const context = vm.createContext({
    console,
    location: { hostname, pathname: '/watch', search: '', get href() { return `https://${this.hostname}${this.pathname}${this.search}`; }, replace: (url) => redirects.push(url) },
    document: {
      querySelectorAll: () => [],
      addEventListener(type, fn) { listeners[type] = fn; },
      documentElement: { classList: { toggle(name, on) { on ? active.add(name) : active.delete(name); } } },
      getElementById: () => list,
      createElement(tag) { const node = element(tag); elements.push(node); return node; },
    },
    chrome: {
      runtime: { getURL: (path) => `extension://${path}`, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
      storage: {
        local: {
          async get(defaults) { return { ...defaults, ...saved }; },
          async set(update) { Object.assign(saved, update); },
        },
        onChanged: { addListener(fn) { listeners.storage = fn; } },
      },
    },
    window: { addEventListener(type, fn) { listeners[type] = fn; } },
    setInterval(fn) { listeners.interval = fn; },
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
      observe(target, options) { this.targets.push({ target, options }); }
      disconnect() { this.targets = []; }
      emit(records) { if (this.targets.length) this.callback(records); }
    },
  });
  vm.runInContext(source('settings.js'), context);
  vm.runInContext(source('youtube-layout.js'), context);
  const run = (code) => vm.runInContext(code, context);
  function flushFrame() {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback();
  }
  return { saved, active, redirects, listeners, elements, list, context, run, observers, frames, flushFrame };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('new defaults fill missing settings and preserve saved preferences', async () => {
  const h = harness({ youtubeSuggestions: false });
  h.run(source('content.js'));
  await settle();
  assert.equal(h.run('PF_DEFAULTS.youtube'), false);
  for (const key of keys) assert.equal(h.run(`PF_DEFAULTS.${key}`), true);
  assert.ok(h.active.has(classes[0]));
  assert.ok(!h.active.has(classes[1]));
  assert.ok(h.active.has(classes[2]));
  assert.deepEqual(h.saved, { youtubeSuggestions: false });
  assert.deepEqual(h.redirects, []);
});

test('each CSS-only option updates independently without redirecting', async () => {
  const h = harness();
  h.run(source('content.js'));
  await settle();
  for (const [index, key] of keys.entries()) {
    h.saved[key] = false;
    await h.listeners.storage();
    assert.ok(!h.active.has(classes[index]));
    h.saved[key] = true;
    await h.listeners.storage();
    assert.ok(h.active.has(classes[index]));
  }
  for (const path of ['/', '/watch', '/results', '/feed/subscriptions', '/@channel']) {
    h.context.location.pathname = path;
    h.listeners.interval();
    h.listeners.pageshow();
  }
  assert.deepEqual(h.redirects, []);
});

test('existing Shorts and whole-site redirects still work', async () => {
  const h = harness();
  h.context.location.pathname = '/shorts/example';
  h.run(source('content.js'));
  await settle();
  assert.equal(h.redirects.at(-1), 'https://www.youtube.com/');
  h.saved.youtube = true;
  await h.listeners.storage();
  assert.equal(h.redirects.at(-1), 'extension://blocked.html');
});

test('YouTube presentation options do not affect Instagram', async () => {
  const h = harness({ instagram: false }, 'www.instagram.com');
  h.run(source('content.js'));
  await settle();
  assert.ok(classes.every((name) => !h.active.has(name)));
  assert.deepEqual(h.redirects, []);
});

test('popup persists choices and parent block preserves child preferences', async () => {
  const h = harness(Object.fromEntries(keys.map((key) => [key, false])));
  h.run(source('popup.js'));
  await settle();
  const youtubeOptions = h.run('PF_OPTIONS[0].children');
  function switches() {
    return h.list.children.slice(1, 1 + youtubeOptions.length).map((row) => row.children[0].children[1]);
  }
  const newSwitches = () => switches().slice(-3);
  assert.ok(newSwitches().every((toggle) => !toggle.checked && !toggle.disabled));
  newSwitches()[0].checked = true;
  newSwitches()[0].change();
  assert.equal(h.saved.youtubeHomeFeed, true);
  h.saved.youtube = true;
  await h.listeners.storage();
  assert.ok(newSwitches().every((toggle) => toggle.checked && toggle.disabled));
  h.saved.youtube = false;
  await h.listeners.storage();
  assert.deepEqual(newSwitches().map((toggle) => toggle.checked), [true, false, false]);
});

test('presentation toggles leave network rules unchanged', () => {
  const h = harness();
  h.run(source('background.js'));
  for (const youtube of [false, true]) {
    const rules = (enabled) => h.run(`JSON.stringify(buildRules({ ...PF_DEFAULTS, youtube: ${youtube}, ${keys.map((key) => `${key}: ${enabled}`).join(', ')} }))`);
    assert.equal(rules(true), rules(false));
  }
});


test('idle URL checks do no sidebar measurement; events coalesce into one frame', async () => {
  const h = harness();
  let measurements = 0;
  h.context.pfUpdateYoutubeSecondary = () => { measurements++; };
  h.run(source('content.js'));
  await settle();
  h.flushFrame();
  assert.equal(measurements, 1);
  for (let index = 0; index < 1000; index++) h.listeners.interval();
  h.flushFrame();
  assert.equal(measurements, 1, 'an unchanged page must stay idle');
  h.listeners['yt-navigate-finish']();
  h.listeners.pageshow();
  h.listeners.resize();
  h.flushFrame();
  assert.equal(measurements, 2, 'events in one frame should coalesce');
  h.context.location.search = '?v=another-video';
  h.listeners.interval();
  h.flushFrame();
  assert.equal(measurements, 3, 'fallback detects a new video even at the same path');
  h.saved.youtubeSuggestions = false;
  await h.listeners.storage();
  h.flushFrame();
  assert.equal(measurements, 4);
  assert.ok(h.observers.every((observer) => observer.targets.length === 0));
});

test('sidebar watcher ignores recommendations, handles panels and replacements, and stops cleanly', () => {
  const h = harness();
  const page = {};
  const column = { classList: { remove() {} } };
  h.context.document.querySelectorAll = (selector) => selector.includes('#secondary') ? [column] : [page];
  let measurements = 0;
  h.context.pfUpdateYoutubeSecondary = () => { measurements++; };
  const watcher = h.run('pfCreateYoutubeLayoutWatcher(() => true)');
  watcher.refresh();
  h.flushFrame();
  const structure = h.observers[0];
  const panels = h.observers[1];
  assert.equal(panels.targets[0].target, column);
  assert.equal(structure.targets[0].target, page);
  const target = (recommendations, useful) => ({
    nodeType: 1,
    closest: () => recommendations ? {} : null,
    matches: () => useful,
    querySelector: () => null,
  });
  panels.emit([{ type: 'attributes', target: target(true, false) }]);
  panels.emit([{ type: 'attributes', target: target(false, false) }]);
  h.flushFrame();
  assert.equal(measurements, 1, 'recommendations and decorative changes must not measure');
  panels.emit([{ type: 'attributes', target: target(false, true) }]);
  panels.emit([{ type: 'attributes', target: target(false, true) }]);
  assert.equal(h.frames.size, 1);
  h.flushFrame();
  assert.equal(measurements, 2);
  structure.emit([{ target: target(false, false), addedNodes: [target(false, true)], removedNodes: [] }]);
  h.flushFrame();
  assert.equal(measurements, 3, 'replacement columns trigger rebinding');
  watcher.refresh();
  watcher.stop();
  h.flushFrame();
  assert.equal(measurements, 3, 'stop cancels pending work');
  assert.ok(h.observers.every((observer) => observer.targets.length === 0));
});


test('watcher discovers a late watch-page shell, then narrows observation to that page', () => {
  const h = harness();
  let ready = false;
  const page = {};
  const column = { classList: { remove() {} } };
  h.context.document.querySelectorAll = (selector) => ready ? (selector.includes('#secondary') ? [column] : [page]) : [];
  h.context.pfUpdateYoutubeSecondary = () => {};
  const watcher = h.run('pfCreateYoutubeLayoutWatcher(() => true)');
  watcher.refresh();
  h.flushFrame();
  const structure = h.observers[0];
  assert.equal(structure.targets[0].target, h.context.document.documentElement);
  ready = true;
  structure.emit([{
    target: { nodeType: 1, closest: () => null },
    addedNodes: [{ nodeType: 1, matches: () => true }], removedNodes: [],
  }]);
  h.flushFrame();
  assert.equal(structure.targets.length, 1);
  assert.equal(structure.targets[0].target, page);
  assert.equal(h.observers[1].targets[0].target, column);
  watcher.stop();
});
