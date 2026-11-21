"use strict";

const profileIconPaths = {
  paw: ['M12 13c-3 0-6 3-6 5 0 2 2 3 4 2a5 5 0 0 1 4 0c2 1 4 0 4-2 0-2-3-5-6-5Z', 'M8 8c0 1.7-.9 3-2 3S4 9.7 4 8s.9-3 2-3 2 1.3 2 3Z', 'M13 5c0 1.7-.9 3-2 3S9 6.7 9 5s.9-3 2-3 2 1.3 2 3Z', 'M18 6c0 1.7-.9 3-2 3s-2-1.3-2-3 .9-3 2-3 2 1.3 2 3Z', 'M22 10c0 1.7-.9 3-2 3s-2-1.3-2-3 .9-3 2-3 2 1.3 2 3Z'],
  information: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M7 8h4M7 12h10M7 16h7'],
  award: ['M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', 'm9 12-2 9 5-3 5 3-2-9'],
  pedigree: ['M12 4v5M5 14v-4h14v4M3 14h4v5H3zM17 14h4v5h-4zM10 2h4v4h-4z'],
  trophy: ['M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6v3H9'],
  activity: ['M3 12h4l3-8 4 16 3-8h4'],
  document: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 13h8M8 17h5'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 11h18M7 15h2M13 15h2'],
  pin: ['M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z', 'M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
  pencil: ['m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7 6-2'],
  trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],
  list: ['M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1']
};

function profileIcon(name, css = "profile-icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: css })) svg.setAttribute(key, value);
  for (const shape of profileIconPaths[name] || profileIconPaths.information) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", shape); svg.append(path);
  }
  return svg;
}

function decorateProfileHeading(heading, icon, count) {
  if (!heading.querySelector(".profile-section-icon")) {
    const badge = node("span", undefined, "profile-section-icon");
    badge.append(profileIcon(icon)); heading.prepend(badge);
  }
  if (count !== undefined) {
    let badge = heading.querySelector(".profile-section-count");
    if (!badge) { badge = node("span", undefined, "profile-section-count"); heading.append(badge); }
    badge.textContent = String(count); badge.hidden = count === 0;
  }
}

let profileDesignMounted = false;
function mountProfileDesign() {
  if (profileDesignMounted) return;
  profileDesignMounted = true;
  for (const [id, icon] of [["bon-title", "award"], ["basic-title", "information"], ["pedigree-title", "pedigree"], ["exhibitions-title", "trophy"], ["trials-title", "activity"]]) decorateProfileHeading(byId(id), icon);
  for (const [id, icon] of [["edit", "pencil"], ["remove", "trash"]]) byId(id).prepend(profileIcon(icon));
  document.querySelector("#profile > .profile-back").prepend(profileIcon("list"));
  for (const button of document.querySelectorAll(".profile-jump-nav button")) {
    button.prepend(profileIcon(button.dataset.icon));
    button.onclick = () => {
      const target = byId(button.dataset.target);
      target.scrollIntoView({ block: "start", behavior: "auto" });
      const title = target.querySelector("h2");
      title.tabIndex = -1; title.focus({ preventScroll: true });
    };
  }
}

function renderProfileIdentity(dog) {
  mountProfileDesign();
  const meta = byId("profile-meta");
  const entries = [["paw", dog.breed], [null, labels[dog.sex]], ["document", dog.regNumber && "ВПКОС " + dog.regNumber]];
  meta.replaceChildren(...entries.filter(([, value]) => value).map(([icon, value]) => {
    const item = node("span", undefined, "profile-meta-item");
    if (icon) item.append(profileIcon(icon)); item.append(document.createTextNode(value)); return item;
  }));
}

function profileInfoGrid(rows) {
  const grid = node("dl", undefined, "profile-info-grid");
  for (const [label, value] of rows) {
    const item = node("div", undefined, value ? "" : "profile-info-missing");
    if (label === "Заметки" || label === "Титулы") item.classList.add("profile-info-wide");
    item.append(node("dt", label), node("dd", value || "Не указано"));
    grid.append(item);
  }
  return grid;
}

function profileInfoDisclosure(id, title, rows, open) {
  const details = node("details", undefined, "profile-info-disclosure");
  details.dataset.group = id; details.open = open;
  const summary = node("summary");
  summary.append(profileIcon(id === "documents" ? "document" : "calendar"), node("span", title));
  details.append(summary, profileInfoGrid(rows)); return details;
}
