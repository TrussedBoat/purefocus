// Keep useful watch-page panels, but reclaim the column when only hidden
// recommendations remain. Called by the existing content-script checks.
function pfUpdateYoutubeSecondary(blockSuggestions, root = document) {
  for (const column of root.querySelectorAll('ytd-watch-flexy #secondary, ytd-watch-grid #secondary')) {
    // Restore before measuring: our own display:none must not make real
    // panels look hidden. This synchronous check finishes before painting.
    column.classList.remove('pf-collapse-secondary');
    if (!blockSuggestions) continue;

    const panels = column.querySelectorAll([
      'ytd-playlist-panel-renderer',
      'ytd-live-chat-frame',
      'ytd-engagement-panel-section-list-renderer',
      '#panels > *',
      '#inline-panels > *',
      '#persistent-panel-container > *',
      '#donation-shelf > *',
      '#chat-container > *',
    ].join(', '));
    const hasUsefulPanel = Array.from(panels).some((panel) => {
      if (panel.closest('[hidden], [aria-hidden="true"], [visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"]')) return false;
      const style = getComputedStyle(panel);
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      return Array.from(panel.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0);
    });
    column.classList.toggle('pf-collapse-secondary', !hasUsefulPanel);
  }
}
