const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Pedigree = vm.runInNewContext(fs.readFileSync(path.join(__dirname, "pedigree.js"), "utf8") + "\nPedigree;");

test("keeps the same ancestor in both family branches", () => {
  const dogs = new Map([
    ["dog", { id: "dog", fatherId: "father", motherId: "mother" }],
    ["father", { id: "father", fatherId: "shared" }],
    ["mother", { id: "mother", fatherId: "shared" }],
    ["shared", { id: "shared", name: "Общий предок" }]
  ]);
  const tree = Pedigree.fromGraph(dogs.get("dog"), (id) => dogs.get(id));
  assert.equal(tree.father.father.dog.id, "shared");
  assert.equal(tree.mother.father.dog.id, "shared");
  assert.notEqual(tree.father.father, tree.mother.father);
});

test("handles unknown parents without inventing relatives", () => {
  const dog = { id: "dog", fatherId: "missing", motherId: "mother" };
  const tree = Pedigree.fromGraph(dog, (id) => id === "mother" ? { id, name: "Мать" } : null);
  assert.equal(tree.father, null);
  assert.equal(tree.mother.dog.name, "Мать");
  assert.equal(tree.mother.father, null);
});

test("stops following a cyclic parent link", () => {
  const dog = { id: "dog", fatherId: "father" };
  const father = { id: "father", motherId: "dog" };
  const tree = Pedigree.fromGraph(dog, (id) => ({ dog, father })[id]);
  assert.equal(tree.father.mother.dog.id, "dog");
  assert.equal(tree.father.mother.father, null);
});

test("uses nested API relationships even when entities omit parent IDs", () => {
  const known = (id, father = null, mother = null) => ({ known: true, entity: { id }, father, mother });
  const tree = Pedigree.fromApi(known(1, known(2, known(4)), known(3, known(4))), (entity) => ({ id: String(entity.id) }));
  assert.equal(tree.father.dog.id, "2");
  assert.equal(tree.mother.dog.id, "3");
  assert.equal(tree.father.father.dog.id, "4");
  assert.equal(tree.mother.father.dog.id, "4");
});

test("ignores unavailable and invalid API branches", () => {
  const transform = (entity) => ({ id: String(entity.id) });
  assert.equal(Pedigree.fromApi({ known: false, entity: { id: 1 } }, transform), null);
  assert.equal(Pedigree.fromApi({ known: true, entity: {} }, transform), null);
  assert.equal(Pedigree.fromApi(null, transform), null);
});

test("preserves parent names, links and generations through storage and reload", () => {
  const known = (id, name, father = null, mother = null) => ({ known: true, entity: { id, name }, father, mother });
  const tree = Pedigree.fromApi(known(1, "Собака", known(2, "Отец", known(4, "Дед")), known(3, "Мать")),
    (entity) => ({ ...entity, id: String(entity.id), owner: "Не сохраняется в родословной" }));
  const persisted = JSON.parse(JSON.stringify(Pedigree.snapshot(tree)));
  assert.equal(persisted.complete, true);
  assert.equal(persisted.dogs.some((dog) => Object.hasOwn(dog, "owner")), false);
  const restored = Pedigree.fromSnapshot(persisted);
  assert.equal(restored.father.dog.name, "Отец");
  assert.equal(restored.mother.dog.name, "Мать");
  assert.equal(restored.father.father.dog.name, "Дед");
  assert.equal(restored.father.dog.live, true);
  assert.equal(Pedigree.toMap(restored).get("1").fatherId, "2");
});

test("an older personal record without a pedigree is still readable", () => {
  assert.equal(Pedigree.readSnapshot(undefined), null);
  assert.equal(Pedigree.fromSnapshot(null), null);
  assert.equal(Pedigree.readSnapshot({ rootId: "1", dogs: [{ id: "2", name: "Другая собака" }] }), null);
});

test("caps saved pedigrees at six generations", () => {
  const dogs = new Map();
  for (let id = 1; id <= 20; id++) dogs.set(String(id), { id: String(id), name: "Собака " + id, fatherId: String(id + 1) });
  const tree = Pedigree.fromGraph(dogs.get("1"), (id) => dogs.get(id));
  const saved = Pedigree.snapshot(tree);
  assert.equal(saved.dogs.length, 7);
  const restored = Pedigree.fromSnapshot(saved);
  let count = 0;
  for (let branch = restored; branch; branch = branch.father) count++;
  assert.equal(count, 7);
});
