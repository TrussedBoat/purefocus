// Shared by background.js, content.js and popup.js.

// The options shown in the popup. A child is one part of its parent site,
// so blocking the parent always blocks the child too.
const PF_OPTIONS = [
  {
    key: "youtube",
    label: "YouTube",
    children: [
      { key: "youtubeShorts", label: "Shorts" },
      { key: "youtubePlayables", label: "Playables" },
    ],
  },
  { key: "instagram", label: "Instagram", children: [{ key: "instagramReels", label: "Reels" }] },
  { key: "x", label: "X (Twitter)", children: [] },
];

// Used until the user changes something. true = blocked.
const PF_DEFAULTS = {
  youtube: false,
  youtubeShorts: true,
  youtubePlayables: true,
  instagram: true,
  instagramReels: true,
  x: true,
};
