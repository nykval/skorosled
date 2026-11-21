const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function setup(extra = {}) {
  const nodes = new Map();
  const byId = (id) => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, textContent: "", attributes: {}, style: { setProperty() {} },
      setAttribute(name, value) { this.attributes[name] = value; } });
    return nodes.get(id);
  };
  const ctx = vm.createContext({ byId, location: { hash: "#dog=parent" }, records: [], archive: null, liveDetail: null,
    canLoadHostedArchive: false, archiveLoading: false, archiveLoadAttempted: false,
    rorsDog: (entry) => ({ ...entry, id: String(entry.id), rors: true, live: true }), ...extra });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "profile-ui.js"), "utf8"), ctx);
  const api = vm.runInContext("({startProfileLoading, updateProfileLoading, finishProfileLoading, failProfileLoading, loadProfileChildren, profileChildren, renderProfileBlocks, profileChildrenCache})", ctx);
  return { ctx, api, byId };
}
test("keeps the card hidden until loading finishes and progress never runs backwards", () => {
  const { api, byId } = setup();
  const ticket = api.startProfileLoading("Собака");
  assert.equal(byId("profile").hidden, true);
  assert.equal(byId("profile-loading").hidden, false);
  api.updateProfileLoading(ticket, 75); api.updateProfileLoading(ticket, 20);
  assert.equal(byId("profile-loading-percent").textContent, "75%");
  assert.equal(byId("profile").hidden, true);
  api.finishProfileLoading(ticket);
  assert.equal(byId("profile-loading-percent").textContent, "100%");
  assert.equal(byId("profile").hidden, false);
});
test("a stale request cannot reveal a card after navigation", () => {
  const { ctx, api, byId } = setup();
  const old = api.startProfileLoading();
  ctx.location.hash = "#dog=other";
  const current = api.startProfileLoading();
  api.finishProfileLoading(old);
  assert.equal(byId("profile").hidden, true);
  api.finishProfileLoading(current);
  assert.equal(byId("profile").hidden, false);
});
test("failure offers retry and does not expose an empty card as loaded", () => {
  const { api, byId } = setup();
  const ticket = api.startProfileLoading();
  let retried = false;
  api.failProfileLoading(ticket, "Не удалось загрузить потомков", () => { retried = true; });
  assert.equal(byId("profile").hidden, true);
  assert.equal(byId("profile-loading-error").hidden, false);
  assert.equal(byId("profile-loading-retry").hidden, false);
  byId("profile-loading-retry").onclick(); assert.equal(retried, true);
});
test("restores descendants for an older copy with an empty snapshot", async () => {
  let calls = 0;
  const { api } = setup({ rorsGet: async () => { calls++; return { children: [{ id: 42, name: "Потомок" }] }; } });
  const dog = { id: "parent", archiveSourceId: "217310", sourceChildren: [] };
  assert.equal(api.profileChildren(dog).length, 0);
  await api.loadProfileChildren(dog);
  assert.equal(api.profileChildren(dog)[0].name, "Потомок");
  await api.loadProfileChildren(dog);
  assert.equal(calls, 1);
});
test("a malformed response is not cached as an empty offspring list", async () => {
  let response = {};
  const { api } = setup({ rorsGet: async () => response });
  const dog = { id: "parent", archiveSourceId: "217310", sourceChildren: [] };
  await assert.rejects(api.loadProfileChildren(dog), /неизвестном формате/);
  assert.equal(api.profileChildrenCache.has("217310"), false);
  response = { children: [{ id: 42, name: "Потомок" }] };
  await api.loadProfileChildren(dog);
  assert.equal(api.profileChildren(dog).length, 1);
});
test("a new live request does not hide already cached descendants", () => {
  const { api } = setup({ liveDetail: { id: "217310", children: [] } });
  api.profileChildrenCache.set("217310", [{ id: "42", name: "Потомок" }]);
  assert.equal(api.profileChildren({ id: "217310", rors: true, live: true }).length, 1);
});
test("profile preparation waits for descendants before rendering its blocks", async () => {
  let resolve;
  const response = new Promise((done) => { resolve = done; });
  const rendered = [], progress = [];
  const dog = { id: "parent", archiveSourceId: "217310", sourceChildren: [] };
  const { ctx, api } = setup({ rorsGet: () => response, currentDog: () => dog,
    pedigreeForDog: () => null, renderBasic: () => rendered.push("basic"),
    renderEvents: () => rendered.push("events"), renderPedigree: () => rendered.push("pedigree"),
    renderScore: () => rendered.push("score"), readSource: async (entry) => ({ dog: entry, events: {} }) });
  vm.runInContext("renderBasicInformation = renderBasic; renderProfileEvents = renderEvents; renderProfilePedigree = renderPedigree; renderAutomaticBonitation = renderScore; readProfileSource = readSource;", ctx);
  const pending = api.renderProfileBlocks(dog, (value) => progress.push(value));
  assert.deepEqual(rendered, []);
  resolve({ children: [{ id: 42, name: "Потомок" }] });
  await pending;
  assert.ok(rendered.includes("pedigree"));
  assert.ok(rendered.includes("score"));
  assert.equal(progress.at(-1), 1);
});
