"use strict";

const Pedigree = (() => {
  const maxDepth = 12;
  const hasParents = (branch) => Boolean(branch?.father || branch?.mother);

  function fromGraph(dog, findDog) {
    function visit(current, path, depth) {
      if (!current) return null;
      const branch = { dog: current, father: null, mother: null };
      const id = String(current.id);
      if (depth >= maxDepth || path.has(id)) return branch;
      const next = new Set(path).add(id);
      branch.father = visit(current.fatherId ? findDog(current.fatherId) : null, next, depth + 1);
      branch.mother = visit(current.motherId ? findDog(current.motherId) : null, next, depth + 1);
      return branch;
    }
    return visit(dog, new Set(), 0);
  }

  function fromApi(root, toDog) {
    function visit(current, path, depth) {
      if (!current?.known || !/^\d+$/.test(String(current.entity?.id ?? ""))) return null;
      const dog = toDog(current.entity);
      const branch = { dog, father: null, mother: null };
      const id = String(dog.id);
      if (depth >= maxDepth || path.has(id)) return branch;
      const next = new Set(path).add(id);
      branch.father = visit(current.father, next, depth + 1);
      branch.mother = visit(current.mother, next, depth + 1);
      return branch;
    }
    return visit(root, new Set(), 0);
  }

  function toMap(root, depthLimit = maxDepth) {
    const found = new Map();
    function visit(branch, depth) {
      if (!branch || depth > depthLimit) return;
      const dog = branch.dog;
      const id = String(dog.id);
      const previous = found.get(id);
      found.set(id, { ...previous, ...dog,
        fatherId: branch.father ? String(branch.father.dog.id) : dog.fatherId || previous?.fatherId || null,
        motherId: branch.mother ? String(branch.mother.dog.id) : dog.motherId || previous?.motherId || null
      });
      visit(branch.father, depth + 1);
      visit(branch.mother, depth + 1);
    }
    visit(root, 0);
    return found;
  }

  function readSnapshot(value) {
    if (!value || !/^\d+$/.test(value.rootId || "") || !Array.isArray(value.dogs)
      || value.dogs.length > 127) return null;
    const dogs = [];
    const ids = new Set();
    for (const entry of value.dogs) {
      if (!entry || !/^\d+$/.test(entry.id || "") || typeof entry.name !== "string" || !entry.name.trim()) continue;
      const id = String(entry.id);
      if (ids.has(id)) continue;
      ids.add(id);
      const dog = { id };
      for (const field of ["name", "breed", "sex", "birth", "regNumber"]) {
        dog[field] = typeof entry[field] === "string" ? entry[field].slice(0, 500) : "";
      }
      for (const field of ["fatherId", "motherId"]) {
        dog[field] = /^\d+$/.test(entry[field] || "") ? String(entry[field]) : null;
      }
      dogs.push(dog);
    }
    return ids.has(String(value.rootId)) ? { rootId: String(value.rootId), dogs, complete: value.complete === true } : null;
  }

  function snapshot(root, complete = true) {
    if (!root) return null;
    return readSnapshot({ rootId: String(root.dog.id), dogs: [...toMap(root, 6).values()], complete });
  }

  function fromSnapshot(value) {
    const saved = readSnapshot(value);
    if (!saved) return null;
    const dogs = new Map(saved.dogs.map((dog) => [dog.id, { ...dog, rors: true, live: true }]));
    return fromGraph(dogs.get(saved.rootId), (id) => dogs.get(id));
  }

  function element(tag, text, className) {
    const result = document.createElement(tag);
    if (text != null) result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function button(text, action, className = "") {
    const result = element("button", text, "button " + className);
    result.type = "button";
    result.addEventListener("click", action);
    return result;
  }

  function render(root, makeLink) {
    if (!hasParents(root)) return null;
    const section = element("section", null, "pedigree-panel");
    section.setAttribute("aria-label", "Предки собаки «" + root.dog.name + "»");
    const header = element("div", null, "pedigree-header");
    const navigation = element("div", null, "pedigree-navigation");
    const history = [];
    let focused = root;
    let side = root.father ? "father" : "mother";
    const tree = element("div", null, "pedigree-tree");
    const back = button("Назад", () => {
      focused = history.pop();
      show(true);
    });
    const reset = button("К началу", () => {
      history.length = 0;
      focused = root;
      show(true);
    });
    navigation.append(back, reset);
    header.append(element("h3", "Предки"), navigation);
    const help = element("p", "Выберите «Предки» на карточке, чтобы раскрыть ветвь дальше.", "pedigree-help");
    const switcher = element("div", null, "pedigree-switch");
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Ветвь родословной");
    const sideButtons = new Map();
    for (const [key, label] of [["father", "По отцу"], ["mother", "По матери"]]) {
      const control = button(label, () => {
        side = key;
        updateSide();
      });
      sideButtons.set(key, control);
      switcher.append(control);
    }

    function updateSide() {
      tree.dataset.side = side;
      for (const [key, control] of sideButtons) control.setAttribute("aria-pressed", String(key === side));
    }

    function card(branch, label, extraClass = "") {
      const card = element("div", null, "pedigree-card " + extraClass);
      card.append(element("span", label, "pedigree-role"));
      if (!branch) {
        card.classList.add("pedigree-unknown");
        card.append(element("span", "Нет данных", "pedigree-missing"));
        return card;
      }
      const name = makeLink(branch.dog);
      name.classList.add("pedigree-name");
      card.append(name);
      const details = [];
      if (branch.dog.regNumber) details.push("ВПКОС " + branch.dog.regNumber);
      if (/^\d{4}-\d{2}-\d{2}$/.test(branch.dog.birth || "")) {
        details.push(branch.dog.birth.split("-").reverse().join("."));
      }
      if (details.length) card.append(element("span", details.join(" · "), "pedigree-meta"));
      if (branch !== focused && hasParents(branch)) {
        const expand = button("Предки", () => {
          history.push(focused);
          focused = branch;
          show(true);
        }, "pedigree-expand");
        expand.setAttribute("aria-label", "Показать предков собаки «" + branch.dog.name + "»");
        card.append(expand);
      }
      return card;
    }

    function show(moveFocus = false) {
      if (!focused[side] && focused[side === "father" ? "mother" : "father"]) {
        side = side === "father" ? "mother" : "father";
      }
      back.hidden = reset.hidden = history.length === 0;
      const rootCard = card(focused, history.length ? "Выбранная ветвь" : "Собака", "pedigree-root");
      const branches = element("ul", null, "pedigree-branches");
      for (const [key, label, grandparents] of [
        ["father", "Отец", ["Отец отца", "Мать отца"]],
        ["mother", "Мать", ["Отец матери", "Мать матери"]]
      ]) {
        const branch = focused[key];
        const item = element("li", null, "pedigree-branch");
        item.dataset.side = key;
        item.append(card(branch, label, "pedigree-parent"));
        if (branch) {
          const list = element("ul", null, "pedigree-grandparents");
          for (const [index, parent] of [branch.father, branch.mother].entries()) {
            const ancestor = element("li", null, "pedigree-grandparent");
            ancestor.append(card(parent, grandparents[index]));
            list.append(ancestor);
          }
          item.append(list);
        }
        branches.append(item);
      }
      tree.replaceChildren(rootCard, branches);
      updateSide();
      if (moveFocus) {
        rootCard.querySelector("a").focus({ preventScroll: true });
        rootCard.scrollIntoView({ block: "nearest" });
      }
    }

    section.append(header, help, switcher, tree);
    show();
    return section;
  }

  return { fromGraph, fromApi, toMap, snapshot, readSnapshot, fromSnapshot, render };
})();
