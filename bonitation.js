"use strict";

const Bonitation = (() => {
  const trials = {
    coursing: "Борзые по вольному зверю", wolf: "Борзые «на злобу» по волку",
    hare: "Гончие по зайцу", fox: "Гончие по лисице", jackal: "Гончие по шакалу",
    squirrel: "По белке", marten: "По кунице", sable: "По соболю",
    fur: "По норке, хорю, колонку или горностаю",
    forestLaika: "По боровой дичи", pheasant: "По фазану",
    elk: "По лосю или оленям", wildBoar: "По вольному кабану",
    bear: "По подсадному медведю", penBoar: "По вольерному кабану",
    waterfowl: "По водоплавающей птице", penBadger: "По вольерному барсуку", blood: "По кровяному следу",
    foxEight: "По лисице в норе-восьмёрке (л/8)", foxNatural: "По лисице в естественной норе (л/е)",
    foxP: "По лисице в П-образной норе (л/п)", badgerNatural: "По барсуку в естественной норе (б/е)",
    badgerP: "По барсуку в П-образной норе (б/н)",
    pointingField: "Легавые по болотной или полевой дичи", pointingForest: "Легавые по боровой дичи",
    spanielField: "Спаниели по болотно-луговой, полевой или боровой дичи",
    spanielDuck: "Спаниели по утке или лысухе", retrieving: "Ретриверы по розыску и подаче битой дичи",
    retrieverDuck: "Ретриверы по утке"
  };
  const formats = { solo: "В одиночку", pair: "В паре", couple: "В смычке", team: "В своре", pack: "В стае" };
  const grades = { excellent: "Отлично", veryGood: "Очень хорошо", good: "Хорошо", fair: "Удовлетворительно" };
  const gradeValue = { excellent: 3, veryGood: 2, good: 1, fair: 0 };
  const classNames = ["Элита", "Первый класс", "Второй класс", "Третий класс"];
  const degrees = ["", "I", "II", "III"];
  const houndGame = ["hare", "fox", "jackal"];
  const laikaProfiles = ["squirrel", "marten", "sable", "fur", "forestLaika", "pheasant", "elk", "wildBoar"];
  const laikaAdditional = ["bear", "penBoar", "waterfowl", "penBadger", "blood"];
  const laikaVersatilityGroups = [
    ["squirrel", "marten", "sable", "fur"], ["forestLaika", "pheasant"], ["elk", "wildBoar"], laikaAdditional
  ];
  const terrierElite = ["foxEight", "foxNatural", "badgerNatural", "badgerP"];
  const terrierProfiles = [...terrierElite, "foxP"];
  const pointers = ["pointingField", "pointingForest"];
  const spaniels = ["spanielField", "spanielDuck"];
  const retrievers = ["retrieving", "retrieverDuck"];
  const groups = {
    borzoi: { label: "Русские псовые борзые, грейхаунды, уиппеты, салюки", profile: ["coursing"], other: ["wolf"] },
    steppe: { label: "Хортые и южнорусские (степные) борзые", profile: ["coursing"], other: ["wolf"] },
    asian: { label: "Афганские охотничьи борзые, тазы, тайганы", profile: ["coursing"], other: ["wolf"] },
    hound: { label: "Русские, русские пегие и эстонские гончие", profile: houndGame, other: [], hound: true },
    western: { label: "Западные гончие", profile: houndGame, other: ["penBoar", "blood", "waterfowl"], hound: true },
    laika: { label: "Лайки", profile: laikaProfiles, offspringProfile: [...laikaProfiles, "bear", "penBoar"], other: laikaAdditional, versatility: 4, versatilityGroups: laikaVersatilityGroups },
    eastLaika: { label: "Восточносибирские лайки", profile: laikaProfiles, offspringProfile: [...laikaProfiles, "bear", "penBoar"], other: laikaAdditional, versatility: 4, versatilityGroups: laikaVersatilityGroups },
    earth: { label: "Норные", profile: terrierProfiles, other: ["penBoar", "penBadger", "blood", "waterfowl"], versatility: 4 },
    island: { label: "Островные легавые", profile: pointers, other: [] },
    continental: { label: "Континентальные легавые", profile: pointers, other: ["waterfowl", "penBadger", "blood", "penBoar"], versatility: 4 },
    spaniel: { label: "Спаниели (кроме вахтельхундов)", profile: spaniels, other: ["waterfowl"], versatility: 1 },
    wachtel: { label: "Вахтельхунды", profile: spaniels, other: ["blood", "penBoar", "waterfowl"], versatility: 3 },
    retriever: { label: "Ретриверы", profile: retrievers, other: ["waterfowl"], versatility: 1 }
  };

  const match = (types, degree = 3, work = "", extra = () => true) =>
    (diploma, main) => (!types || types.includes(diploma.type)) && diploma.degree <= degree
      && (!work || work.includes(diploma.work)) && extra(diploma, main);
  const profileSolo = (types, degree) => match(types, degree, ["solo"]);
  const coursingSolo = (degree) => profileSolo(["coursing"], degree);
  const course = match(["coursing"]);
  const pairs = ["pair", "couple"];
  const soloGame = (degree) => profileSolo(houndGame, degree);
  const soloHare = (degree) => profileSolo(["hare"], degree);
  const wolfGroup = match(["wolf"], 3, ["pair", "team"]);
  const laikaPair = match(["penBoar", "wildBoar", "bear"], 3, ["pair"]);
  const laikaFirst = [...laikaProfiles, "penBoar", "bear"];
  const top = (types) => [[match(types, 2)], [match(types), match(types)]];
  const borzoiFirst = [[coursingSolo(2)], [coursingSolo(3), course]];
  const borzoiSecond = [[coursingSolo(3)], [profileSolo(["wolf"], 3)]];
  const borzoiThird = [[wolfGroup]];
  const profiles = (types) => [[match(types)]];
  const row = (work, generations, origin, total, requirements, description, children = 0, childPoints = 0) =>
    ({ work, generations, origin, total, requirements, description, children, childPoints });
  const twoCourse = [coursingSolo(2), course];
  const eliteLaika = row(40, 4, 18, [100, 96],
    [[profileSolo(laikaProfiles, 2), profileSolo([...laikaProfiles, "bear", "penBoar", "waterfowl", "penBadger"], 3)]],
    "Два одиночных диплома. Основной — не ниже II по пушному зверю, лосю, оленям, вольному кабану, боровой дичи или фазану.",
    [3, 2], [12, 8]);
  const firstLaika = row(35, 4, 16, 81,
    [[profileSolo(laikaFirst, 2)], [profileSolo(laikaFirst, 3), match([...laikaProfiles, ...laikaAdditional], 3, "",
      (d) => d.type !== "blood" && !(d.type === "bear" && d.work === "pair" && d.degree === 3))]],
    "Одиночный диплом не ниже II по профильному виду, вольерному кабану или подсадному медведю. Для III нужен допустимый повторный диплом.");
  const secondLaika = row(20, 3, 16, 56,
    [[profileSolo([...laikaProfiles, ...laikaAdditional.filter((type) => type !== "blood")])], [laikaPair, laikaPair]],
    "Одиночный диплом, кроме кровяного следа, или два диплома III в паре по кабану или подсадному медведю.");
  const thirdLaika = row(15, 0, 8, 43, [[laikaPair], [match(["blood"])]],
    "Диплом III в паре по кабану или подсадному медведю либо диплом любой степени по кровяному следу.");
  const retrieverElite = (repeatTypes) => [[match(retrievers, 1), match(repeatTypes)],
    [match(retrievers, 2), match(retrievers, 2)]];
  const spanielRows = (other) => [
    row(43, 4, 18, [99, 95], [[match(spaniels, 1), match(spaniels)], [match(spaniels, 2), match(spaniels, 2)]],
      "I и ещё один профильный диплом или два профильных диплома не ниже II.", [2, 1], [8, 4]),
    row(36, 4, 16, 82, [[match(spaniels, 2), match(spaniels)],
      [match(spaniels), match(spaniels, 3, "", (d, main) => d.type !== main.type)],
      [match(spaniels, 2), match(other, 2)]],
      "II и ещё один профильный диплом, два III по разным профильным видам либо II профильный и II непрофильный."),
    row(30, 4, 16, 66, profiles(spaniels), "Профильный диплом не ниже III."),
    row(15, 4, 16, 51, profiles(other), "Непрофильный диплом любой степени.")
  ];

  // Appendix 1 gives both diploma combinations and numeric minima for every row.
  const classes = {
    borzoi: [
      row(40, 4, 18, [100, 96], [[coursingSolo(1)], twoCourse], "Одиночный профильный I или одиночный II и повторный профильный.", [3, 2], [12, 8]),
      row(35, 4, 16, 81, borzoiFirst, "Одиночный профильный II или два профильных III, из них один одиночный."),
      row(30, 4, 16, 66, borzoiSecond, "Одиночный профильный III или одиночный непрофильный диплом."),
      row(15, 3, 14, 49, borzoiThird, "Непрофильный диплом III в паре или своре.")
    ],
    steppe: [
      row(40, 2, 12, [94, 90], [[coursingSolo(1)], twoCourse], "Одиночный профильный I или одиночный II и повторный профильный.", [3, 2], [12, 8]),
      row(35, 2, 10, 75, borzoiFirst, "Одиночный профильный II или два профильных III, из них один одиночный."),
      row(30, 1, 6, 56, borzoiSecond, "Одиночный профильный III или одиночный непрофильный диплом."),
      row(15, 1, 6, 41, borzoiThird, "Непрофильный диплом III в паре или своре.")
    ],
    asian: [
      row(40, 2, 12, [94, 90], [twoCourse], "Одиночный профильный II и повторный профильный диплом.", [3, 2], [12, 8]),
      row(35, 2, 10, 75, borzoiFirst, "Одиночный профильный II или два профильных III, из них один одиночный."),
      row(30, 1, 6, 56, borzoiSecond, "Одиночный профильный III или одиночный непрофильный диплом."),
      row(15, 1, 4, 39, borzoiThird, "Непрофильный диплом III в паре или своре.")
    ],
    hound: [
      row(40, 4, 18, [93, 90], [[soloHare(2), profileSolo(["fox", "jackal"])]],
        "Два одиночных диплома. Основной — не ниже II по зайцу, повторный — по лисице или шакалу.", [3, 2], [10, 7]),
      row(35, 4, 18, 78, [[soloHare(2)], [soloHare(3), soloGame(3)]],
        "Одиночный диплом II по зайцу или два одиночных III, основной — по зайцу."),
      row(30, 4, 16, 66, [[soloGame(3)]], "Одиночный диплом по зайцу, лисице или шакалу."),
      row(15, 4, 16, 51, [[match(houndGame, 3, ["couple"])]], "Диплом любой степени в смычке.")
    ],
    western: [
      row(40, 4, 18, [93, 90], [[profileSolo(["penBoar"], 2), profileSolo(["hare", "blood"])]],
        "Два одиночных диплома. Основной — II по вольерному кабану, повторный — по зайцу или кровяному следу.", [3, 2], [10, 7]),
      row(35, 4, 18, 78, [[profileSolo(["penBoar"], 2)], [profileSolo(["penBoar"]), match(["hare", "penBoar", "blood"], 3, pairs)]],
        "Одиночный II по вольерному кабану либо одиночный III по нему и ещё III в смычке или паре по зайцу, кабану или следу."),
      row(20, 4, 16, 56, [[profileSolo(["penBoar", "hare"])],
        [match(["hare", "penBoar"], 3, pairs), match(["hare", "penBoar"], 3, pairs)], [match(["waterfowl", "blood"], 2)]],
        "Одиночный III по вольерному кабану или зайцу, два III в смычке или паре по ним либо II по птице или кровяному следу."),
      row(15, 4, 16, 51, [[match(["hare", "penBoar"], 3, pairs)], [match(["waterfowl", "blood"])]],
        "III в смычке или паре по зайцу или вольерному кабану либо III по птице или кровяному следу.")
    ],
    laika: [eliteLaika, firstLaika, secondLaika, thirdLaika],
    eastLaika: [
      { ...eliteLaika, generations: 2, origin: 10, total: [92, 88] },
      { ...firstLaika, generations: 2, origin: 8, total: 73 },
      { ...secondLaika, generations: 2 }, { ...thirdLaika, generations: 2 }
    ],
    earth: [
      row(43, 4, 18, [99, 95], [[match(terrierElite, 2), match(terrierElite, 2)]],
        "Два диплома не ниже II по норному зверю (л/8, л/е, б/е, б/н).", [2, 1], [8, 4]),
      row(35, 4, 16, 81, top(terrierProfiles), "Один II или два III по норному зверю (л/8, л/е, б/е, б/н, л/п)."),
      row(30, 4, 16, 66, profiles(terrierProfiles), "Диплом не ниже III по норному зверю."),
      row(15, 4, 16, 51, [[match(["penBoar"], 3, ["solo", "pair"])], [match(["penBadger", "blood", "waterfowl"])]],
        "Диплом по вольерному кабану в одиночку или паре, вольерному барсуку, кровяному следу или водоплавающей птице.")
    ],
    island: [
      row(40, 4, 18, [96, 92], [[match(pointers, 2), match(pointers)]], "Два профильных диплома, один не ниже II.", [2, 1], [8, 4]),
      row(35, 4, 16, 81, top(pointers), "Один II или два III по профильным видам."),
      row(30, 4, 16, 66, profiles(pointers), "Профильный диплом не ниже III.")
    ],
    continental: [
      row(40, 4, 18, [96, 92], [[match(pointers, 2), match([...pointers, "waterfowl"])]],
        "Основной профильный диплом не ниже II и повторный по профильному виду или водоплавающей птице.", [2, 1], [8, 4]),
      row(35, 4, 16, 81, [[match(pointers, 2)], [match(pointers), match([...pointers, "waterfowl", "penBoar", "blood"])]],
        "Основной профильный II либо профильный III и повторный по профильному виду, птице, кабану или кровяному следу."),
      row(30, 4, 16, 66, profiles(pointers), "Профильный диплом не ниже III."),
      row(15, 4, 16, 51, [[match(["penBoar"], 3, ["solo", "pair"])], [match(["waterfowl", "blood"])]],
        "Диплом по водоплавающей птице, кровяному следу или вольерному кабану в одиночку или паре.")
    ],
    spaniel: spanielRows(groups.spaniel.other),
    wachtel: spanielRows(groups.wachtel.other),
    retriever: [
      row(40, 4, 18, [96, 92], retrieverElite([...retrievers, "waterfowl"]),
        "Профильный I и повторный диплом либо два профильных II.", [2, 1], [8, 4]),
      row(35, 4, 16, 81, top(retrievers), "Один II или два III по профильным видам."),
      row(30, 4, 16, 66, profiles(retrievers), "Профильный диплом не ниже III."),
      row(30, 4, 16, 51, profiles(groups.retriever.other), "Непрофильный диплом любой степени.")
    ]
  };
  // Resolution No. 45, Appendix 1, item 5, temporarily replaces the retriever class table.
  const temporaryRetrieverClasses = [
    row(43, 4, 16, [97, 93], retrieverElite(retrievers),
      "Профильный I и ещё один профильный диплом либо два профильных II.", [2, 1], [8, 4]),
    { ...classes.retriever[1], origin: 12, total: 77 },
    { ...classes.retriever[2], origin: 12, total: 62 },
    { ...classes.retriever[3], origin: 12, total: 62 }
  ];

  function groupForBreed(breed) {
    const name = breed.toLowerCase().replaceAll("ё", "е");
    const patterns = [
      ["eastLaika", /восточно[ -]?сибирск.*ла[ий]к|ла[ий]к.*восточно[ -]?сибирск/], ["laika", /лайк/],
      ["steppe", /хорт|степн.*борз|борз.*степн/], ["asian", /тазы|тайган|афганск.*борз|борз.*афганск/],
      ["borzoi", /русск.*псов|псов.*борз|грейхаунд|уиппет|салюк/],
      ["hound", /русск.*гонч|эстонск.*гонч|гонч.*(русск|эстонск)/],
      ["western", /бигл|баварск.*гонч|гонч.*(литовск|латвийск|польск|баварск)|(литовск|латвийск|польск).*гонч/],
      ["earth", /такс|ягдтерьер|фокстерьер|джек.рассел|вельштерьер|бордер.терьер/],
      ["island", /сеттер|пойнтер/],
      ["continental", /курцхаар|дратхаар|лангхаар|выжл|веймаранер|эпаньол|мюнстерлендер|легав/],
      ["wachtel", /вахтельхунд/], ["spaniel", /спаниел/], ["retriever", /ретривер|лабрадор/]
    ];
    return patterns.find(([, pattern]) => pattern.test(name))?.[0] || "";
  }

  function mainPoints(diploma, key) {
    const half = (diploma.type === "wolf" && ["pair", "team"].includes(diploma.work))
      || (groups[key].hound && pairs.includes(diploma.work))
      || (["laika", "eastLaika"].includes(key) && ["bear", "wildBoar"].includes(diploma.type) && diploma.work === "pair")
      || (diploma.type === "penBoar" && diploma.work === "pair");
    return (half ? [0, 20, 18, 15] : [0, 40, 35, 30])[diploma.degree];
  }

  function versatilityDiplomas(diplomas, main, key) {
    const limit = groups[key].versatility || 0;
    const trialGroups = groups[key].versatilityGroups;
    const used = new Set();
    const result = [];
    for (const diploma of diplomas) {
      if (result.length === limit) break;
      const { type } = diploma;
      if (type === main.type) continue;
      const slot = trialGroups ? trialGroups.findIndex((list) => list.includes(type)) : type;
      if (slot === -1 || used.has(slot)) continue;
      used.add(slot);
      result.push({ ...diploma, points: 4 - diploma.degree });
    }
    return result;
  }

  function diplomaCombinations(diplomas, requirements, key) {
    const sorted = [...diplomas].sort((a, b) => a.degree - b.degree);
    let best = null;
    for (const [acceptMain, acceptRepeat] of requirements) {
      for (const main of sorted.filter((diploma) => acceptMain(diploma))) {
        const repeat = sorted.find((diploma) => diploma !== main && (!acceptRepeat || acceptRepeat(diploma, main)));
        if (acceptRepeat && !repeat) continue;
        const mainScore = mainPoints(main, key);
        const repeatScore = repeat ? [0, 10, 8, 5][repeat.degree] : 0;
        const versatility = versatilityDiplomas(sorted, main, key);
        const points = mainScore + repeatScore + versatility.reduce((sum, entry) => sum + entry.points, 0);
        if (!best || points > best.points || (points === best.points && mainScore > best.main.points)) {
          best = { points, main: { ...main, points: mainScore }, repeat: repeat && { ...repeat, points: repeatScore }, versatility };
        }
      }
    }
    return best;
  }

  function pedigreeScores(pairs, parents) {
    const origin = pairs.reduce((sum, amount, index) => sum + amount * [2, 2, 1, 0.25][index], 0)
      + (pairs[0] ? parents.filter(Boolean).length * 2 : 0);
    let generations = 0;
    while (generations < 4 && pairs[generations] === 2 ** generations) generations++;
    return { origin, generations };
  }

  function pedigreeFromRegistry(dog, lookup) {
    const pairsFound = [0, 0, 0, 0];
    let generation = [dog];
    for (let index = 0; index < 4; index++) {
      const next = [];
      for (const child of generation) {
        const parents = [lookup.get(child.fatherId), lookup.get(child.motherId)];
        if (parents.every(Boolean)) pairsFound[index]++;
        next.push(...parents.filter(Boolean));
      }
      generation = next;
    }
    return pairsFound;
  }

  function ageGroup(birth, date) {
    if (!birth || !date) return "";
    const [year, month, day] = birth.split("-").map(Number);
    function anniversary(months) {
      const lastDay = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
      return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
    }
    if (date < anniversary(10) || date > anniversary(120)) return "outside";
    if (date < anniversary(18)) return "junior";
    return date < anniversary(36) ? "middle" : "senior";
  }

  function offspringScores(offspring, group, date) {
    // Resolution No. 152 moved П-shaped fox trials into the profile column of Appendix 9.
    return offspring.filter((child) => gradeValue[child.grade] > 0 && child.work === "solo"
      && (group.offspringProfile || group.profile).includes(child.type) && child.degree >= 1 && child.degree <= 3
      && (!date || !child.date || child.date <= date)
      && (child.type !== "foxP" || !date || date >= "2022-02-16"))
      .map((child) => ({ ...child, points: gradeValue[child.grade] + (4 - child.degree) * (group.hound && child.type === "hare" ? 2 : 1) }))
      .sort((a, b) => b.points - a.points).slice(0, 6);
  }

  function calculate(input, dog, grade = input.grade) {
    const group = groups[input.group];
    if (!group) return null;
    const age = ageGroup(dog.birth, input.date);
    const { origin, generations } = pedigreeScores(input.pairs, input.parents);
    const offspring = offspringScores(input.offspring, group, input.date);
    const offspringPoints = offspring.reduce((sum, child) => sum + child.points, 0);
    const gradePoints = (group.hound ? [0, 20, 25, 30] : [0, 20, 30, 40])[gradeValue[grade]] || 0;
    const trialsForGroup = [...group.profile, ...group.other];
    const validDiplomas = input.diplomas.filter((diploma) => diploma.degree >= 1 && diploma.degree <= 3
      && Object.hasOwn(formats, diploma.work) && trialsForGroup.includes(diploma.type));
    const diplomas = validDiplomas.filter((diploma) => !input.date || !diploma.date || diploma.date <= input.date);
    const admission = [];
    if (!diplomas.length) admission.push("Нужен признанный РОРС рабочий диплом.");
    if (!grade) admission.push("Укажите оценку экстерьера на этой выставке.");
    if (grade === "fair") admission.push("Для допуска нужен экстерьер не ниже «хорошо».");
    if (age === "outside") admission.push("Возраст на дату выставки вне диапазона от 10 месяцев до 10 лет.");
    if (age === "junior" && grade === "excellent") admission.push("Максимальная оценка в младшей группе — «очень хорошо».");
    if (input.documents === "fci") admission.push("При наличии только родословной FCI/РКФ доступен экстерьерный ринг.");
    const hasBook = input.documents === "foreign" ? Boolean(input.nationalBook.trim()) : Boolean(dog.regNumber?.trim());
    const sex = dog.sex === "female" ? 1 : 0;
    const min = (value) => Array.isArray(value) ? value[sex] : value;
    const temporaryRetrieverRules = input.group === "retriever" && (!input.date
      || (input.date >= "2023-12-12" && input.date <= "2028-12-31"));
    const rules = temporaryRetrieverRules ? temporaryRetrieverClasses : classes[input.group];
    const candidates = rules.map((rule, index) => {
      const work = diplomaCombinations(diplomas, rule.requirements, input.group);
      const total = origin + gradePoints + offspringPoints + (work?.points || 0);
      const checks = [
        [Boolean(work), rule.description],
        [Boolean(work) && work.points >= rule.work, "Рабочие качества от " + rule.work + " баллов"],
        [(gradeValue[grade] || 0) >= (index < 2 ? 2 : 1), "Экстерьер не ниже «" + (index < 2 ? "очень хорошо" : "хорошо") + "»"],
        [generations >= rule.generations && origin >= rule.origin,
          "Происхождение от " + rule.origin + " баллов" + (rule.generations ? " и полных поколений не менее " + rule.generations : "")],
        [total >= min(rule.total), "Сумма от " + min(rule.total) + " баллов"]
      ];
      if (rule.children) checks.push([offspring.length >= min(rule.children) && offspringPoints >= min(rule.childPoints),
        "Классных потомков не менее " + min(rule.children) + " и баллов за них не менее " + min(rule.childPoints)]);
      if (index < 2) checks.push([hasBook, input.documents === "foreign" ? "Запись в признанной национальной племенной книге" : "Запись в ВПКОС"]);
      return { index, work, total, checks, qualifies: checks.every(([met]) => met) };
    });
    const qualified = admission.length ? null : candidates.find((candidate) => candidate.qualifies) || null;
    return { age, origin, generations, offspring, offspringPoints, gradePoints, candidates, admission, qualified,
      temporaryRetrieverRules, laterDiplomas: validDiplomas.length - diplomas.length };
  }

  function ringStanding(entries, id) {
    const own = entries.find((entry) => entry.id === id);
    if (!own) return null;
    const score = ({ result }) => [result.qualified.total, result.offspringPoints, result.qualified.work.points,
      result.gradePoints, result.origin];
    const ownScore = score(own);
    let ahead = 0;
    let unresolved = 0;
    for (const entry of entries.filter((entry) => entry.id !== id)) {
      const numbers = score(entry);
      const different = numbers.findIndex((value, index) => value !== ownScore[index]);
      if (different >= 0) {
        if (numbers[different] > ownScore[different]) ahead++;
      } else if (entry.ringPlace && own.ringPlace && entry.ringPlace !== own.ringPlace) {
        if (entry.ringPlace < own.ringPlace) ahead++;
      } else {
        unresolved++;
      }
    }
    return { first: ahead + 1, last: ahead + unresolved + 1, count: entries.length };
  }

  return { trials, formats, grades, classNames, degrees, groups, groupForBreed, calculate, pedigreeFromRegistry, ageGroup, ringStanding };
})();
