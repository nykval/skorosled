"use strict";

const profileSourceCache = new Map();
const profileChildrenCache = new Map();
let profileRenderToken = 0;
let descendantsResizeObserver = null;

function profileSourceId(dog) {
  return dog.rors ? String(dog.id) : dog.archiveSourceId || "";
}

function profileEvents(dog) {
  if (dog.live && liveDetail?.dog?.id === dog.id) return liveDetail.events || {};
  const source = profileSourceCache.get((dog.live ? "live:" : "") + profileSourceId(dog));
  if (source) return source.events;
  if (dog.sourceEvents) return dog.sourceEvents;
  const entries = dog.bonitations || [];
  return { exhibition_evals: entries.map((entry) => ({ common_exhibition_name: entry.show,
    common_exhibition_start_date: entry.date, exterior_type: Bonitation.grades[entry.grade] || "" })) };
}

function profileDog(dog) {
  const source = profileSourceCache.get((dog.live ? "live:" : "") + profileSourceId(dog))?.dog;
  const merged = { ...source, ...dog };
  if (source && !dog.rors) for (const [field, value] of Object.entries(source)) {
    if (typeof value === "string" && !merged[field]) merged[field] = value;
  }
  return merged;
}

function profileChildren(dog) {
  const id = profileSourceId(dog);
  const local = records.filter((entry) => entry.fatherId === dog.id || entry.motherId === dog.id);
  const original = id && archive?.byId.get(id);
  const fromArchive = original && !dog.live ? archive.children.get(id) || [] : [];
  const online = id && liveDetail?.id === id ? liveDetail.children || [] : profileChildrenCache.get(id) || [];
  const result = new Map();
  for (const child of [...(dog.sourceChildren || []), ...fromArchive, ...online, ...local]) result.set(child.archiveSourceId || String(child.id), child);
  return [...result.values()];
}

async function loadProfileChildren(dog) {
  const children = profileChildren(dog);
  const id = profileSourceId(dog);
  if (children.length || !id || !dog.live && archive?.byId.has(id) || profileChildrenCache.has(id)) return children;
  const data = await rorsGet("/api/dog_children/" + id);
  const rows = Array.isArray(data.children) ? data.children : [];
  const loaded = rows.map((entry) => entry?.entity ?? entry?.dog ?? entry)
    .filter((entry) => entry && /^\d+$/.test(String(entry.id))).map(rorsDog);
  profileChildrenCache.set(id, loaded);
  return loaded;
}

async function readProfileSource(dog) {
  const id = profileSourceId(dog);
  if (!id) return { dog, events: profileEvents(dog) };
  if (dog.live && liveDetail?.dog?.id === id) return { dog, events: liveDetail.events || {} };
  const cacheKey = (dog.live ? "live:" : "") + id;
  if (profileSourceCache.has(cacheKey)) return profileSourceCache.get(cacheKey);
  if (dog.live) {
    const results = await Promise.allSettled([
      rorsEvaluations("/api/exhevals", "exhibition_evals", id),
      rorsEvaluations("/api/compevals", "competition_evals", id)
    ]);
    const result = { dog, events: { exhibition_evals: results[0].value, competition_evals: results[1].value },
      partial: results.some((entry) => entry.status === "rejected") };
    profileSourceCache.set(cacheKey, result);
    return result;
  }
  const archived = archive?.byId.get(id);
  if (archived) {
    const row = await readArchiveRecord(archive.file, archived);
    const result = { dog: archived, events: ProfileData.cleanEvents(row) || {} };
    profileSourceCache.set(id, result);
    return result;
  }
  return { dog, events: profileEvents(dog) };
}

function renderBasicInformation(dog) {
  dog = profileDog(dog);
  renderProfileIdentity(dog);
  const panel = byId("details");
  const sameDog = panel.dataset.dogId === String(dog.id);
  const openGroups = new Set([...panel.querySelectorAll("details[open]")].map((entry) => entry.dataset.group));
  const events = profileEvents(dog);
  const classes = (events.exhibition_evals || []).map((entry) => ProfileData.classLabel(entry.tclass)).filter(Boolean);
  const recordedClass = dog.className || Bonitation.classNames.find((name) => classes.includes(name));
  const exterior = ProfileData.bestGrade(dog, events);
  const main = [
    ["Порода", dog.breed], ["Пол", labels[dog.sex]], ["Дата рождения", dog.birth && formatDate(dog.birth)],
    ["Окрас", dog.color], ["География", [dog.country, dog.region].filter(Boolean).join(", ")], ["Владелец", dog.owner],
    ["Класс", ProfileData.classLabel(recordedClass)], ["Экстерьер", exterior ? Bonitation.grades[exterior] : ProfileData.text(dog.exterior)]
  ];
  for (const [label, field] of [["Кличка в оригинале", "originalName"], ["Титулы", "titles"], ["Заметки", "notes"]]) {
    if (dog[field]) main.push([label, dog[field]]);
  }
  const documents = [["Номер ВПКОС", dog.regNumber], ["Родословная FCI/РКФ", dog.pedigreeNumber],
    ["Справка о происхождении", dog.originNumber], ["Свидетельство", dog.certificateNumber], ["Клеймо", dog.tattooNumber]];
  const content = [profileInfoGrid(main), profileInfoDisclosure("documents", "Документы и номера", documents, sameDog && openGroups.has("documents"))];
  const dates = [];
  for (const [label, field] of [["Дата записи в ВПКОС", "vpkosDate"], ["Дата свидетельства", "docsDate"], ["Дата справки о происхождении", "originDate"],
    ["Дата включения в базу", "acceptedDate"], ["Дата создания записи", "recordDate"], ["Обновлено в РОРС", "updated"], ["Дата смерти", "deathDate"]]) {
    if (dog[field]) dates.push([label, formatDate(dog[field])]);
  }
  if (dates.length) content.push(profileInfoDisclosure("dates", "Даты и история записи", dates, sameDog && openGroups.has("dates")));
  panel.dataset.dogId = String(dog.id);
  panel.replaceChildren(...content);
}

function renderProfileEvents(dog) {
  const events = profileEvents(dog);
  const fill = (id, entries, format, empty) => {
    const body = byId(id);
    body.replaceChildren();
    for (const entry of [...(entries || [])].sort((a, b) => ProfileData.date(b.common_exhibition_start_date || b.start_date).localeCompare(ProfileData.date(a.common_exhibition_start_date || a.start_date)))) {
      const row = node("tr");
      format(entry).forEach((value, index) => {
        const cell = node("td", value || "—");
        cell.dataset.label = (id === "profile-trials" ? ["Мероприятие", "Дата", "Вид испытаний", "Результат"] : ["Мероприятие", "Дата", "Оценка"])[index];
        row.append(cell);
      });
      body.append(row);
    }
    byId(id + "-empty").hidden = body.children.length > 0;
    byId(id + "-table").hidden = body.children.length === 0;
    byId(id + "-empty").textContent = empty;
    decorateProfileHeading(byId(id === "profile-trials" ? "trials-title" : "exhibitions-title"), id === "profile-trials" ? "activity" : "trophy", body.children.length);
  };
  fill("profile-exhibitions", events.exhibition_evals, (entry) => {
    const evaluation = [ProfileData.gradeLabel(entry.exterior_type), ProfileData.classLabel(entry.tclass)];
    if (entry.complex_eval && Number(entry.complex_eval) > 0) evaluation.push("Комплексная оценка: " + bonPoints(Number(entry.complex_eval)));
    return [sourceLabel(entry.common_exhibition_name, entry.title_name, entry.name) || "Выставка или выводка",
      formatDate(sourceDate(entry.common_exhibition_start_date || entry.exhibition_start_date)), evaluation.filter(Boolean).join(" · ")];
  }, "Сведения о выставках и выводках пока не внесены.");
  fill("profile-trials", events.competition_evals, (entry) => {
    const diploma = { I: "Диплом I степени", II: "Диплом II степени", III: "Диплом III степени", "б/д": "Без диплома", "сн": "Снятие с испытаний" }[entry.diploma] || entry.diploma;
    const result = [diploma];
    if (entry.rating_total != null && entry.rating_total !== "") result.push("Результат: " + bonPoints(Number(entry.rating_total)));
    return [sourceLabel(entry.competition, entry.name) || "Испытание или состязание", formatDate(sourceDate(entry.start_date)),
      (entry.game_species || []).join(", ") || "Не указан", result.filter(Boolean).join(" · ")];
  }, "Сведения об испытаниях и состязаниях пока не внесены.");
  if (!(events.competition_evals || []).length && (dog.bonitations || []).some((entry) => entry.diplomas.length)) {
    const diplomas = new Map();
    for (const assessment of dog.bonitations) for (const entry of assessment.diplomas) {
      diplomas.set(JSON.stringify(entry), entry);
    }
    const rows = [...diplomas.values()].map((entry) => {
      const row = node("tr");
      for (const value of [entry.reference || "Диплом из сохранённого расчёта", formatDate(entry.date),
        Bonitation.trials[entry.type] + " · " + Bonitation.formats[entry.work], "Диплом " + Bonitation.degrees[entry.degree] + " степени"]) {
        const cell = node("td", value);
        cell.dataset.label = ["Мероприятие", "Дата", "Вид испытаний", "Результат"][row.children.length];
        row.append(cell);
      }
      return row;
    });
    byId("profile-trials").replaceChildren(...rows);
    byId("profile-trials-empty").hidden = true;
    byId("profile-trials-table").hidden = false;
    decorateProfileHeading(byId("trials-title"), "activity", rows.length);
  }
  byId("profile-achievements").textContent = dog.achievements || "";
  byId("profile-achievements").hidden = !dog.achievements;
}

function renderDescendants(dog) {
  descendantsResizeObserver?.disconnect();
  const section = node("section", undefined, "descendants-panel");
  section.setAttribute("aria-label", "Потомки собаки «" + dog.name + "»");
  const children = profileChildren(dog);
  const header = node("div", undefined, "descendants-header");
  const title = node("div", undefined, "descendants-title");
  const descendantsHeading = node("h3", "Потомки");
  descendantsHeading.prepend(profileIcon("paw"));
  title.append(descendantsHeading);
  if (children.length) title.append(node("span", "Всего: " + children.length, "descendants-count"));
  header.append(title);
  section.append(header);
  if (!children.length) {
    section.append(node("p", "Нет сведений о потомках.", "profile-empty"));
    return section;
  }

  const list = node("ul", undefined, "descendants-list");
  list.tabIndex = 0;
  list.setAttribute("aria-label", "Карточки потомков");
  for (const child of children) {
    const item = node("li");
    const card = dogLink(child);
    card.className = "pedigree-card descendants-card";
    card.setAttribute("aria-label", "Открыть карточку собаки «" + child.name + "»");
    card.replaceChildren(
      node("span", child.sex === "male" ? "Сын" : child.sex === "female" ? "Дочь" : "Потомок", "pedigree-role"),
      node("span", child.name, "pedigree-name")
    );
    const meta = [child.birth && formatDate(child.birth), child.regNumber && "ВПКОС " + child.regNumber].filter(Boolean).join(" · ");
    if (meta) card.append(node("span", meta, "pedigree-meta"));
    card.append(node("span", "Открыть карточку", "descendants-open"));
    item.append(card);
    list.append(item);
  }
  const navigation = node("div", undefined, "descendants-navigation");
  navigation.setAttribute("role", "group");
  navigation.setAttribute("aria-label", "Листание потомков");
  navigation.hidden = true;
  const move = (direction) => {
    const positions = [...list.children].map((item) => item.offsetLeft - list.firstElementChild.offsetLeft);
    const target = direction > 0 ? positions.find((left) => left > list.scrollLeft + 2)
      : positions.reverse().find((left) => left < list.scrollLeft - 2);
    list.scrollTo({ left: target ?? (direction > 0 ? list.scrollWidth : 0),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const previous = bonButton("Назад", () => move(-1), "button");
  const next = bonButton("Далее", () => move(1), "button");
  previous.setAttribute("aria-label", "Предыдущая карточка потомка");
  next.setAttribute("aria-label", "Следующая карточка потомка");
  navigation.append(previous, next);
  header.append(navigation);
  section.append(list);
  const updateControls = () => {
    navigation.hidden = list.scrollWidth <= list.clientWidth + 2;
    previous.disabled = list.scrollLeft <= 2;
    next.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
  };
  list.addEventListener("scroll", updateControls, { passive: true });
  list.addEventListener("keydown", (event) => {
    if (event.target !== list || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  if (typeof ResizeObserver === "function") {
    descendantsResizeObserver = new ResizeObserver(updateControls);
    descendantsResizeObserver.observe(list);
  }
  requestAnimationFrame(updateControls);
  return section;
}

function renderProfilePedigree(dog) {
  const ancestors = pedigreePanel(dog);
  const empty = node("section", undefined, "pedigree-panel");
  empty.append(node("h3", "Предки"), node("p", "Нет сведений о предках.", "profile-empty"));
  byId("profile-pedigree").replaceChildren(ancestors || empty, renderDescendants(dog));
}

function renderAutomaticBonitation(dog, relatives = [], loading = false) {
  renderProfileBonitation(dog, relatives, loading);
}

function renderProfileBlocks(dog) {
  const token = ++profileRenderToken;
  renderBasicInformation(dog); renderProfileEvents(dog); renderProfilePedigree(dog);
  const ownId = profileSourceId(dog);
  const needsSourceArchive = !dog.rors && ownId && !archive && canLoadHostedArchive
    && (!dog.sourceEvents || dog.sourceChildren === null);
  const needsArchive = ownId && archive?.byId.has(ownId) && !profileSourceCache.has(ownId);
  const related = [...[pedigreeForDog(dog)?.father?.dog, pedigreeForDog(dog)?.mother?.dog].filter(Boolean), ...profileChildren(dog)];
  renderAutomaticBonitation(dog, [], Boolean(needsArchive || related.length || needsSourceArchive && (!archiveLoadAttempted || archiveLoading) || dog.live && liveDetail?.loading));
  if (needsSourceArchive && !archiveLoading && !archiveLoadAttempted) {
    void attachArchive();
  }
  if (needsSourceArchive && archiveLoading) return;
  void (async () => {
    await readProfileSource(dog);
    const relatives = [];
    let index = 0;
    const childIds = new Set(profileChildren(dog).map((child) => profileSourceId(child) || child.id));
    await Promise.all(Array.from({ length: Math.min(8, related.length) }, async () => {
      while (index < related.length) {
        if (token !== profileRenderToken) return;
        const relative = related[index++];
        const result = await readProfileSource(relative);
        relatives.push({ ...result, child: childIds.has(profileSourceId(relative) || relative.id) });
      }
    }));
    if (token !== profileRenderToken || currentDog()?.id !== dog.id) return;
    renderBasicInformation(dog); renderProfileEvents(dog); renderAutomaticBonitation(dog, relatives);
  })().catch(() => {
    if (token !== profileRenderToken) return;
    byId("bon-auto").append(node("p", "Часть результатов недоступна. Оценка рассчитана по доступным сведениям.", "bon-muted"));
  });
}
