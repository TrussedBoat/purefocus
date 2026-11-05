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
    location: { hostname, pathname: '/watch', replace: (url) => redirects.push(url) },
    document: {
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
  });
  vm.runInContext(source('settings.js'), context);
  const run = (code) => vm.runInContext(code, context);
  return { saved, active, redirects, listeners, elements, list, context, run };
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
