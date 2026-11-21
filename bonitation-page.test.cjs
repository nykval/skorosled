const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function setup() {
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, value: '', textContent: '' });
    return nodes.get(id);
  };
  const ctx = vm.createContext({ URLSearchParams, location: { hash: '' }, document: { title: '' }, byId,
    records: [], archive: null, liveDetail: null, cancelProfileLoading: () => { byId('profile-loading').hidden = true; } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'bonitation-ui.js'), 'utf8'), ctx);
  vm.runInContext(html.slice(html.indexOf('  function currentDog()'), html.indexOf('  function detailRow(')), ctx);
  vm.runInContext(html.slice(html.indexOf('  function render()'), html.indexOf('  function toggleFavorite(')), ctx);
  return { ctx, byId };
}
test('standalone routes retain the original local, archive and live dog card addresses', () => {
  const { ctx } = setup();
  for (const base of ['#dog=copy%2F42', '#rors=217310', '#rors-live=217310']) {
    const hash = ctx.bonitationHash(base, 'show/42?one');
    const route = ctx.bonitationRoute(hash);
    assert.equal(route.returnHash, base);
    assert.equal(route.savedId, 'show/42?one');
    assert.equal(route.createNew, false);
    ctx.location.hash = hash;
    assert.equal(ctx.profileRouteHash(), base);
  }
});
test('new calculations and saved calculations have distinct reloadable URLs', () => {
  const { ctx } = setup();
  const fresh = ctx.bonitationRoute(ctx.bonitationHash('#rors=217310', '', true));
  assert.equal(fresh.createNew, true);
  assert.equal(fresh.savedId, '');
  const saved = ctx.bonitationRoute(ctx.bonitationHash('#rors=217310', 'new'));
  assert.equal(saved.createNew, false);
  assert.equal(saved.savedId, 'new');
});
test('normal dog routes and malformed page suffixes are not mistaken for bonitation pages', () => {
  const { ctx } = setup();
  for (const hash of ['', '#dog=42', '#rors=217310', '#rors=217310/bonitation/unknown', '#unknown=42/bonitation']) {
    assert.equal(ctx.bonitationRoute(hash), null);
    ctx.location.hash = hash;
    assert.equal(ctx.profileRouteHash(), hash);
  }
});
test('profile lookup still finds the right dog on a direct bonitation-page reload', () => {
  const { ctx } = setup();
  const local = { id: 'copy/42', name: 'Локальная' }, archived = { id: '217310' }, live = { id: '42', live: true };
  ctx.records = [local]; ctx.archive = { byId: new Map([['217310', archived]]) }; ctx.liveDetail = { id: '42', dog: live };
  for (const [route, dog] of [['#dog=copy%2F42', local], ['#rors=217310', archived], ['#rors-live=42', live]]) {
    ctx.location.hash = ctx.bonitationHash(route);
    assert.equal(ctx.currentDog(), dog);
  }
});
test('showing the page hides catalog, dog card and loaders without a dialog', () => {
  const { ctx, byId } = setup();
  ctx.session = { dog: { id: 'copy', name: 'Собака' }, returnHash: '#rors=217310' };
  vm.runInContext('bonSession = session', ctx);
  for (const id of ['catalog', 'profile', 'profile-loading', 'catalog-loading']) byId(id).hidden = false;
  ctx.showBonitationPage();
  for (const id of ['catalog', 'profile', 'profile-loading', 'catalog-loading']) assert.equal(byId(id).hidden, true);
  assert.equal(byId('bon-editor').hidden, false);
  assert.match(ctx.document.title, /Бонитировка · Собака/);
});
test('a re-render preserves the unsaved form and browser return destination', () => {
  const { ctx, byId } = setup();
  const route = ctx.bonitationHash('#rors=217310', '', true);
  ctx.location.hash = route; ctx.records = [{ id: 'copy' }];
  ctx.session = { dog: { id: 'copy', name: 'Собака' }, route, returnHash: '#rors=217310' };
  vm.runInContext('bonSession = session', ctx);
  byId('bon-form').value = 'Несохранённый черновик';
  ctx.render();
  assert.equal(byId('bon-form').value, 'Несохранённый черновик');
  assert.equal(byId('bon-editor').hidden, false);
  ctx.returnBonitationPage();
  assert.equal(ctx.location.hash, '#rors=217310');
  assert.equal(byId('bon-form').value, 'Несохранённый черновик');
});
test('saving or deleting a calculation invalidates its editor so reopening reads the saved record', () => {
  const { ctx } = setup();
  ctx.location.hash = ctx.bonitationHash('#rors=217310');
  ctx.session = { dog: { id: 'copy' }, route: ctx.location.hash, returnHash: '#rors=217310' };
  vm.runInContext('bonSession = session', ctx);
  ctx.returnBonitationPage({ invalidate: true });
  assert.equal(ctx.location.hash, '#rors=217310');
  assert.equal(vm.runInContext('bonSession', ctx), null);
});
