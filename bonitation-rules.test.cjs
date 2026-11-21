const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ctx = vm.createContext({});
for (const name of ["bonitation.js", "pedigree.js", "profile-data.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, name), "utf8"), ctx);
const { B, P, Pedigree } = vm.runInContext("({B: Bonitation, P: ProfileData, Pedigree})", ctx);
const dog = { id: "dog", name: "Собака", breed: "Лайка западносибирская", sex: "male", birth: "2020-01-01", regNumber: "123" };
const diploma = (type, degree = 1, work = "solo", date = "2023-01-01") => ({ type, degree, work, date });
const input = (extra = {}) => ({ group: "laika", grade: "excellent", date: "2024-06-01", documents: "rors", nationalBook: "", pairs: [1, 2, 4, 8], parents: [true, true, true, true], diplomas: [], offspring: [], ...extra });
const children = Array.from({ length: 3 }, (_, i) => ({ ...diploma("elk"), name: "Потомок " + i, grade: "excellent" }));
test("laika exterior grades give 40, 30 and 20 points", () => {
  for (const [grade, points] of [["excellent", 40], ["veryGood", 30], ["good", 20]]) assert.equal(B.calculate(input({ grade }), dog).gradePoints, points);
});
test("full ancestry gives at most 20 points and an incomplete pair is excluded", () => {
  assert.equal(B.calculate(input(), dog).origin, 20);
  const root = { ...dog, fatherId: "father" };
  const lookup = new Map([["father", { id: "father" }]]);
  const pairs = B.pedigreeFromRegistry(root, lookup);
  assert.equal(B.calculate(input({ pairs }), root).origin, 0);
});
test("laika versatility is limited to four trial groups", () => {
  const diplomas = ["elk", "wildBoar", "squirrel", "marten", "forestLaika", "pheasant", "penBoar", "bear", "blood"].map((type) => diploma(type));
  const result = B.calculate(input({ diplomas, offspring: children }), dog);
  assert.equal(result.qualified.index, 0);
  assert.equal(result.qualified.work.versatility.length, 4);
  assert.ok(result.qualified.work.points <= 62);
});
test("only captive badger diplomas cannot give first class or elite", () => {
  const result = B.calculate(input({ diplomas: [diploma("penBadger")], offspring: children }), dog);
  assert.equal(result.qualified.index, 2);
});
test("only captive boar diplomas cannot give elite", () => {
  const result = B.calculate(input({ diplomas: [diploma("penBoar"), diploma("penBoar", 2)], offspring: children }), dog);
  assert.equal(result.qualified.index, 1);
});
test("elite needs two solo diplomas and cannot use blood tracking as its required second diploma", () => {
  const valid = B.calculate(input({ diplomas: [diploma("elk", 2), diploma("penBoar", 2)], offspring: children }), dog);
  assert.equal(valid.qualified.index, 0);
  for (const second of [diploma("penBoar", 2, "pair"), diploma("blood")]) {
    const result = B.calculate(input({ diplomas: [diploma("elk", 2), second], offspring: children }), dog);
    assert.notEqual(result.qualified?.index, 0);
  }
});
test("offspring points count six best direct solo-qualified descendants", () => {
  const offspring = Array.from({ length: 8 }, (_, i) => ({ ...diploma("elk"), name: "Потомок " + i, grade: "excellent" }));
  const result = B.calculate(input({ offspring: [...offspring, { ...offspring[0], work: "pair", name: "В паре" }] }), dog);
  assert.equal(result.offspring.length, 6);
  assert.equal(result.offspringPoints, 36);
});
test("future offspring diplomas are excluded from a historical assessment", () => {
  const result = B.calculate(input({ offspring: [{ ...children[0], date: "2025-01-01" }] }), dog);
  assert.equal(result.offspringPoints, 0);
});
test("automatic assessment uses the actual latest exhibition grade, not the best historical grade", () => {
  const result = P.automatic({ ...dog, exterior: "отл." }, { exhibition_evals: [
    { exterior_type: "отл.", common_exhibition_start_date: "2022-01-01" },
    { exterior_type: "хор.", common_exhibition_start_date: "2024-01-01" }
  ], competition_evals: [{ id: 1, diploma: "I", type: "single", game_species: ["лось"], start_date: "2023-01-01" }] }, null);
  assert.equal(result.input.date, "2024-01-01");
  assert.equal(result.input.grade, "good");
  assert.equal(result.result.gradePoints, 20);
});
test("a best-grade label alone does not replace a grade from a specific exhibition", () => {
  const result = P.automatic({ ...dog, exterior: "отл." }, {}, null);
  assert.equal(result.input.grade, "");
  assert.equal(result.result.gradePoints, 0);
});
test("an ungraded latest exhibition cannot inherit an older excellent grade", () => {
  const result = P.automatic({ ...dog, exterior: "отл." }, { exhibition_evals: [
    { exterior_type: "отл.", common_exhibition_start_date: "2022-01-01" },
    { exterior_type: "без оценки", common_exhibition_start_date: "2024-01-01" }
  ] }, null);
  assert.equal(result.input.grade, "");
  assert.equal(result.result.gradePoints, 0);
});
test("parent diploma bonus does not require the work-format detail needed for the dog's own working score", () => {
  const root = { ...dog, fatherId: "father", motherId: "mother" };
  const lookup = new Map([["father", { id: "father" }], ["mother", { id: "mother" }]]);
  const tree = Pedigree.fromGraph(root, (id) => lookup.get(id));
  const relatives = [{ dog: lookup.get("father"), events: { competition_evals: [{ diploma: "II", type: "minimal" }] } }];
  assert.equal(P.automatic(root, {}, tree, relatives).result.origin, 4);
});
test("all nine combinations of offspring exterior and diploma grades give 2 to 6 points", () => {
  for (const [grade, exterior] of [["excellent", 3], ["veryGood", 2], ["good", 1]]) {
    for (const [degree, work] of [[1, 3], [2, 2], [3, 1]]) {
      const result = B.calculate(input({ offspring: [{ ...diploma("elk", degree), name: "Потомок", grade }] }), dog);
      assert.equal(result.offspringPoints, exterior + work);
    }
  }
});
test("laika offspring may qualify on solo captive bear and boar diplomas", () => {
  for (const group of ["laika", "eastLaika"]) for (const type of ["bear", "penBoar"]) {
    const result = B.calculate(input({ group, offspring: [{ ...diploma(type), name: "Потомок", grade: "excellent" }] }), dog);
    assert.equal(result.offspringPoints, 6);
  }
});
test("offspring cannot qualify on a paired diploma or the three excluded trial types", () => {
  const invalid = [diploma("elk", 1, "pair"), diploma("bear", 1, "pair"), diploma("penBoar", 1, "pair"),
    diploma("waterfowl"), diploma("penBadger"), diploma("blood")];
  for (const trial of invalid) {
    const result = B.calculate(input({ offspring: [{ ...trial, name: "Потомок", grade: "excellent" }] }), dog);
    assert.equal(result.offspringPoints, 0);
  }
});
test("automatic offspring scoring selects a valid solo diploma even when a paired diploma has a higher degree", () => {
  const own = { exhibition_evals: [{ exterior_type: "отл.", common_exhibition_start_date: "2024-06-01" }] };
  const child = { child: true, dog: { id: "child", name: "Потомок", birth: "2021-01-01" }, events: {
    exhibition_evals: [{ exterior_type: "отл.", common_exhibition_start_date: "2023-01-01" }],
    competition_evals: [
      { diploma: "I", type: "single", game_species: ["вольерный кабан в паре"], start_date: "2023-01-01" },
      { diploma: "II", type: "single", game_species: ["вольерный кабан"], start_date: "2023-01-01" }
    ]
  } };
  const result = P.automatic(dog, own, null, [child]);
  assert.equal(result.result.offspringPoints, 5);
  assert.equal(result.input.offspring[0].type, "penBoar");
  assert.equal(result.input.offspring[0].work, "solo");
});
