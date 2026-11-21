const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = html.slice(html.indexOf('  function updateCatalogLoading('), html.indexOf('  function sourcePedigreeTree('));
function setup(extra = {}) {
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', style: { setProperty() {} }, setAttribute(key, value) { this[key] = value; } });
    return nodes.get(id);
  };
  const ctx = vm.createContext({ byId, archiveProgress: 0, archiveLoading: true, archive: null, archiveView: true,
    currentDog: () => undefined, liveRoute: () => undefined, setTimeout, clearTimeout, AbortController, File,
    hostedArchivePath: 'data/dogs.ndjson.gz', ...extra });
  vm.runInContext(source, ctx);
  return { ctx, byId };
}
test('catalog loader hides filters until ready and progress never decreases', () => {
  const { ctx, byId } = setup();
  ctx.updateCatalogLoading(60); ctx.updateCatalogLoading(10);
  assert.equal(byId('catalog-loading').hidden, false);
  assert.equal(byId('catalog').hidden, true);
  assert.equal(byId('catalog-loading-percent').textContent, '60%');
  ctx.archiveLoading = false; ctx.updateCatalogLoading(100);
  assert.equal(byId('catalog-loading').hidden, true);
});
test('catalog loading does not cover favorites or a dog opened during download', () => {
  const { ctx, byId } = setup();
  ctx.archiveView = false; ctx.updateCatalogLoading(30);
  assert.equal(byId('catalog-loading').hidden, true);
  ctx.archiveView = true; ctx.liveRoute = () => '217310'; ctx.updateCatalogLoading(40);
  assert.equal(byId('catalog-loading').hidden, true);
});
test('download progress follows received bytes and returns the complete file', async () => {
  const chunks = [new Uint8Array(30), new Uint8Array(70)];
  const { ctx, byId } = setup({ fetch: async () => ({ ok: true, headers: new Headers({ 'Content-Length': '100' }), body: new ReadableStream({ pull(c) { chunks.length ? c.enqueue(chunks.shift()) : c.close(); } }) }) });
  const updates = [];
  const update = ctx.updateCatalogLoading;
  ctx.updateCatalogLoading = value => { updates.push(value); update(value); };
  const file = await ctx.fetchHostedArchive();
  assert.equal(file.size, 100);
  assert.equal(updates[0], 23);
  assert.equal(byId('catalog-loading-percent').textContent, '65%');
});
test('archive processing uses byte progress and failure offers retry without showing an empty catalog', async () => {
  const { ctx, byId } = setup({ indexArchive: async (_file, progress) => { progress(5000, .5); return { dogs: [{}] }; } });
  assert.equal((await ctx.indexArchiveWithProgress({})).dogs.length, 1);
  assert.equal(byId('catalog-loading-percent').textContent, '99%');
  ctx.archiveLoading = false;
  ctx.loadHostedArchive = async () => { throw new Error('Connection failed'); };
  ctx.render = () => {};
  ctx.document = { dispatchEvent() {} }; ctx.Event = Event;
  await ctx.attachArchive();
  assert.equal(ctx.archive, null);
  assert.equal(ctx.archiveLoadError, true);
  assert.equal(byId('archive-retry').hidden, false);
  assert.equal(byId('catalog-loading').hidden, true);
});
