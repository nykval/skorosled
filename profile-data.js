"use strict";

const ProfileData = (() => {
  const text = (value) => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : value?.name && typeof value.name === "string" ? value.name.trim() : "";
  const key = (value) => text(value).toLowerCase().replaceAll("ё", "е").replace(/[.\s_-]+/g, " ").trim();
  const date = (value) => text(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
  function grade(value) {
    const name = key(value);
    if (["отл", "отлично", "excellent"].includes(name)) return "excellent";
    if (["оч хор", "очень хорошо", "verygood"].includes(name)) return "veryGood";
    if (["хор", "хорошо", "good"].includes(name)) return "good";
    if (["удовл", "удовлетворительно", "fair"].includes(name)) return "fair";
    return "";
  }
  const gradeLabel = (value) => Bonitation.grades[grade(value)] || text(value) || "Не указана";
  function classLabel(value) {
    const name = key(value);
    if (/^элита$/.test(name)) return "Элита";
    if (/^(первый|1|i)( класс)?$/.test(name)) return "Первый класс";
    if (/^(второй|2|ii)( класс)?$/.test(name)) return "Второй класс";
    if (/^(третий|3|iii)/.test(name)) return "Третий класс";
    return text(value);
  }
  function cleanEvents(source) {
    if (!source || typeof source !== "object") return null;
    const fields = ["id", "common_exhibition_name", "common_exhibition_start_date", "exhibition_start_date", "exterior_type", "tclass", "medal", "title_name", "complex_eval", "competition", "name", "start_date", "diploma", "rule", "type", "rating_total"];
    const result = {};
    for (const field of ["exhibition_evals", "competition_evals"]) {
      if (!Array.isArray(source[field])) continue;
      result[field] = source[field].filter((entry) => entry && typeof entry === "object").slice(0, 5000).map((entry) => {
        const item = {};
        for (const name of fields) if (text(entry[name])) item[name] = text(entry[name]).slice(0, 2000);
        if (Array.isArray(entry.game_species)) item.game_species = entry.game_species.map(text).filter(Boolean).slice(0, 30);
        return item;
      });
    }
    return result;
  }
  function cleanChildren(source) {
    if (!Array.isArray(source)) return null;
    const children = new Map();
    for (const entry of source.slice(0, 5000)) {
      if (!entry || !/^\d+$/.test(text(entry.id)) || !text(entry.name)) continue;
      const dog = { id: text(entry.id), rors: true, live: true };
      for (const field of ["name", "breed", "sex", "birth", "regNumber", "fatherId", "motherId"]) dog[field] = text(entry[field]).slice(0, 500);
      children.set(dog.id, dog);
    }
    return [...children.values()];
  }
  function speciesType(name, group) {
    const value = key(name);
    if (/волк/.test(value)) return "wolf";
    if (["borzoi", "steppe", "asian"].includes(group) && /заяц|лисиц/.test(value)) return "coursing";
    const rules = [
      [/заяц/, "hare"], [/шакал/, "jackal"], [/белк/, "squirrel"], [/куниц/, "marten"], [/собол/, "sable"],
      [/норк|хорь|хоря|колон|горноста/, "fur"], [/лось|лося|олен/, "elk"], [/вольерн.*кабан/, "penBoar"],
      [/вольн.*кабан/, "wildBoar"], [/медвед/, "bear"], [/кровян.*след/, "blood"],
      [/лисиц.*восьмер/, "foxEight"], [/лисиц.*естествен/, "foxNatural"], [/лисиц.*п образ/, "foxP"],
      [/барсук.*естествен/, "badgerNatural"], [/барсук.*п образ/, "badgerP"], [/вольерн.*барсук/, "penBadger"],
      [/розыск.*подач|розыску.*подач/, "retrieving"]
    ];
    const match = rules.find(([pattern]) => pattern.test(value));
    if (match) return match[1];
    if (/лисиц/.test(value)) return "fox";
    if (/утк|лысух/.test(value)) return group === "retriever" ? "retrieverDuck" : ["spaniel", "wachtel"].includes(group) ? "spanielDuck" : "waterfowl";
    if (/водоплавающ/.test(value)) return "waterfowl";
    if (/боров/.test(value)) return ["laika", "eastLaika"].includes(group) ? "forestLaika" : ["spaniel", "wachtel"].includes(group) ? "spanielField" : "pointingForest";
    if (/фазан/.test(value) && ["laika", "eastLaika"].includes(group)) return "pheasant";
    if (/болот|лугов|полев|перепел|куропат|дупел|бекас|фазан|коростел/.test(value)) return ["spaniel", "wachtel"].includes(group) ? "spanielField" : "pointingField";
    return "";
  }
  function trialDiploma(entry, group) {
    const degree = { I: 1, II: 2, III: 3 }[text(entry.diploma).toUpperCase()];
    if (!degree) return null;
    const species = Array.isArray(entry.game_species) ? entry.game_species : [];
    const mapped = species.map((name) => {
      const value = key(name);
      const work = /в паре/.test(value) ? "pair" : /в смычке/.test(value) ? "couple" : /в своре/.test(value) ? "team" : /в стае/.test(value) ? "pack" : entry.type === "single" ? "solo" : "";
      return { type: speciesType(name, group), work };
    });
    // One evaluation is one diploma. Ambiguous species or work formats need clarification.
    if (!mapped.length || mapped.some((item) => !item.type || !item.work || item.type !== mapped[0].type || item.work !== mapped[0].work)) return null;
    const allowed = Bonitation.groups[group];
    if (!allowed || ![...allowed.profile, ...allowed.other].includes(mapped[0].type)) return null;
    return { ...mapped[0], degree, date: date(entry.start_date), reference: text(entry.competition || entry.id) };
  }
  function bestGrade(dog, events) {
    const order = ["excellent", "veryGood", "good", "fair"];
    const grades = [grade(dog.exterior), ...(events?.exhibition_evals || []).map((entry) => grade(entry.exterior_type))];
    return order.find((item) => grades.includes(item)) || "";
  }
  function automatic(dog, events = {}, pedigree, relatives = []) {
    const group = Bonitation.groupForBreed(dog.breed || "");
    if (!group) return { unsupported: true, missing: ["Для этой породы расчёт пока не настроен."] };
    const seen = new Set();
    const rawTrials = (events.competition_evals || []).filter((entry) => {
      const id = text(entry.id);
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
    const diplomas = rawTrials.map((entry) => trialDiploma(entry, group)).filter(Boolean);
    const manual = new Map();
    for (const entry of dog.bonitations || []) for (const item of entry.diplomas || []) {
      const signature = JSON.stringify([item.type, item.degree, item.work, item.date, item.reference]);
      manual.set(signature, item);
    }
    if (!rawTrials.length) diplomas.push(...manual.values());
    const lookup = Pedigree.toMap(pedigree);
    const sourceDog = pedigree?.dog || dog;
    const pairs = Bonitation.pedigreeFromRegistry(lookup.get(sourceDog.id) || sourceDog, lookup);
    const relative = (id) => relatives.find((item) => String(item.dog.id) === String(id));
    const parentData = [pedigree?.father?.dog, pedigree?.mother?.dog].map((parent) => parent && relative(parent.id));
    const parentGrades = parentData.map((parent) => Boolean(parent && ["excellent", "veryGood", "good"].includes(bestGrade(parent.dog, parent.events))));
    const parentDiplomas = parentData.map((parent) => Boolean(parent && (parent.events?.competition_evals || []).some((entry) => trialDiploma(entry, group))));
    const dates = [...(events.exhibition_evals || []).map((entry) => date(entry.common_exhibition_start_date || entry.exhibition_start_date)), ...diplomas.map((entry) => entry.date)].filter(Boolean).sort();
    const assessmentDate = dates.at(-1) || "";
    const offspring = relatives.filter((item) => item.child && (!assessmentDate || !item.dog.birth || item.dog.birth < assessmentDate)).map((item) => {
      const diploma = (item.events?.competition_evals || []).map((entry) => trialDiploma(entry, group))
        .filter((entry) => entry && Bonitation.groups[group].profile.includes(entry.type)
          && (!assessmentDate || entry.date && entry.date <= assessmentDate)).sort((a, b) => a.degree - b.degree)[0];
      const shows = (item.events?.exhibition_evals || []).filter((entry) => !assessmentDate
        || date(entry.common_exhibition_start_date || entry.exhibition_start_date) && date(entry.common_exhibition_start_date || entry.exhibition_start_date) <= assessmentDate);
      return diploma && { ...diploma, name: item.dog.name, grade: bestGrade(assessmentDate ? { ...item.dog, exterior: "" } : item.dog, { exhibition_evals: shows }) };
    }).filter(Boolean);
    const input = { group, grade: bestGrade(dog, events), date: assessmentDate, documents: dog.regNumber ? "rors" : "", nationalBook: "", pairs, parents: [...parentGrades, ...parentDiplomas], diplomas, offspring };
    const result = Bonitation.calculate(input, dog);
    const scored = result.candidates.filter((candidate) => candidate.work).sort((a, b) => b.work.points - a.work.points);
    const current = result.qualified || scored[0];
    const work = current?.work || null;
    const missing = [];
    if (!input.grade) missing.push("Нет оценки экстерьера.");
    if (!diplomas.length) missing.push("Нет дипломов с известными видом испытаний, степенью и форматом работы.");
    if (pairs.some((amount, index) => amount < 2 ** index)) missing.push("Родословная заполнена не полностью.");
    const skipped = rawTrials.filter((entry) => ["I", "II", "III"].includes(text(entry.diploma).toUpperCase()) && !trialDiploma(entry, group)).length;
    if (skipped) missing.push("Дипломы с неполными или неоднозначными сведениями не учтены: " + skipped + ".");
    if (relatives.some((item) => item.partial)) missing.push("Часть результатов родственников не удалось загрузить.");
    if (!input.date || !dog.birth) missing.push("Для возрастной группы нужны дата рождения и дата результата.");
    return { input, result, work, total: (work?.points || 0) + result.gradePoints + result.origin + result.offspringPoints, missing, skipped, diplomaCount: diplomas.length };
  }
  return { text, date, grade, gradeLabel, classLabel, cleanEvents, cleanChildren, trialDiploma, bestGrade, automatic };
})();
