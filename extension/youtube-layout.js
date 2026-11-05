// Keep useful watch-page panels, but reclaim the column when only hidden
// recommendations remain. Only measured after relevant events.
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

// Coalesce changes into one frame. Observe panel visibility/content, not the
// recommendation feed, and disconnect while applying our own layout classes.
function pfCreateYoutubeLayoutWatcher(isBlocked, root = document) {
  const columnsSelector = 'ytd-watch-flexy #secondary, ytd-watch-grid #secondary';
  const structureSelector = 'ytd-watch-flexy, ytd-watch-grid, #secondary';
  const panelsSelector = 'ytd-playlist-panel-renderer, ytd-live-chat-frame, ytd-engagement-panel-section-list-renderer, #panels, #inline-panels, #persistent-panel-container, #donation-shelf, #chat-container';
  const attributes = ['hidden', 'aria-hidden', 'visibility', 'style', 'class', 'collapsed'];
  let frame = null;
  let stopped = false;
  let columns = [];

  const contains = (node, selector) => node.nodeType === 1 &&
    (node.matches(selector) || Boolean(node.querySelector(selector)));
  const structureObserver = new MutationObserver((records) => {
    if (records.some((record) => {
      if (record.target.nodeType === 1 && record.target.closest('ytd-watch-next-secondary-results-renderer, #related')) return false;
      return [...record.addedNodes, ...record.removedNodes]
        .some((node) => contains(node, structureSelector));
    })) schedule();
  });
  const panelObserver = new MutationObserver((records) => {
    if (records.some((record) => {
      const target = record.target;
      if (target.closest('ytd-watch-next-secondary-results-renderer, #related')) return false;
      // Descendant decoration/animation classes do not affect panel visibility.
      if (record.type === 'attributes') return contains(target, panelsSelector);
      return Boolean(target.closest(panelsSelector)) ||
        [...record.addedNodes, ...record.removedNodes].some((node) => contains(node, panelsSelector));
    })) schedule();
  });

  function flush() {
    frame = null;
    structureObserver.disconnect();
    panelObserver.disconnect();
    pfUpdateYoutubeSecondary(isBlocked(), root);
    if (!isBlocked() || stopped) return;

    columns = Array.from(root.querySelectorAll(columnsSelector));
    for (const column of columns) {
      panelObserver.observe(column, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
    }
    const watchPages = Array.from(root.querySelectorAll('ytd-watch-flexy, ytd-watch-grid'));
    if (watchPages.length) {
      // Catch late/replaced columns without rescanning on unrelated mutations.
      for (const page of watchPages) structureObserver.observe(page, { childList: true, subtree: true });
    } else if (root.documentElement) {
      // Only needed while the initial watch-page shell is still loading.
      structureObserver.observe(root.documentElement, { childList: true, subtree: true });
    }
  }

  function schedule() {
    if (!stopped && frame === null) frame = requestAnimationFrame(flush);
  }

  return {
    refresh: schedule,
    stop() {
      stopped = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      structureObserver.disconnect();
      panelObserver.disconnect();
      for (const column of columns) column.classList.remove('pf-collapse-secondary');
    },
  };
}
