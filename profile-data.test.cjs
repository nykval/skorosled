const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
for (const file of ["bonitation.js", "pedigree.js", "profile-data.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context);
const { ProfileData: P, Pedigree } = vm.runInContext("({ ProfileData, Pedigree })", context);
const trial = (species, degree = "II", type = "single", id = "trial") => ({ id, diploma: degree, type, game_species: [species], start_date: "2023-06-01" });
const dog = { id: "dog", name: "Собака", breed: "Лайка западносибирская", sex: "male", birth: "2020-01-01", regNumber: "123", exterior: "отл." };

test("expands all source exterior abbreviations", () => {
  for (const [short, full] of [["отл.", "Отлично"], ["оч. хор.", "Очень хорошо"], ["хор.", "Хорошо"], ["удовл.", "Удовлетворительно"]]) assert.equal(P.gradeLabel(short), full);
  assert.equal(P.gradeLabel("без оценки"), "без оценки");
});
test("uses breed-specific species and explicit pair formats", () => {
  assert.equal(P.trialDiploma(trial("лось"), "laika").type, "elk");
  assert.equal(P.trialDiploma(trial("заяц-русак"), "borzoi").type, "coursing");
  assert.equal(P.trialDiploma(trial("заяц-русак"), "hound").type, "hare");
  assert.equal(P.trialDiploma(trial("вольерный кабан в паре", "II", "minimal"), "laika").work, "pair");
  assert.equal(P.trialDiploma(trial("лисица в искусственной П-образной норе"), "earth").type, "foxP");
  assert.equal(P.trialDiploma(trial("водоплавающая птица"), "spaniel").type, "waterfowl");
  assert.equal(P.trialDiploma(trial("утка"), "spaniel").type, "spanielDuck");
});
test("does not invent work format or duplicate a multispecies diploma", () => {
  assert.equal(P.trialDiploma(trial("вольерный кабан", "II", "minimal"), "laika"), null);
  assert.equal(P.trialDiploma(trial("лось", "б/д"), "laika"), null);
  assert.equal(P.trialDiploma({ ...trial("лось"), game_species: ["лось", "белка"] }, "laika"), null);
});
test("recalculates hunting points from actual diplomas rather than event rating totals", () => {
  const tree = Pedigree.fromGraph(dog, () => null);
  const exhibition_evals = [{ exterior_type: "отл.", common_exhibition_start_date: "2023-06-01" }];
  const first = P.automatic(dog, { exhibition_evals, competition_evals: [{ ...trial("лось", "II"), rating_total: 81 }] }, tree);
  const second = P.automatic(dog, { exhibition_evals, competition_evals: [{ ...trial("лось", "I"), rating_total: 93 }] }, tree);
  assert.equal(first.work.points, 35);
  assert.equal(second.work.points, 40);
  assert.equal(second.total - first.total, 5);
  assert.equal(first.result.gradePoints, 40);
});
test("halves the main points for a paired boar diploma", () => {
  const result = P.automatic(dog, { competition_evals: [trial("вольерный кабан в паре", "II", "minimal")] }, Pedigree.fromGraph(dog, () => null));
  assert.equal(result.work.main.points, 18);
});
test("ignores incomplete diploma information and shows missing data", () => {
  const result = P.automatic({ ...dog, exterior: "" }, { competition_evals: [trial("белка", "I", "minimal")] }, null);
  assert.equal(result.work, null);
  assert.equal(result.skipped, 1);
  assert.equal(result.result.qualified, null);
  assert.ok(result.missing.length >= 3);
});
test("does not award parent exterior bonus for a satisfactory grade", () => {
  const father = { id: "father" }, mother = { id: "mother" };
  const root = { ...dog, fatherId: "father", motherId: "mother" };
  const tree = Pedigree.fromGraph(root, (id) => ({ father, mother })[id]);
  const relatives = [{ dog: father, events: { exhibition_evals: [{ exterior_type: "удовл." }] } }, { dog: mother, events: {} }];
  const result = P.automatic(root, {}, tree, relatives);
  assert.equal(result.result.origin, 2);
});
test("keeps event metadata after copy and JSON reload", () => {
  const events = P.cleanEvents({ exhibition_evals: [{ exterior_type: "оч. хор.", common_exhibition_start_date: "2022-04-03" }], competition_evals: [trial("лось")] });
  const restored = P.cleanEvents(JSON.parse(JSON.stringify(events)));
  assert.equal(restored.competition_evals[0].game_species[0], "лось");
  assert.equal(restored.exhibition_evals[0].exterior_type, "оч. хор.");
  assert.equal(P.cleanEvents(null), null);
});
test("does not count a duplicate source evaluation as a repeat diploma", () => {
  const evaluation = trial("лось");
  const result = P.automatic(dog, { competition_evals: [evaluation, evaluation] }, null);
  assert.equal(result.diplomaCount, 1);
  assert.equal(result.work.points, 35);
});
test("excludes offspring born after the assessment date", () => {
  const events = { competition_evals: [trial("лось")] };
  const relative = { child: true, dog: { id: "child", name: "Поздний потомок", birth: "2024-01-01", exterior: "отл." },
    events: { competition_evals: [trial("лось", "I")], exhibition_evals: [{ exterior_type: "отл.", common_exhibition_start_date: "2023-06-01" }] } };
  assert.equal(P.automatic(dog, events, null, [relative]).result.offspringPoints, 0);
});
test("keeps descendant links when a copied card is reloaded", () => {
  const snapshot = P.cleanChildren([{ id: 42, name: "Потомок", fatherId: 1, regNumber: "345" }]);
  const restored = P.cleanChildren(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(restored[0].id, "42");
  assert.equal(restored[0].fatherId, "1");
  assert.equal(restored[0].live, true);
  assert.equal(P.cleanChildren(undefined), null);
  assert.equal(P.cleanChildren([]).length, 0);
});
