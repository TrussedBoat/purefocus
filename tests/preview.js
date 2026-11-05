/* Browser-only fixture tests. No libraries or extension installation needed. */
const groups = [
  { key: 'youtubeHomeFeed', group: 'home', css: 'pf-hide-home-feed' },
  { key: 'youtubeSuggestions', group: 'suggestions', css: 'pf-hide-suggestions' },
  { key: 'youtubeEndScreen', group: 'end', css: 'pf-hide-end-screen' },
];
const controls = document.getElementById('controls');
const options = PF_OPTIONS.find((option) => option.key === 'youtube').children;
for (const group of groups) {
  const label = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = PF_DEFAULTS[group.key];
  toggle.addEventListener('change', () => applyControls());
  label.append(toggle, ` ${options.find((option) => option.key === group.key).label}`);
  controls.append(label);
  group.toggle = toggle;
}
function applyControls() {
  for (const group of groups) document.documentElement.classList.toggle(group.css, group.toggle.checked);
  const fixture = document.getElementById('layout-fixture');
  fixture.querySelector('ytd-playlist-panel-renderer').hidden = !document.getElementById('preview-playlist').checked;
  fixture.querySelector('#chat-container').hidden = !document.getElementById('preview-chat').checked;
  pfUpdateYoutubeSecondary(groups[1].toggle.checked);
}
function visible(node) {
  for (let element = node; element; element = element.parentElement) {
    if (getComputedStyle(element).display === 'none') return false;
  }
  return true;
}
let runningTests = false;
async function runTests() {
  if (runningTests) return;
  runningTests = true;
  document.getElementById('run').disabled = true;
  let count = 0;
  const failures = [];
  const assert = (condition, description) => { count++; if (!condition) failures.push(description); };
  // Insert a sample after startup to verify CSS also catches late-rendered UI.
  const dynamic = document.createElement('div');
  dynamic.className = 'ytp-ce-video';
  dynamic.dataset.group = 'end';
  dynamic.textContent = 'Dynamically inserted end card';
  document.querySelector('.html5-video-player').append(dynamic);
  try {
    // Exercise all eight combinations, checking independence and restoration.
    for (let mask = 0; mask < 8; mask++) {
      groups.forEach((group, index) => document.documentElement.classList.toggle(group.css, Boolean(mask & (1 << index))));
      pfUpdateYoutubeSecondary(Boolean(mask & 2));
      groups.forEach((group, index) => {
        for (const node of document.querySelectorAll(`[data-group="${group.group}"]`)) {
          assert(visible(node) === !(mask & (1 << index)), `Combination ${mask}: ${node.textContent}`);
        }
      });
      for (const node of document.querySelectorAll('[data-keep]')) {
        assert(visible(node), `Combination ${mask} unexpectedly hid: ${node.textContent}`);
      }
    }
    document.documentElement.classList.add('pf-hide-suggestions');
    const column = document.querySelector('[data-layout-column]');
    const playlist = column.querySelector('ytd-playlist-panel-renderer');
    const chatContainer = column.querySelector('#chat-container');
    const chat = column.querySelector('ytd-live-chat-frame');
    const engagement = column.querySelector('ytd-engagement-panel-section-list-renderer');
    playlist.hidden = true;
    chatContainer.hidden = true;
    const checkColumn = (expected, description) => {
      pfUpdateYoutubeSecondary(true);
      assert(visible(column) === expected, description);
    };
    checkColumn(false, 'Inactive panels must not preserve the column');
    playlist.hidden = false;
    checkColumn(true, 'Visible playlist preserves column');
    playlist.hidden = true;
    checkColumn(false, 'Hiding playlist collapses column again');
    chatContainer.hidden = false;
    checkColumn(true, 'Visible chat restores column');
    chatContainer.setAttribute('aria-hidden', 'true');
    checkColumn(false, 'Aria-hidden chat does not preserve column');
    chatContainer.removeAttribute('aria-hidden');
    checkColumn(true, 'Restoring chat accessibility restores column');
    chatContainer.style.display = 'none';
    checkColumn(false, 'CSS-hidden chat wrapper does not preserve column');
    chatContainer.style.display = '';
    chat.style.visibility = 'hidden';
    checkColumn(false, 'Invisible chat does not preserve column');
    chat.style.visibility = '';
    chatContainer.hidden = true;
    engagement.hidden = false;
    engagement.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
    checkColumn(true, 'Expanded engagement panel preserves column');
    engagement.hidden = true;
    engagement.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
    const dynamicPanel = document.createElement('div');
    dynamicPanel.textContent = 'New useful panel';
    column.querySelector('#panels').append(dynamicPanel);
    checkColumn(true, 'Dynamically inserted useful panel restores column');
    dynamicPanel.remove();
    checkColumn(false, 'Removing useful panel collapses column');
    document.documentElement.classList.remove('pf-hide-suggestions');
    pfUpdateYoutubeSecondary(false);
    assert(visible(column), 'Disabling suggestions blocking restores column');
    await runWatcherAssertions(assert);
  } catch (error) {
    assert(false, `Browser test error: ${error.message}`);
  } finally {
    runningTests = false;
    document.getElementById('run').disabled = false;
    dynamic.remove();
    applyControls();
  }
  const results = document.getElementById('results');
  results.classList.toggle('failure', failures.length > 0);
  results.textContent = failures.length ? `${failures.length} of ${count} assertions failed:\n${failures.join('\n')}` : `PASS — ${count} browser assertions across all eight switch combinations.`;
  document.documentElement.dataset.testResult = failures.length ? 'fail' : 'pass';
}
// Exercise real MutationObservers and rendering frames, rather than manually
// calling the layout helper after changing the fixture.
async function runWatcherAssertions(assert) {
  const column = document.querySelector('[data-layout-column]');
  const playlist = column.querySelector('ytd-playlist-panel-renderer');
  const chatContainer = column.querySelector('#chat-container');
  const originalUpdate = pfUpdateYoutubeSecondary;
  let measurements = 0;
  let blocked = true;
  let replacement = null;
  let extra = null;
  pfUpdateYoutubeSecondary = (...args) => { measurements++; originalUpdate(...args); };
  const watcher = pfCreateYoutubeLayoutWatcher(() => blocked);
  const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    document.documentElement.classList.add('pf-hide-suggestions');
    playlist.hidden = true;
    chatContainer.hidden = true;
    watcher.refresh();
    watcher.refresh();
    await frames();
    assert(!visible(column), 'Observer startup collapses empty column');
    assert(measurements === 1, 'Startup requests coalesce into one measurement');
    await frames();
    assert(measurements === 1, 'Our layout changes must not cause observer feedback');
    const recommendation = column.querySelector('ytd-watch-next-secondary-results-renderer');
    recommendation.append(document.createElement('span'));
    recommendation.lastElementChild.remove();
    await frames();
    assert(measurements === 1, 'Recommendation changes do not trigger measurements');
    playlist.hidden = false;
    await frames();
    assert(visible(column), 'Observer restores newly visible playlist');
    playlist.hidden = true;
    await frames();
    assert(!visible(column), 'Observer collapses hidden playlist');
    chatContainer.hidden = false;
    await frames();
    assert(visible(column), 'Observer restores newly visible chat');
    chatContainer.style.display = 'none';
    await frames();
    assert(!visible(column), 'Observer detects CSS-hidden chat wrapper');
    chatContainer.style.display = '';
    chatContainer.hidden = true;
    extra = document.createElement('div');
    extra.textContent = 'Useful panel added after load';
    column.querySelector('#panels').append(extra);
    await frames();
    assert(visible(column), 'Observer detects late useful panel insertion');
    extra.remove();
    await frames();
    assert(!visible(column), 'Observer detects useful panel removal');
    replacement = column.cloneNode(true);
    column.replaceWith(replacement);
    await frames();
    replacement.querySelector('ytd-playlist-panel-renderer').hidden = false;
    await frames();
    assert(visible(replacement), 'Observer rebinds to replacement secondary column');
    blocked = false;
    watcher.refresh();
    await frames();
    const previousMeasurements = measurements;
    replacement.querySelector('ytd-playlist-panel-renderer').hidden = true;
    await frames();
    assert(visible(replacement), 'Disabling blocking restores column');
    assert(measurements === previousMeasurements, 'Disabling blocking disconnects observers');
  } finally {
    watcher.stop();
    pfUpdateYoutubeSecondary = originalUpdate;
    extra?.remove();
    if (replacement?.isConnected) replacement.replaceWith(column);
    playlist.hidden = true;
    chatContainer.hidden = true;
    chatContainer.style.display = '';
  }
}
document.getElementById('run').addEventListener('click', runTests);
for (const id of ['preview-playlist', 'preview-chat']) {
  document.getElementById(id).addEventListener('change', applyControls);
}
applyControls();
runTests();
