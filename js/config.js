const APP = {
  name: "Сокровища королевы",
  shortName: "Сокровища",
  tagline: "Доход · долги · свадьба",
  ownerDefault: "Снежа",
  planStart: "2026-09-01",
  planEnd: "2027-08-31",
  weddingMonth: "2027-08-01",
  expenseLimit: 110000,
  incomeTargetStable: 180000,
  weddingMin: 200000,
  weddingGoal: 250000,
  weddingSeed: 2000,
  debtStartTotal: 452000,
  minimaTotal: 28000,
};

const INCOME_FORMATS = [
  { id: "individual", label: "Индивидуальный", hint: "2 000 ₽ / час", defaultAmount: 2000, hoursPerUnit: 1, hourly: 2000 },
  { id: "group5500", label: "Абонемент 5 500", hint: "5 учеников · 27 500 ₽ · 16 ч", defaultAmount: 5500, hoursPerUnit: 3.2, hourly: 1719 },
  { id: "group5000", label: "Абонемент 5 000", hint: "7 учеников · 35 000 ₽ · 8 ч", defaultAmount: 5000, hoursPerUnit: 1.14, hourly: 4375 },
  { id: "other", label: "Другое", hint: "разовые и нерегулярные оплаты", defaultAmount: 0, hoursPerUnit: 0, hourly: 0 },
];

const EXPENSE_CATEGORIES = [
  { id: "housing", label: "Жильё + коммунальные", limit: 45000, required: true },
  { id: "food", label: "Еда", limit: 20000, required: true },
  { id: "hall", label: "Аренда зала", limit: 35000, required: true },
  { id: "transport", label: "Транспорт", limit: 5000, required: true },
  { id: "extra", label: "Дополнительно", limit: 5000, required: false },
];

const DEBT_SEED = [
  { id: "card3", name: "Карта 3", start: 18000, rate: 0.36, min: 1500, priority: 1 },
  { id: "card1", name: "Карта 1", start: 205000, rate: 0.36, min: 12000, priority: 2 },
  { id: "card2", name: "Карта 2", start: 200000, rate: 0.28, min: 10000, priority: 3 },
  { id: "loan", name: "Кредит", start: 29000, rate: 0.18, min: 4500, priority: 4 },
];

const MONTHS = [
  { id: "2026-09", label: "Сентябрь 2026", short: "Сен", income: 140000, expenses: 110000, debts: 30000, wedding: 0, task: "Стабилизировать доход и не наращивать долг." },
  { id: "2026-10", label: "Октябрь 2026", short: "Окт", income: 150000, expenses: 110000, debts: 40000, wedding: 0, task: "Поднять доход до 150 тыс. и удержать расходы." },
  { id: "2026-11", label: "Ноябрь 2026", short: "Ноя", income: 160000, expenses: 110000, debts: 50000, wedding: 0, task: "Цель 160 тыс.; ускорить карту 3 и карту 1." },
  { id: "2026-12", label: "Декабрь 2026", short: "Дек", income: 170000, expenses: 110000, debts: 60000, wedding: 0, task: "Цель 170 тыс.; максимальный платёж дорогим долгам." },
  { id: "2027-01", label: "Январь 2027", short: "Янв", income: 180000, expenses: 110000, debts: 70000, wedding: 0, task: "Выйти на 180 тыс.; агрессивное погашение." },
  { id: "2027-02", label: "Февраль 2027", short: "Фев", income: 180000, expenses: 110000, debts: 70000, wedding: 0, task: "Удерживать 180 тыс.; долг вниз." },
  { id: "2027-03", label: "Март 2027", short: "Мар", income: 180000, expenses: 110000, debts: 70000, wedding: 0, task: "Удерживать 180 тыс.; долг вниз." },
  { id: "2027-04", label: "Апрель 2027", short: "Апр", income: 180000, expenses: 110000, debts: 45000, wedding: 0, task: "Закрывать последние дорогие долги." },
  { id: "2027-05", label: "Май 2027", short: "Май", income: 180000, expenses: 110000, debts: 45000, wedding: 25000, task: "Цель — 0 ₽ долгов; начать свадебный фонд." },
  { id: "2027-06", label: "Июнь 2027", short: "Июн", income: 180000, expenses: 110000, debts: 0, wedding: 70000, task: "Все бывшие долговые деньги — в свадьбу." },
  { id: "2027-07", label: "Июль 2027", short: "Июл", income: 180000, expenses: 110000, debts: 0, wedding: 70000, task: "Все бывшие долговые деньги — в свадьбу." },
  { id: "2027-08", label: "Август 2027", short: "Авг", income: 180000, expenses: 110000, debts: 0, wedding: 85000, task: "Свадебный фонд 200–250 тыс.; кредитки не трогать." },
];

const CHECKPOINTS = [
  { by: "2026-10", title: "Конец октября", text: "Доход 140–150 тыс.; новые долги не появляются." },
  { by: "2026-12", title: "Конец декабря", text: "Доход 160–170 тыс.; маленькая карта закрыта или почти закрыта." },
  { by: "2027-03", title: "Март", text: "Доход около 180 тыс.; основной объём дорогих кредиток погашен." },
  { by: "2027-05", title: "Май", text: "Цель — выйти на 0 ₽ долгов." },
  { by: "2027-08", title: "Август", text: "Свадебный фонд 200–250 тыс. ₽." },
];

const MONTHLY_RULES = [
  "В день поступления денег сначала резервирую обязательные расходы и минимумы по долгам.",
  "Не использую кредитки для новых покупок.",
  "Каждый дополнительный доход фиксирую: откуда пришёл и сколько ушло в долг.",
  "Не увеличиваю личные расходы вместе с ростом дохода.",
  "Проверяю загрузку зала: каждый дополнительный час должен приносить деньги.",
  "Приоритет роста — группы с высокой выручкой на час, затем индивидуальные.",
  "После закрытия карты её бывший минимум уходит в следующий долг.",
  "После нулевого долга бывшие платежи автоматически идут в свадебный фонд.",
];
