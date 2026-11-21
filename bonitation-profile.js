"use strict";

let profileBonitationState;

function latestProfileBonitation(dog) {
  return (registryDog(dog)?.bonitations || []).reduce((latest, entry) =>
    !latest || entry.date >= latest.date ? entry : latest, null);
}

function renderProfileBonitation(dog, relatives = [], loading = false) {
  const automatic = ProfileData.automatic(profileDog(dog), profileEvents(dog), pedigreeForDog(dog), relatives);
  const saved = latestProfileBonitation(dog);
  const result = saved ? Bonitation.calculate(saved, saved.dog) : automatic.result;
  const work = saved
    ? (result.qualified || result.candidates.filter((entry) => entry.work).sort((a, b) => b.work.points - a.work.points)[0])?.work
    : automatic.work;
  const total = saved ? (work?.points || 0) + result.gradePoints + result.origin + result.offspringPoints : automatic.total;
  profileBonitationState = { dogId: dog.id, automatic, saved, loading };

  const summary = node("div", undefined, "bon-profile-summary");
  summary.append(node("p", work ? bonPoints(total) : "Недостаточно данных", "bon-auto-total"));
  const classInfo = node("div", undefined, "bon-profile-class");
  classInfo.append(node("span", "Класс", "bon-muted"), node("span",
    result?.qualified && result.age && result.age !== "outside"
      ? Bonitation.classNames[result.qualified.index] : "Пока не определён", "bon-auto-class"));
  summary.append(classInfo);
  const open = node("a", "Открыть бонитировку", "button bon-profile-open");
  open.href = bonitationHash(dogLink(dog).getAttribute("href"));
  byId("bon-auto").replaceChildren(summary, open);
}

function openProfileBonitation(dog, createNew = false, { navigate = true, throwErrors = false } = {}) {
  try {
    const state = profileBonitationState?.dogId === dog.id ? profileBonitationState : null;
    if (state?.loading && !latestProfileBonitation(dog)) {
      notice("Дождитесь загрузки результатов для расчёта бонитировки.");
      return;
    }
    const automatic = state?.automatic || ProfileData.automatic(profileDog(dog), profileEvents(dog), pedigreeForDog(dog));
    let local = registryDog(dog);
    if (!local) {
      const source = profileDog(dog);
      if (!canCopyArchiveDog(source)) {
        notice("Заполните породу и пол в своей карточке, чтобы сохранить бонитировку.");
        return;
      }
      local = archiveDogCopy(source);
      saveRecords([local, ...records]);
    }
    const savedId = bonitationRoute()?.savedId;
    const saved = !createNew && (savedId ? local.bonitations.find((entry) => entry.id === savedId) : latestProfileBonitation(dog));
    if (!createNew && savedId && !saved) throw new Error("Сохранённый расчёт не найден. Вернитесь в карточку собаки.");
    if (saved) { openBonitation(local, saved, undefined, { navigate }); return; }
    const draft = bonInput({
      ...draftBonitation(local), ...automatic.input, dog: profileDog(local),
      show: createNew ? "" : "Текущая бонитировка",
      date: automatic.input?.date || new Date().toLocaleDateString("sv-SE")
    });
    openBonitation(local, undefined, draft, { createNew, navigate });
  } catch (error) {
    if (throwErrors) throw error;
    notice(error.message);
  }
}
