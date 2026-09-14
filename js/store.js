const STORE_KEY = "queen-treasures-v1";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState() {
  return {
    version: 1,
    profile: { name: APP.ownerDefault },
    onboardingDone: false,
    incomes: [],
    expenses: [],
    debtPayments: [],
    weddingEntries: [],
    debts: DEBT_SEED.map((d) => ({ ...d, remaining: d.start })),
    creditFreeze: {},
    createdAt: new Date().toISOString(),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      debts: (parsed.debts && parsed.debts.length ? parsed.debts : base.debts).map((d) => {
        const seed = DEBT_SEED.find((s) => s.id === d.id) || d;
        return { ...seed, ...d };
      }),
      weddingEntries: (parsed.weddingEntries || []).map((x) => (
        x && x.id === "seed" ? { ...x, id: "wedding-start" } : x
      )),
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function exportState(state) {
  return JSON.stringify(state, null, 2);
}

function importState(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Неверный файл");
  const next = { ...defaultState(), ...parsed, version: 1 };
  next.weddingEntries = (next.weddingEntries || []).map((x) => (
    x && x.id === "seed" ? { ...x, id: "wedding-start" } : x
  ));
  saveState(next);
  return next;
}
