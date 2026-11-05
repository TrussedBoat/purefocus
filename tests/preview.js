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
}
function visible(node) {
  for (let element = node; element; element = element.parentElement) {
    if (getComputedStyle(element).display === 'none') return false;
  }
  return true;
}
function runTests() {
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
      groups.forEach((group, index) => {
        for (const node of document.querySelectorAll(`[data-group="${group.group}"]`)) {
          assert(visible(node) === !(mask & (1 << index)), `Combination ${mask}: ${node.textContent}`);
        }
      });
      for (const node of document.querySelectorAll('[data-keep]')) {
        assert(visible(node), `Combination ${mask} unexpectedly hid: ${node.textContent}`);
      }
    }
  } finally {
    dynamic.remove();
    applyControls();
  }
  const results = document.getElementById('results');
  results.classList.toggle('failure', failures.length > 0);
  results.textContent = failures.length ? `${failures.length} of ${count} assertions failed:\n${failures.join('\n')}` : `PASS — ${count} browser assertions across all eight switch combinations.`;
  document.documentElement.dataset.testResult = failures.length ? 'fail' : 'pass';
}
document.getElementById('run').addEventListener('click', runTests);
applyControls();
runTests();
