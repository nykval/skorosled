const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function node(tag, value = '', className = '') {
  return { tag, value, className, children: [], append(...items) { this.children.push(...items); },
    get textContent() { return this.value + this.children.map(item => item.textContent).join(''); } };
}
const ctx = vm.createContext({ node, formatDate: date => date });
for (const file of ['bonitation.js', 'bonitation-ui.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), ctx);
const { B, breakdown } = vm.runInContext('({B: Bonitation, breakdown: bonWorkBreakdown})', ctx);
const diploma = (type, degree = 1, work = 'solo') => ({ type, degree, work });
const dog = { breed: 'Лайка западносибирская', sex: 'male', birth: '2020-01-01', regNumber: '123' };
function calculate(group = 'laika', diplomas = [diploma('forestLaika'), diploma('penBoar'), diploma('elk', 2), diploma('pheasant')]) {
  return B.calculate({ group, grade: 'excellent', date: '2024-01-01', documents: 'rors', pairs: [1,2,4,8], parents: [true,true,true,true],
    diplomas, offspring: [] }, dog).candidates.find(candidate => candidate.work).work;
}
test('shows actual main, additional and universal points with four laika groups in order', () => {
  const work = calculate();
  assert.equal(work.points, 58);
  const lines = breakdown(work, B.groups.laika);
  assert.equal(lines.children[0].textContent, 'Основной диплом — I бор. — 40 баллов');
  assert.equal(lines.children[1].textContent, 'Дополнительный диплом — I к. — 10 баллов');
  assert.equal(lines.children[2].value, 'За универсальность — 8 баллов');
  assert.deepEqual(lines.children[2].children[0].children.map(row => row.textContent), [
    '1 группа — 0 баллов', '2 группа — I ф. — 3 балла', '3 группа — II лось — 2 балла', '4 группа — I к. — 3 балла'
  ]);
  assert.match(lines.children[0].title, /По боровой дичи/);
});
test('shows four zero groups and zero additional points when only a main diploma is counted', () => {
  const lines = breakdown(calculate('laika', [diploma('elk')]), B.groups.laika);
  assert.equal(lines.children[1].textContent, 'Дополнительный диплом — 0 баллов');
  assert.equal(lines.children[2].value, 'За универсальность — 0 баллов');
  assert.deepEqual(lines.children[2].children[0].children.map(row => row.textContent),
    ['1 группа — 0 баллов', '2 группа — 0 баллов', '3 группа — 0 баллов', '4 группа — 0 баллов']);
});
test('eastern laikas use the same four universal groups as the score calculation', () => {
  const work = calculate('eastLaika');
  const lines = breakdown(work, B.groups.eastLaika);
  assert.equal(lines.children[2].children[0].children.length, 4);
  assert.match(lines.children[2].children[0].children[3].textContent, /I к\. — 3 балла/);
});
test('keeps paired work visible alongside the actual reduced points', () => {
  const lines = breakdown(calculate('laika', [diploma('penBoar', 1, 'pair')]), B.groups.laika);
  assert.equal(lines.children[0].textContent, 'Основной диплом — I к. в паре — 20 баллов');
});
test('other breeds list their counted universal diplomas without laika group numbers', () => {
  const lines = breakdown(calculate('continental', [diploma('pointingField'), diploma('waterfowl')]), B.groups.continental);
  const groups = lines.children[2].children[0].children;
  assert.equal(groups.length, 1);
  assert.equal(groups[0].textContent, 'Диплом — I вп — 3 балла');
});
test('breeds without universal scoring do not show nonexistent universal groups', () => {
  const lines = breakdown(calculate('borzoi', [diploma('coursing')]), B.groups.borzoi);
  assert.equal(lines.children.length, 2);
  assert.match(lines.children[0].textContent, /I Борзые по вольному зверю — 40 баллов/);
});
