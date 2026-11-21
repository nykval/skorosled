"use strict";

const bonParentFields = ["fatherGrade", "motherGrade", "fatherDiploma", "motherDiploma"];
const bonAgeLabels = { junior: "Младшая группа", middle: "Средняя группа", senior: "Старшая группа" };
let bonSession;

function bonDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? "" : value;
}

function bonText(value, limit = 160) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function bonInteger(value, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= max ? number : 0;
}

function bonChoice(table, value) {
  return Object.hasOwn(table, value) ? value : "";
}

function bonDiploma(data = {}) {
  return {
    type: bonChoice(Bonitation.trials, data?.type), degree: bonInteger(data?.degree, 3),
    work: bonChoice(Bonitation.formats, data?.work), date: bonDate(data?.date), reference: bonText(data?.reference)
  };
}

function bonOffspring(data = {}) {
  return { ...bonDiploma(data), name: bonText(data?.name), grade: bonChoice(Bonitation.grades, data?.grade) };
}

function bonInput(data = {}) {
  return {
    id: bonText(data.id), show: bonText(data.show), date: bonDate(data.date),
    group: bonChoice(Bonitation.groups, data.group), grade: bonChoice(Bonitation.grades, data.grade),
    documents: ["rors", "foreign", "fci"].includes(data.documents) ? data.documents : "",
    nationalBook: bonText(data.nationalBook, 80), ringPlace: bonInteger(data.ringPlace, 9999),
    pairs: [1, 2, 4, 8].map((max, index) => bonInteger(data.pairs?.[index], max)),
    parents: bonParentFields.map((_, index) => data.parents?.[index] === true),
    diplomas: Array.isArray(data.diplomas) ? data.diplomas.map(bonDiploma) : [],
    offspring: Array.isArray(data.offspring) ? data.offspring.map(bonOffspring) : [],
    dog: {
      breed: bonText(data.dog?.breed, 100), sex: ["male", "female"].includes(data.dog?.sex) ? data.dog.sex : "",
      birth: bonDate(data.dog?.birth), regNumber: bonText(data.dog?.regNumber, 80)
    }
  };
}

function readBonitations(data) {
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  return data.filter((item) => item && typeof item === "object").map(bonInput).filter((item) => {
    if (!item.id || !item.show || !item.date || !item.group || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function bonButton(label, action, css = "button") {
  const button = node("button", label, css);
  button.type = "button";
  button.onclick = action;
  return button;
}

function bonNumber(value) {
  return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}

function bonPoints(value) {
  const last = value % 10;
  const lastTwo = value % 100;
  const word = !Number.isInteger(value) ? "балла" : lastTwo >= 11 && lastTwo <= 14 ? "баллов"
    : last === 1 ? "балл" : last >= 2 && last <= 4 ? "балла" : "баллов";
  return bonNumber(value) + " " + word;
}

function bonDiplomaLabel(diploma) {
  return [Bonitation.trials[diploma.type], Bonitation.degrees[diploma.degree], Bonitation.formats[diploma.work].toLowerCase(),
    diploma.reference, diploma.date && formatDate(diploma.date)].filter(Boolean).join(" · ");
}

function bonShowKey(input) {
  return bonNameKey(input.show) + "|" + input.date;
}

const bonNameKey = (value) => normalize(value).replace(/\s+/g, " ");

function bonPeerKey(input, result) {
  return JSON.stringify([bonShowKey(input), bonNameKey(input.dog.breed), input.group, input.dog.sex, result.age, result.qualified?.index]);
}

function bonStanding(dog, data, result) {
  if (!result?.qualified || !result.age || !data.dog.sex || !data.documents || !data.grade || dog.demo) return "";
  const ring = bonPeerKey(data, result);
  const entries = [{ id: dog.id, result, ringPlace: data.ringPlace }];
  for (const peer of records) {
    if (peer.id === dog.id || peer.demo) continue;
    const assessment = peer.bonitations.find((entry) =>
      entry.grade && entry.documents && bonShowKey(entry) === bonShowKey(data)
      && bonNameKey(entry.dog.breed) === bonNameKey(data.dog.breed) && entry.dog.sex === data.dog.sex);
    if (!assessment) continue;
    const peerResult = Bonitation.calculate(assessment, assessment.dog);
    if (peerResult?.qualified && bonPeerKey(assessment, peerResult) === ring) {
      entries.push({ id: peer.id, result: peerResult, ringPlace: assessment.ringPlace });
    }
  }
  if (entries.length < 2) return "Место появится после добавления других собак этого класса и ринга.";
  const { first, last, count } = Bonitation.ringStanding(entries, dog.id);
  if (first !== last) return "Места " + first + "–" + last + " среди " + count
    + " внесённых собак. Для точного места нужны результаты экстерьерного ринга.";
  return "Место " + first + " из " + count + " внесённых собак.";
}

function renderBonitationPanel(dog) {
  byId("bon-panel").hidden = false;
  const local = registryDog(dog);
  const make = byId("bon-new");
  make.textContent = "Новый расчёт";
  make.onclick = () => openProfileBonitation(dog, true);
  const history = byId("bon-history");
  if (!local) {
    history.replaceChildren(node("p", "Добавьте собаку из базы РОРС в свой реестр, чтобы сохранять расчёты.", "bon-muted"));
    return;
  }
  if (!local.bonitations.length) {
    history.replaceChildren(node("p", "Расчётов по выставкам пока нет.", "bon-muted"));
    return;
  }
  const list = node("ul", undefined, "bon-saved");
  for (const entry of [...local.bonitations].sort((a, b) => b.date.localeCompare(a.date))) {
    const result = Bonitation.calculate(entry, entry.dog);
    const item = node("li");
    const caption = node("div");
    const name = node("strong", entry.show + " · " + formatDate(entry.date));
    let summary = "Планирование · оценка экстерьера ещё не внесена";
    if (entry.grade) {
      summary = result.qualified
        ? (!entry.documents || !result.age ? "Предварительно · " : "")
          + Bonitation.classNames[result.qualified.index] + " · " + bonPoints(result.qualified.total)
        : result.admission.length ? "Требуется проверка допуска" : "Условия класса пока не выполнены";
    }
    caption.append(name, node("p", summary, "bon-muted"));
    const standing = bonStanding(local, entry, result);
    if (standing) caption.append(node("p", standing, "bon-muted"));
    item.append(caption, bonButton("Открыть расчёт", () => openBonitation(local, entry),
      "button subtle"));
    list.append(item);
  }
  history.replaceChildren(list);
}

function copyForBonitation(dog) {
  if (!canCopyArchiveDog(dog)) {
    notice("В выгрузке не указаны порода или пол. Создайте карточку и заполните эти сведения.");
    return;
  }
  try {
    const copy = archiveDogCopy(dog);
    saveRecords([copy, ...records]);
    openPersonalDog(copy);
    byId("status").textContent = "Карточка добавлена в ваш реестр.";
  } catch (error) { notice(error.message); }
}

function bonRelatives(dog) {
  const online = dog.archiveSourceId && liveDetail?.dog?.id === dog.archiveSourceId ? liveDetail : null;
  const archiveDog = dog.archiveSourceId && archive?.byId.get(dog.archiveSourceId);
  const saved = Pedigree.toMap(pedigreeForDog(dog));
  const source = online?.dog || archiveDog || saved.get(dog.id) || dog;
  const lookup = online ? new Map(online.related) : archiveDog ? archive.byId : saved;
  if (online) {
    lookup.set(source.id, source);
    for (const child of online.children || []) lookup.set(child.id, child);
  }
  return {
    pairs: Bonitation.pedigreeFromRegistry(source, lookup),
    offspring: [...lookup.values()].filter((record) => record.fatherId === source.id || record.motherId === source.id)
  };
}

function bonOptionField(text, name, options, value, empty) {
  const select = node("select");
  select.name = name;
  replaceOptions(select, empty, options);
  select.value = value || "";
  return bonLabel(text, select);
}

function bonLabel(text, field) {
  const label = node("label", text);
  label.append(field);
  return label;
}

function bonTextField(text, name, type, value) {
  const input = node("input");
  input.type = type;
  input.name = name;
  if (type === "text") input.maxLength = 160;
  input.value = value || "";
  return bonLabel(text, input);
}

function bonTrialOptions(key, child, prior) {
  const group = Bonitation.groups[key];
  const types = group ? child ? group.offspringProfile || group.profile : [...group.profile, ...group.other] : Object.keys(Bonitation.trials);
  const options = types.map((type) => [Bonitation.trials[type], type]);
  if (prior && !types.includes(prior)) options.push([Bonitation.trials[prior] + " · вне выбранного списка", prior]);
  return options;
}

function addBonEntry(child, data = {}) {
  const list = byId(child ? "bon-offspring" : "bon-diplomas");
  const row = node("div", undefined, "bon-entry");
  const fields = node("div", undefined, "bon-fields");
  const key = byId("bon-form").elements.group.value;
  const options = (object) => Object.entries(object).map(([value, label]) => [label, value]);
  if (child) {
    fields.append(bonTextField("Кличка и номер", "name", "text", data.name),
      bonOptionField("Оценка экстерьера", "offspringGrade", options(Bonitation.grades), data.grade, "Не указана"));
  }
  fields.append(bonOptionField("Вид испытаний", "type", bonTrialOptions(key, child, data.type), data.type, "Выберите вид"),
    bonOptionField("Степень диплома", "degree", Bonitation.degrees.slice(1).map((label, index) => [label, String(index + 1)]), data.degree, "Нет"));
  const workOptions = child ? [[Bonitation.formats.solo, "solo"]] : options(Bonitation.formats);
  if (child && data.work && data.work !== "solo") workOptions.push([Bonitation.formats[data.work] + " · не учитывается", data.work]);
  fields.append(bonOptionField("Формат работы", "work", workOptions, data.work, "Не указан"));
  if (!child) fields.append(bonTextField("Дата диплома", "diplomaDate", "date", data.date),
    bonTextField("Мероприятие или номер", "reference", "text", data.reference));
  const actions = node("div", undefined, "bon-toolbar");
  actions.append(bonButton(child ? "Убрать потомка" : "Убрать диплом", () => {
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    (next?.querySelector("input, select") || byId(child ? "bon-add-offspring" : "bon-add-diploma")).focus();
    previewBonitation();
  }, "button subtle"));
  row.append(fields, actions);
  list.append(row);
  return row;
}

function draftBonitation(dog) {
  const relatives = bonRelatives(dog);
  const last = [...dog.bonitations].sort((a, b) => b.date.localeCompare(a.date))[0];
  const names = relatives.offspring.map((child) => [child.name, child.regNumber].filter(Boolean).join(" · "));
  const offspring = [...(last?.offspring || [])];
  const existingNames = new Set(offspring.map((child) => normalize(child.name)));
  offspring.push(...names.filter((name) => !existingNames.has(normalize(name))).map((name) => ({ name })));
  return bonInput({
    ...last, id: "", show: "", date: "", grade: "", ringPlace: 0, dog,
    group: last?.group || Bonitation.groupForBreed(dog.breed),
    documents: last?.documents ?? (dog.originNumber || dog.certificateNumber || dog.regNumber ? "rors" : ""),
    pairs: last ? relatives.pairs.map((count, index) => Math.max(count, last.pairs[index])) : relatives.pairs,
    offspring
  });
}

function openBonitation(dog, saved, initial) {
  const dialog = byId("bon-editor");
  const form = byId("bon-form");
  const data = saved || initial || draftBonitation(dog);
  bonSession = { dog, original: saved, snapshot: bonInput({ dog }).dog };

  form.reset();
  byId("bon-edit-title").textContent = "Бонитировка · " + dog.name;
  const names = [...new Set(records.flatMap((record) => record.bonitations.map((entry) => entry.show)))].sort(alphabetic);
  byId("bon-shows").replaceChildren(...names.map((name) => new Option(name)));
  for (const name of ["show", "date", "group", "grade", "ringPlace", "documents", "nationalBook"]) {
    form.elements[name].value = data[name] || "";
  }
  bonParentFields.forEach((field, index) => { form.elements[field].checked = data.parents[index]; });
  [...byId("bon-pairs").querySelectorAll("select")].forEach((select, index) => { select.value = String(data.pairs[index]); });
  byId("bon-diplomas").replaceChildren();
  byId("bon-offspring").replaceChildren();
  data.diplomas.forEach((item) => addBonEntry(false, item));
  data.offspring.forEach((item) => addBonEntry(true, item));
  byId("bon-error").hidden = true;
  byId("bon-recalculated").textContent = "";
  byId("bon-delete").hidden = !saved;
  previewBonitation();
  dialog.showModal();
  dialog.scrollTop = 0;
}

function bonReadForm() {
  const fields = byId("bon-form").elements;
  const entries = (id) => [...byId(id).children].map((row) => {
    const read = (name) => row.querySelector('[name="' + name + '"]')?.value;
    return { name: read("name"), type: read("type"), degree: read("degree"), work: read("work"),
      grade: read("offspringGrade"), date: read("diplomaDate"), reference: read("reference") };
  });
  return bonInput({
    id: bonSession.original?.id, show: fields.show.value, date: fields.date.value, group: fields.group.value,
    grade: fields.grade.value, ringPlace: fields.ringPlace.value, documents: fields.documents.value,
    nationalBook: fields.nationalBook.value, pairs: [...byId("bon-pairs").querySelectorAll("select")].map((select) => select.value),
    parents: bonParentFields.map((field) => fields[field].checked),
    diplomas: entries("bon-diplomas"), offspring: entries("bon-offspring"), dog: bonSession.snapshot
  });
}

function bonList(lines, css) {
  const list = node("ul", undefined, css);
  list.append(...lines.map((line) => node("li", line)));
  return list;
}

function bonDetails(title, content) {
  const details = node("details");
  details.append(node("summary", title), content);
  return details;
}

function previewBonitation() {
  const input = bonReadForm();
  const result = Bonitation.calculate(input, input.dog);
  byId("bon-national").hidden = input.documents !== "foreign";
  const panel = byId("bon-result");
  if (!result) {
    panel.replaceChildren(node("h3", "Предварительный расчёт"), node("p", "Выберите группу пород по РОРС."));
    return;
  }
  const { qualified, admission, candidates } = result;
  const current = qualified || candidates.find(({ work }) => work);
  const classTitle = qualified
    ? (!input.documents || !result.age ? "Предварительно · " : "")
      + Bonitation.classNames[qualified.index] + " · " + bonPoints(qualified.total)
    : input.grade && admission.length === 0 ? "Условия класса пока не выполнены" : "Предварительный расчёт";
  const content = [node("h3", classTitle)];
  if (result.age in bonAgeLabels) content.push(node("p", bonAgeLabels[result.age], "bon-muted"));
  else if (!result.age && input.date) content.push(node("p", "Для определения возрастной группы укажите дату рождения в карточке.", "bon-muted"));
  if (admission.length) content.push(bonList(admission));
  if (result.laterDiplomas) content.push(node("p", "Дипломы с датой позже дня выставки исключены из расчёта ("
    + result.laterDiplomas + ").", "bon-muted"));
  if (!input.documents) content.push(node("p", "Подтвердите племенные документы для участия в комплексном ринге.", "bon-muted"));
  if (result.temporaryRetrieverRules) {
    const note = node("p", "Временная таблица до 31.12.2028 · ", "bon-muted");
    const link = node("a", "Постановление РОРС № 45", "source-link");
    link.href = "https://rors-os.ru/zadmin_data/file.attach/17280.jpg";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    note.append(link);
    content.push(note);
  }
  if (input.group === "eastLaika" && result.generations >= 2 && result.origin < 16 && (!qualified || qualified.index > 1)) {
    content.push(node("p", "При двухколенной родословной уточните у эксперта порог по происхождению для второго класса.", "bon-muted"));
  }
  if (!input.grade) {
    const options = ["excellent", "veryGood", "good"].filter((grade) => grade !== "excellent" || result.age !== "junior");
    const forecast = options.map((grade) => {
      const alternative = Bonitation.calculate(input, input.dog, grade).qualified;
      return Bonitation.grades[grade] + " · " + (alternative
        ? Bonitation.classNames[alternative.index] + ", " + bonPoints(alternative.total)
        : "условия класса не выполнены");
    });
    content.push(bonList(forecast));
  }
  const work = current?.work;
  const scores = [
    "Охотничьи качества · " + (work?.points ?? "—"),
    "Экстерьер · " + (input.grade ? result.gradePoints : "—"),
    "Происхождение · " + bonNumber(result.origin) + " · полных поколений " + result.generations,
    "Потомство · " + result.offspringPoints + " · зачтено " + result.offspring.length
  ];
  content.push(bonList(scores));
  if (work) {
    const workLines = ["Основной · " + bonDiplomaLabel(work.main) + " · +" + work.main.points];
    if (work.repeat) workLines.push("Повторный · " + bonDiplomaLabel(work.repeat) + " · +" + work.repeat.points);
    for (const diploma of work.versatility) workLines.push("Универсальность · " + bonDiplomaLabel(diploma) + " · +" + diploma.points);
    content.push(bonDetails("Зачтённые дипломы · " + Bonitation.classNames[current.index], bonList(workLines)));
  }
  if (result.offspring.length) {
    content.push(bonDetails("Зачтённые потомки", bonList(result.offspring.map((child) => child.name + " · +" + child.points))));
  }
  for (const candidate of candidates) {
    const checks = node("ul");
    for (const [met, description] of candidate.checks) {
      checks.append(node("li", (met ? "Выполнено · " : "Требуется · ") + description, met ? "bon-passed" : "bon-missing"));
    }
    const details = bonDetails(Bonitation.classNames[candidate.index], checks);
    details.open = Boolean(input.grade) && candidate.index === (qualified ? Math.max(qualified.index - 1, 0) : (current?.index ?? 0));
    content.push(details);
  }
  const standing = bonStanding(bonSession.dog, input, result);
  if (standing) content.push(node("p", standing, "bon-muted"));
  panel.replaceChildren(...content);
}

function validateBonitation(data) {
  if (!data.show || !data.date || !data.group) throw new Error("Укажите название, дату выставки и группу пород.");
  if (data.ringPlace && !data.grade) throw new Error("Укажите оценку экстерьера, чтобы сохранить место в экстерьерном ринге.");
  const group = Bonitation.groups[data.group];
  if (data.diplomas.some((entry) => !entry.type || !entry.degree || !entry.work)) {
    throw new Error("Для каждого диплома укажите вид, степень и формат работы или уберите пустую строку.");
  }
  if (data.diplomas.some((entry) => !group.profile.includes(entry.type) && !group.other.includes(entry.type))) {
    throw new Error("Сверьте вид испытаний с выбранной группой пород.");
  }
  const knownDiplomas = data.diplomas.filter((entry) => entry.date || entry.reference)
    .map((entry) => JSON.stringify([entry.type, entry.degree, entry.work, entry.date, bonNameKey(entry.reference)]));
  if (new Set(knownDiplomas).size !== knownDiplomas.length) {
    throw new Error("Два диплома заполнены одинаково. Уберите дубль или укажите разные мероприятия или номера.");
  }
  if (data.offspring.some((child) => !child.name || ((child.type || child.degree || child.work)
    && (!(group.offspringProfile || group.profile).includes(child.type) || !child.degree || !child.work)))) {
    throw new Error("Укажите кличку потомка. Для зачёта диплома заполните профильный вид, степень и формат работы.");
  }
  if (data.offspring.some((child) => child.work && child.work !== "solo")) {
    throw new Error("Для зачёта потомка нужен диплом за работу в одиночку.");
  }
  const names = data.offspring.map((child) => normalize(child.name));
  if (new Set(names).size !== names.length) throw new Error("Укажите каждого потомка один раз. Для тёзок добавьте номер документа.");
  const result = Bonitation.calculate(data, data.dog);
  if (result.age === "junior" && data.grade === "excellent") {
    throw new Error("В младшей группе максимальная оценка экстерьера — «очень хорошо».");
  }
}

function mountBonitation() {
  const form = byId("bon-form");
  const dialog = byId("bon-editor");
  replaceOptions(form.elements.group, "Выберите группу", Object.entries(Bonitation.groups).map(([key, group]) => [group.label, key]));
  replaceOptions(form.elements.grade, "Ещё не выставлена", Object.entries(Bonitation.grades).map(([key, label]) => [label, key]));
  const pairs = byId("bon-pairs");
  ["Родители", "Деды и бабки", "Прадеды и прабабки", "Прапрадеды и прапрабабки"].forEach((label, index) => {
    pairs.append(bonOptionField(label, "pairs" + index, Array.from({ length: 2 ** index }, (_, i) =>
      [String(i + 1), String(i + 1)]), "", "0"));
    pairs.lastElementChild.lastElementChild.options[0].value = "0";
  });
  for (const [button, child] of [["bon-add-diploma", false], ["bon-add-offspring", true]]) {
    byId(button).onclick = () => {
      addBonEntry(child).querySelector("input, select").focus();
      previewBonitation();
    };
  }
  byId("bon-recalculate").onclick = () => {
    previewBonitation();
    byId("bon-recalculated").textContent = "Бонитировка пересчитана. Сохраните результат.";
    byId("bon-result").scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  form.addEventListener("input", () => { byId("bon-recalculated").textContent = ""; });
  byId("bon-close").onclick = byId("bon-cancel").onclick = () => dialog.close();
  byId("bon-delete").onclick = () => {
    const { original } = bonSession;
    if (!original || !confirm("Удалить расчёт для выставки «" + original.show + "»?")) return;
    try {
      saveBonitations((items) => items.filter((entry) => entry.id !== original.id));
      dialog.close();
      byId("status").textContent = "Расчёт удалён.";
    } catch (error) { showBonError(error); }
  };
  form.elements.group.addEventListener("change", () => {
    for (const [id, child] of [["bon-diplomas", false], ["bon-offspring", true]]) {
      for (const select of byId(id).querySelectorAll('[name="type"]')) {
        const value = select.value;
        replaceOptions(select, "Выберите вид", bonTrialOptions(form.elements.group.value, child, value));
        select.value = value;
      }
    }
    previewBonitation();
  });
  form.elements.show.addEventListener("change", () => {
    if (form.elements.date.value) return;
    const title = bonNameKey(form.elements.show.value);
    const dates = new Set(records.flatMap((dog) => dog.bonitations.filter((entry) => bonNameKey(entry.show) === title).map((entry) => entry.date)));
    if (dates.size === 1) form.elements.date.value = [...dates][0];
    previewBonitation();
  });
  form.addEventListener("input", previewBonitation);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const data = bonReadForm();
      validateBonitation(data);
      saveBonitations((items) => {
        if (items.some((entry) => entry.id !== data.id && bonShowKey(entry) === bonShowKey(data))) {
          throw new Error("Для этой выставки уже есть расчёт. Откройте его из карточки.");
        }
        data.id ||= newRecordId();
        return bonSession.original ? items.map((entry) => entry.id === data.id ? data : entry) : [...items, data];
      });
      dialog.close();
      byId("status").textContent = "Расчёт бонитировки сохранён.";
    } catch (error) { showBonError(error); }
  });
}

function saveBonitations(update) {
  const { dog, original } = bonSession;
  const current = records.find((item) => item.id === dog.id);
  if (!current) throw new Error("Карточка больше не найдена в реестре.");
  if (original && !current.bonitations.includes(original)) throw new Error("Расчёт изменился в другой вкладке. Откройте его заново.");
  const bonitations = update(current.bonitations);
  saveRecords(records.map((item) => item.id === dog.id ? { ...item, bonitations } : item));
}

function showBonError(error) {
  const field = byId("bon-error");
  field.textContent = error.message;
  field.hidden = false;
  field.scrollIntoView({ block: "nearest" });
}
