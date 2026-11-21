"use strict";

const profileSourceCache = new Map();
const profileChildrenCache = new Map();
let profileRenderToken = 0;

let profileLoadingSequence = 0;

function startProfileLoading(name = "") {
  const ticket = { sequence: ++profileLoadingSequence, route: location.hash, progress: 0 };
  byId("profile").hidden = true;
  byId("catalog").hidden = true;
  byId("profile-loading").hidden = false;
  byId("profile-loading-name").textContent = name;
  byId("profile-loading-error").hidden = true;
  byId("profile-loading-retry").hidden = true;
  updateProfileLoading(ticket, 0, "Получаем сведения о собаке…");
  return ticket;
}

function isProfileLoadingCurrent(ticket) {
  return ticket?.sequence === profileLoadingSequence && ticket.route === location.hash;
}

function updateProfileLoading(ticket, progress, message) {
  if (!isProfileLoadingCurrent(ticket)) return;
  ticket.progress = Math.max(ticket.progress, Math.min(100, Math.round(progress)));
  byId("profile-loading").style.setProperty("--load-progress", ticket.progress);
  byId("profile-loading-percent").textContent = ticket.progress + "%";
  byId("profile-loading-progress").setAttribute("aria-valuenow", String(ticket.progress));
  if (message) byId("profile-loading-status").textContent = message;
}

function finishProfileLoading(ticket) {
  if (!isProfileLoadingCurrent(ticket)) return;
  updateProfileLoading(ticket, 100, "Карточка готова");
  byId("profile-loading").hidden = true;
  byId("profile").hidden = false;
}

function failProfileLoading(ticket, message, retry) {
  if (!isProfileLoadingCurrent(ticket)) return;
  byId("profile-loading-status").textContent = "Не удалось загрузить карточку полностью";
  byId("profile-loading-error").textContent = message || "Проверьте соединение и повторите загрузку.";
  byId("profile-loading-error").hidden = false;
  const button = byId("profile-loading-retry");
  button.hidden = false;
  button.onclick = retry;
}

function cancelProfileLoading() {
  profileLoadingSequence++;
  byId("profile-loading").hidden = true;
}

function profileSourceId(dog) {
  return dog.rors ? String(dog.id) : dog.archiveSourceId || "";
}

function hasCompleteProfileEvents(events) {
  return Array.isArray(events?.exhibition_evals) && Array.isArray(events?.competition_evals);
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
  const online = id && liveDetail?.id === id ? liveDetail.children || [] : [];
  const result = new Map();
  for (const child of [...(dog.sourceChildren || []), ...fromArchive, ...(profileChildrenCache.get(id) || []), ...online, ...local]) result.set(child.archiveSourceId || String(child.id), child);
  return [...result.values()];
}

async function loadProfileChildren(dog) {
  const children = profileChildren(dog);
  const id = profileSourceId(dog);
  if (children.length || !id || !dog.live && archive?.byId.has(id) || profileChildrenCache.has(id)) return children;
  const data = await rorsGet("/api/dog_children/" + id);
  if (!Array.isArray(data?.children)) throw new Error("РОРС вернул сведения о потомках в неизвестном формате.");
  const rows = data.children;
  const loaded = rows.map((entry) => entry?.entity ?? entry?.dog ?? entry)
    .filter((entry) => entry && /^\d+$/.test(String(entry.id))).map(rorsDog);
  profileChildrenCache.set(id, loaded);
  return loaded;
}

async function readProfileSource(dog, { required = false } = {}) {
  const id = profileSourceId(dog);
  if (!id) return { dog, events: profileEvents(dog) };
  if (dog.live && liveDetail?.dog?.id === id) return { dog, events: liveDetail.events || {} };
  const cacheKey = (dog.live ? "live:" : "") + id;
  const cached = profileSourceCache.get(cacheKey);
  if (cached && !cached.partial) return cached;
  const archived = archive?.byId.get(id);
  if (archived && !dog.live) {
    const row = await readArchiveRecord(archive.file, archived);
    const result = { dog: archived, events: ProfileData.cleanEvents(row) || {} };
    profileSourceCache.set(cacheKey, result);
    return result;
  }
  if (!dog.live && hasCompleteProfileEvents(dog.sourceEvents)) {
    const result = { dog, events: dog.sourceEvents };
    profileSourceCache.set(cacheKey, result);
    return result;
  }
  if (!/^\d+$/.test(id)) return { dog, events: profileEvents(dog) };
  const results = await Promise.allSettled([
    rorsEvaluations("/api/exhevals", "exhibition_evals", id),
    rorsEvaluations("/api/compevals", "competition_evals", id)
  ]);
  const saved = dog.sourceEvents || {};
  const fields = ["exhibition_evals", "competition_evals"];
  const events = {};
  const missing = [];
  results.forEach((entry, index) => {
    const field = fields[index];
    if (entry.status === "fulfilled") events[field] = entry.value;
    else if (Array.isArray(saved[field])) events[field] = saved[field];
    else missing.push(index === 0 ? "выставки и выводки" : "испытания и состязания");
  });
  if (required && missing.length) throw new Error("Не удалось загрузить: " + missing.join(", ") + ". Повторите загрузку.");
  const result = { dog, events, partial: results.some((entry) => entry.status === "rejected") };
  // A failed response is never remembered as an empty, successfully loaded record.
  profileSourceCache.set(cacheKey, result);
  return result;
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

function wireProfileCarousel(list) {
  list.tabIndex = 0;
  list.addEventListener("keydown", (event) => {
    if (event.target !== list || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (event.key === "Home" || event.key === "End") {
      list.scrollTo({ left: event.key === "Home" ? 0 : list.scrollWidth, behavior });
    } else {
      const step = list.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(list).columnGap);
      list.scrollBy({ left: (event.key === "ArrowLeft" ? -1 : 1) * step, behavior });
    }
  });
}

function profileEventCard(title, date, fields) {
  const item = node("li");
  const card = node("article", undefined, "profile-event-card");
  card.append(node("h3", title), node("p", date || "Дата не указана", "profile-event-date"));
  const details = node("dl", undefined, "profile-event-details");
  for (const [label, value] of fields) {
    if (!value) continue;
    const field = node("div"); field.append(node("dt", label), node("dd", value)); details.append(field);
  }
  card.append(details); item.append(card);
  return item;
}

function renderProfileEvents(dog) {
  const events = profileEvents(dog);
  const fill = (id, entries, make, empty) => {
    const list = byId(id);
    const items = [...(entries || [])].filter((entry) => entry && typeof entry === "object")
      .sort((a, b) => ProfileData.date(b.common_exhibition_start_date || b.exhibition_start_date || b.start_date)
        .localeCompare(ProfileData.date(a.common_exhibition_start_date || a.exhibition_start_date || a.start_date)));
    list.replaceChildren(...items.map(make));
    if (!list.dataset.carouselReady) { wireProfileCarousel(list); list.dataset.carouselReady = "true"; }
    byId(id + "-empty").hidden = items.length > 0;
    byId(id + "-table").hidden = items.length === 0;
    byId(id + "-empty").textContent = empty;
    decorateProfileHeading(byId(id === "profile-trials" ? "trials-title" : "exhibitions-title"), id === "profile-trials" ? "activity" : "trophy", items.length);
  };
  fill("profile-exhibitions", events.exhibition_evals, (entry) => profileEventCard(
    sourceLabel(entry.common_exhibition_name, entry.title_name, entry.name) || "Выставка или выводка",
    formatDate(sourceDate(entry.common_exhibition_start_date || entry.exhibition_start_date)), [
      ["Оценка", ProfileData.gradeLabel(entry.exterior_type)],
      ["Племенной класс", ProfileData.classLabel(entry.tclass)],
      ["Комплексная оценка", Number(entry.complex_eval) > 0 ? bonPoints(Number(entry.complex_eval)) : ""]
    ]), "Сведения о выставках и выводках пока не внесены.");
  let trials = events.competition_evals || [];
  if (!trials.length) {
    const diplomas = new Map();
    for (const assessment of dog.bonitations || []) for (const entry of assessment.diplomas || []) {
      diplomas.set(JSON.stringify(entry), {
        competition: entry.reference || "Диплом из сохранённого расчёта", start_date: entry.date,
        diploma: Bonitation.degrees[entry.degree],
        game_species: [Bonitation.trials[entry.type], Bonitation.formats[entry.work]].filter(Boolean)
      });
    }
    trials = [...diplomas.values()];
  }
  fill("profile-trials", trials, (entry) => {
    const diploma = { I: "Диплом I степени", II: "Диплом II степени", III: "Диплом III степени", "б/д": "Без диплома", "сн": "Снятие с испытаний" }[entry.diploma] || entry.diploma;
    return profileEventCard(sourceLabel(entry.competition, entry.name) || "Испытание или состязание",
      formatDate(sourceDate(entry.start_date)), [
        ["Вид испытаний", (entry.game_species || []).join(", ") || "Не указан"],
        ["Результат", diploma || "Не указан"],
        ["Баллы", entry.rating_total != null && entry.rating_total !== "" && Number.isFinite(Number(entry.rating_total)) ? bonPoints(Number(entry.rating_total)) : ""]
      ]);
  }, "Сведения об испытаниях и состязаниях пока не внесены.");
  byId("profile-achievements").textContent = dog.achievements || "";
  byId("profile-achievements").hidden = !dog.achievements;
}

function renderDescendants(dog) {
  const section = node("section", undefined, "descendants-panel");
  section.setAttribute("aria-label", "Потомки собаки «" + dog.name + "»");
  const children = profileChildren(dog);
  const header = node("div", undefined, "descendants-header");
  const title = node("div", undefined, "descendants-title");
  const descendantsHeading = node("h3", "Потомки");
  decorateProfileHeading(descendantsHeading, "paw", children.length);
  title.append(descendantsHeading);
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
  section.append(list);
  wireProfileCarousel(list);
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

async function renderProfileBlocks(dog, onProgress = () => {}) {
  const token = ++profileRenderToken;
  const ownId = profileSourceId(dog);
  if (!dog.live && /^\d+$/.test(ownId)) await loadProfileChildren(dog);
  if (token !== profileRenderToken) return;
  const own = await readProfileSource(dog, { required: true });
  if (token !== profileRenderToken) return;
  renderBasicInformation(dog); renderProfileEvents(dog); renderProfilePedigree(dog);
  const related = [...[pedigreeForDog(dog)?.father?.dog, pedigreeForDog(dog)?.mother?.dog].filter(Boolean), ...profileChildren(dog)];
  onProgress(0.1);
    const relatives = [];
    let index = 0;
    const childIds = new Set(profileChildren(dog).map((child) => profileSourceId(child) || child.id));
    await Promise.all(Array.from({ length: Math.min(8, related.length) }, async () => {
      while (index < related.length) {
        if (token !== profileRenderToken) return;
        const relative = related[index++];
        const result = await readProfileSource(relative);
        relatives.push({ ...result, child: childIds.has(profileSourceId(relative) || relative.id) });
        onProgress(0.1 + 0.9 * relatives.length / related.length);
      }
    }));
    if (token !== profileRenderToken || currentDog()?.id !== dog.id) return;
    renderBasicInformation(dog); renderProfileEvents(dog); renderAutomaticBonitation(dog, relatives);
    if (own.partial) byId("live-profile-status").textContent = "Часть данных не удалось обновить. Показаны сохранённые сведения.";
    onProgress(1);
}
