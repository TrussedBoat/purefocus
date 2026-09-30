// Draws one switch per option from PF_OPTIONS and saves changes to storage.
// background.js and content.js watch storage and apply the change.

const list = document.getElementById("options");

function renderRow(option, settings, parent) {
  // While the parent site is blocked, the child is blocked too: show it on
  // and locked. Its own saved value is kept for when the parent is turned off.
  const covered = parent !== undefined && settings[parent.key];

  const row = document.createElement("li");
  row.className = "row";
  if (parent) row.classList.add("child");
  if (covered) row.classList.add("covered");

  const label = document.createElement("label");

  const text = document.createElement("span");
  text.className = "text";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = option.label;
  text.append(name);
  if (covered) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = `Blocked with ${parent.label}`;
    text.append(hint);
  }

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "switch";
  toggle.checked = covered || settings[option.key];
  toggle.disabled = covered;
  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ [option.key]: toggle.checked });
  });

  label.append(text, toggle);
  row.append(label);
  return row;
}

async function render() {
  const settings = await chrome.storage.local.get(PF_DEFAULTS);
  list.replaceChildren();
  for (const option of PF_OPTIONS) {
    list.append(renderRow(option, settings));
    for (const child of option.children) {
      list.append(renderRow(child, settings, option));
    }
  }
}

render();
chrome.storage.onChanged.addListener(render);
