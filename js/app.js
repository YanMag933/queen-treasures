const state = loadState();
let view = "home";
let selectedMonth = currentMonthId();
let sheetTab = "income";
let amountDraft = "";
let selectedFormat = "individual";
let selectedCategory = "food";
let selectedDebt = "auto";
let toastTimer = 0;

function currentMonthId(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO(date = new Date()) {
  const z = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function monthMeta(id = selectedMonth) {
  return MONTHS.find((m) => m.id === id) || MONTHS[0];
}

function inMonth(iso, id = selectedMonth) {
  return String(iso || "").startsWith(id);
}

function money(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toLocaleString("ru-RU")} ₽`;
}

function moneyShort(n) {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} тыс.`;
  return money(v);
}

function parseAmount() {
  if (!amountDraft) return 0;
  return Number(amountDraft.replace(",", ".")) || 0;
}

function incomes(id = selectedMonth) {
  return state.incomes.filter((x) => inMonth(x.date, id));
}

function expenses(id = selectedMonth) {
  return state.expenses.filter((x) => inMonth(x.date, id));
}

function debtPays(id = selectedMonth) {
  return state.debtPayments.filter((x) => inMonth(x.date, id));
}

function weddingPays(id = selectedMonth) {
  return state.weddingEntries.filter((x) => inMonth(x.date, id) && x.id !== "seed");
}

function sum(list, key = "amount") {
  return list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
}

function monthFacts(id = selectedMonth) {
  const plan = monthMeta(id);
  const inc = sum(incomes(id));
  const exp = sum(expenses(id));
  const debt = sum(debtPays(id));
  const wed = sum(weddingPays(id));
  const byCat = {};
  EXPENSE_CATEGORIES.forEach((c) => { byCat[c.id] = 0; });
  expenses(id).forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });
  const byFormat = {};
  INCOME_FORMATS.forEach((f) => { byFormat[f.id] = { amount: 0, hours: 0, count: 0 }; });
  incomes(id).forEach((x) => {
    const f = byFormat[x.format] || (byFormat[x.format] = { amount: 0, hours: 0, count: 0 });
    const fmt = INCOME_FORMATS.find((d) => d.id === x.format);
    const hours = Number(x.hours) || (fmt ? fmt.hoursPerUnit * (Number(x.qty) || 1) : 0);
    f.amount += Number(x.amount) || 0;
    f.hours += hours;
    f.count += Number(x.qty) || 1;
  });
  return { plan, inc, exp, debt, wed, free: inc - exp, byCat, byFormat };
}

function debtRemaining(id) {
  const d = state.debts.find((x) => x.id === id);
  if (!d) return 0;
  const paid = sum(state.debtPayments.filter((p) => p.debtId === id));
  return Math.max(0, (d.start || 0) - paid);
}

function totalDebt() {
  return state.debts.reduce((a, d) => a + debtRemaining(d.id), 0);
}

function weddingTotal() {
  return sum(state.weddingEntries);
}

function priorityDebt() {
  return [...state.debts]
    .filter((d) => debtRemaining(d.id) > 0)
    .sort((a, b) => b.rate - a.rate || a.priority - b.priority)[0] || null;
}

function unpaidMinima(id = selectedMonth) {
  return state.debts.map((d) => {
    const paid = sum(debtPays(id).filter((p) => p.debtId === d.id));
    const rest = debtRemaining(d.id);
    const need = Math.min(d.min, rest);
    return { ...d, paid, need, gap: Math.max(0, need - paid), rest };
  });
}

function allocate(amount, id = selectedMonth) {
  let left = amount;
  const result = [];
  const mins = unpaidMinima(id).filter((d) => d.rest > 0).sort((a, b) => a.priority - b.priority);
  mins.forEach((d) => {
    if (left <= 0) return;
    const take = Math.min(left, d.gap, d.rest);
    if (take > 0) {
      result.push({ debtId: d.id, amount: take });
      left -= take;
      d.rest -= take;
    }
  });
  const target = [...state.debts]
    .map((d) => ({ ...d, rest: result.filter((r) => r.debtId === d.id).reduce((s, r) => s - r.amount, debtRemaining(d.id)) }))
    .filter((d) => d.rest > 0)
    .sort((a, b) => b.rate - a.rate || a.priority - b.priority)[0];
  if (target && left > 0) {
    const take = Math.min(left, target.rest);
    const existing = result.find((r) => r.debtId === target.id);
    if (existing) existing.amount += take;
    else result.push({ debtId: target.id, amount: take });
  }
  return result;
}

function lastLogDate() {
  const dates = [...state.incomes, ...state.expenses, ...state.debtPayments, ...state.weddingEntries]
    .map((x) => x.date)
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] || null;
}

function daysWithoutLog() {
  const last = lastLogDate();
  if (!last) return 99;
  const a = new Date(`${todayISO()}T00:00:00`);
  const b = new Date(`${last}T00:00:00`);
  return Math.max(0, Math.round((a - b) / 86400000));
}

function loggedToday() {
  const t = todayISO();
  return [...state.incomes, ...state.expenses, ...state.debtPayments, ...state.weddingEntries]
    .some((x) => x.date === t && x.id !== "seed");
}

function persist() {
  saveState(state);
}

function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function setView(name) {
  view = name;
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.dataset.view === name));
  document.querySelectorAll(".nav [data-nav]").forEach((el) => el.classList.toggle("active", el.dataset.nav === name));
  render();
}

function openSheet(tab) {
  sheetTab = tab || sheetTab;
  amountDraft = "";
  document.getElementById("entry-date").value = todayISO();
  document.getElementById("entry-note").value = "";
  document.getElementById("entry-source").value = "";
  document.getElementById("entry-qty").value = "1";
  document.getElementById("backdrop").classList.add("show");
  document.getElementById("sheet").classList.add("open");
  renderSheet();
}

function closeSheet() {
  document.getElementById("backdrop").classList.remove("show");
  document.getElementById("sheet").classList.remove("open");
}

function padInput(key) {
  if (key === "⌫") amountDraft = amountDraft.slice(0, -1);
  else if (key === "C") amountDraft = "";
  else if (key === "00") amountDraft = (amountDraft || "") + "00";
  else if (key === "." && amountDraft.includes(".")) return;
  else amountDraft += key;
  if (amountDraft.length > 10) amountDraft = amountDraft.slice(0, 10);
  renderSheetAmount();
}

function renderSheetAmount() {
  const n = parseAmount();
  document.getElementById("amount-value").textContent = n ? money(n) : "0 ₽";
}

function renderSheet() {
  document.querySelectorAll("#sheet-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === sheetTab));
  document.getElementById("income-fields").hidden = sheetTab !== "income";
  document.getElementById("expense-fields").hidden = sheetTab !== "expense";
  document.getElementById("debt-fields").hidden = sheetTab !== "debt";
  const chips = document.getElementById("dynamic-chips");
  if (sheetTab === "income") {
    chips.innerHTML = INCOME_FORMATS.map((f) =>
      `<button class="${selectedFormat === f.id ? "active" : ""}" onclick="chooseFormat('${f.id}')">${f.label}</button>`
    ).join("");
  } else if (sheetTab === "expense") {
    chips.innerHTML = EXPENSE_CATEGORIES.map((c) =>
      `<button class="${selectedCategory === c.id ? "active" : ""}" onclick="chooseCategory('${c.id}')">${c.label}</button>`
    ).join("");
  } else if (sheetTab === "debt") {
    chips.innerHTML = [`<button class="${selectedDebt === "auto" ? "active" : ""}" onclick="chooseDebt('auto')">Авто: минимумы → дорогой</button>`]
      .concat(state.debts.map((d) =>
        `<button class="${selectedDebt === d.id ? "active" : ""}" onclick="chooseDebt('${d.id}')">${d.name}</button>`
      )).join("");
  } else {
    chips.innerHTML = `<span class="chip">Свадебный фонд</span>`;
  }
  renderSheetAmount();
}

function chooseFormat(id) {
  selectedFormat = id;
  const fmt = INCOME_FORMATS.find((f) => f.id === id);
  if (fmt && fmt.defaultAmount && !amountDraft) amountDraft = String(fmt.defaultAmount);
  renderSheet();
}

function chooseCategory(id) {
  selectedCategory = id;
  renderSheet();
}

function chooseDebt(id) {
  selectedDebt = id;
  renderSheet();
}

function submitEntry() {
  const amount = parseAmount();
  if (amount <= 0) return toast("Введите сумму");
  const date = document.getElementById("entry-date").value || todayISO();
  const comment = document.getElementById("entry-note").value.trim();
  if (sheetTab === "income") {
    const qty = Number(document.getElementById("entry-qty").value) || 1;
    const source = document.getElementById("entry-source").value.trim() || INCOME_FORMATS.find((f) => f.id === selectedFormat).label;
    state.incomes.push({ id: uid(), date, source, format: selectedFormat, qty, amount, comment });
    toast("Доход сохранён. Красиво.");
  } else if (sheetTab === "expense") {
    state.expenses.push({ id: uid(), date, category: selectedCategory, amount, comment });
    toast("Расход записан без драмы.");
  } else if (sheetTab === "debt") {
    if (selectedDebt === "auto") {
      allocate(amount, currentMonthId(new Date(date))).forEach((part) => {
        state.debtPayments.push({ id: uid(), date, debtId: part.debtId, amount: part.amount, comment: comment || "Автораспределение" });
      });
    } else {
      state.debtPayments.push({ id: uid(), date, debtId: selectedDebt, amount, comment });
    }
    toast("Платёж ушёл в казну долгов.");
  } else {
    state.weddingEntries.push({ id: uid(), date, amount, comment });
    toast("Фонд свадьбы пополнился.");
  }
  persist();
  closeSheet();
  render();
}

function coachContext() {
  const facts = monthFacts(currentMonthId());
  const extra = facts.byCat.extra || 0;
  return {
    now: new Date(),
    loggedToday: loggedToday(),
    daysWithoutLog: daysWithoutLog(),
    incomeProgress: facts.plan.income ? facts.inc / facts.plan.income : 0,
    expenseProgress: facts.plan.expenses ? facts.exp / facts.plan.expenses : 0,
    extraOver: extra > 5000,
    debtPaidMonth: facts.debt,
    monthPlan: facts.plan,
    dayOfMonth: new Date().getDate(),
  };
}

function recentOps(limit = 8) {
  const rows = [
    ...state.incomes.map((x) => ({ ...x, kind: "income", title: x.source, hint: INCOME_FORMATS.find((f) => f.id === x.format)?.label || "" })),
    ...state.expenses.map((x) => ({ ...x, kind: "expense", title: EXPENSE_CATEGORIES.find((c) => c.id === x.category)?.label || x.category, hint: "расход" })),
    ...state.debtPayments.map((x) => ({ ...x, kind: "debt", title: state.debts.find((d) => d.id === x.debtId)?.name || "Долг", hint: "платёж по долгу" })),
    ...state.weddingEntries.filter((x) => x.id !== "seed").map((x) => ({ ...x, kind: "wedding", title: "Свадебный фонд", hint: x.comment || "пополнение" })),
  ].sort((a, b) => String(b.date).localeCompare(a.date) || String(b.id).localeCompare(a.id));
  return rows.slice(0, limit);
}

function renderCoach() {
  const coach = buildCoach(coachContext());
  const coachEl = document.getElementById("coach");
  coachEl.className = `coach ${coach.tone}`;
  coachEl.innerHTML = `
    <div class="coach-kicker">${coach.tone === "praise" ? "Мягкий комплимент дня" : coach.tone === "nudge" ? "Тихий ориентир" : "Слово дня"} · ${coach.dayKey}</div>
    <h2>${coach.title}</h2>
    <p>${coach.body}</p>
    <small>${coach.footnote}</small>`;
}

function renderHome() {
  const facts = monthFacts(currentMonthId());
  const daysToWedding = Math.max(0, Math.ceil((new Date(APP.weddingMonth) - new Date()) / 86400000));
  const p = Math.min(100, Math.round((facts.inc / facts.plan.income) * 100));
  document.getElementById("hero").innerHTML = `
    <div class="kicker">${facts.plan.label} · цель дохода ${money(facts.plan.income)}</div>
    <div class="amount">${money(facts.inc)}</div>
    <div class="sub">Факт дохода · до месяца свадьбы примерно ${daysToWedding} дн.</div>
    <div class="progress"><span style="width:${p}%"></span></div>
    <div class="sub" style="margin-top:8px">${p}% плана · свободные ${money(facts.free)} · в долги план ${money(facts.plan.debts)}</div>`;

  document.getElementById("home-stats").innerHTML = `
    <div class="stat ${facts.exp <= facts.plan.expenses ? "good" : "warn"}"><div class="label">Расходы</div><div class="value">${moneyShort(facts.exp)}</div><div class="label">из ${moneyShort(facts.plan.expenses)}</div></div>
    <div class="stat"><div class="label">В долги</div><div class="value">${moneyShort(facts.debt)}</div><div class="label">план ${moneyShort(facts.plan.debts)}</div></div>
    <div class="stat good"><div class="label">Свадьба</div><div class="value">${moneyShort(weddingTotal())}</div><div class="label">из ${moneyShort(APP.weddingGoal)}</div></div>`;

  const pri = priorityDebt();
  document.getElementById("home-goals").innerHTML = `
    <div class="card"><div class="label">Долги сейчас</div><div class="metric">${money(totalDebt())}</div><div class="label">старт ${money(APP.debtStartTotal)} · приоритет: ${pri ? pri.name + " " + Math.round(pri.rate * 100) + "%" : "всё закрыто"}</div></div>
    <div class="card"><div class="label">Задача месяца</div><div class="metric" style="font-size:18px;line-height:1.15">${facts.plan.task}</div></div>`;

  const ops = recentOps(6);
  document.getElementById("home-ops").innerHTML = ops.length ? ops.map((x) => `
    <div class="row">
      <div class="dot ${x.kind}"></div>
      <div class="meta"><b>${x.title}</b><span>${x.date} · ${x.hint}</span></div>
      <div class="sum ${x.kind === "expense" || x.kind === "debt" ? "minus" : ""}">${x.kind === "expense" || x.kind === "debt" ? "−" : "+"}${money(x.amount)}</div>
    </div>`).join("") : `<div class="empty">Пока тихо. Нажми корону «+» и сделай первую запись дня.</div>`;
}

function drawBars(canvas, items) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * 2;
  const h = canvas.height = 220;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...items.map((i) => Math.max(i.plan, i.fact, 1)));
  const gap = 16;
  const barW = (w - gap * (items.length + 1)) / items.length;
  items.forEach((item, i) => {
    const x = gap + i * (barW + gap);
    const planH = (item.plan / max) * (h - 48);
    const factH = (item.fact / max) * (h - 48);
    ctx.fillStyle = "#efe6d4";
    ctx.fillRect(x, h - 28 - planH, barW, planH);
    ctx.fillStyle = item.fact >= item.plan ? "#2f9e96" : "#4a7fb5";
    ctx.fillRect(x + barW * 0.18, h - 28 - factH, barW * 0.64, factH);
    ctx.fillStyle = "#6b7c8f";
    ctx.font = "18px Manrope";
    ctx.textAlign = "center";
    ctx.fillText(item.label, x + barW / 2, h - 8);
  });
}

function drawDonut(canvas, slices) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * 2;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const colors = ["#10263f", "#4a7fb5", "#2f9e96", "#c4a35a", "#7eb6d9"];
  let a = -Math.PI / 2;
  const cx = w * 0.32, cy = h / 2, r = 78;
  slices.forEach((s, i) => {
    const slice = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a, a + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    a += slice;
  });
  ctx.beginPath();
  ctx.fillStyle = "#fffbf4";
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#10263f";
  ctx.font = "22px Cormorant Garamond";
  ctx.textAlign = "center";
  ctx.fillText(moneyShort(total), cx, cy + 8);
  let y = 36;
  ctx.textAlign = "left";
  ctx.font = "18px Manrope";
  slices.forEach((s, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(w * 0.58, y, 14, 14);
    ctx.fillStyle = "#1c2a3a";
    ctx.fillText(`${s.label}  ${moneyShort(s.value)}`, w * 0.58 + 22, y + 13);
    y += 28;
  });
}

function renderAnalytics() {
  const facts = monthFacts(selectedMonth);
  document.getElementById("month-label").textContent = facts.plan.label;
  document.getElementById("an-kpis").innerHTML = `
    <div class="stat ${facts.inc >= facts.plan.income ? "good" : ""}"><div class="label">Доход</div><div class="value">${moneyShort(facts.inc)}</div><div class="label">план ${moneyShort(facts.plan.income)}</div></div>
    <div class="stat ${facts.exp <= facts.plan.expenses ? "good" : "warn"}"><div class="label">Расходы</div><div class="value">${moneyShort(facts.exp)}</div><div class="label">лимит ${moneyShort(facts.plan.expenses)}</div></div>
    <div class="stat"><div class="label">В долги / фонд</div><div class="value">${moneyShort(facts.debt + facts.wed)}</div><div class="label">долг ${moneyShort(facts.debt)} · свадьба ${moneyShort(facts.wed)}</div></div>`;

  const bars = document.getElementById("bars");
  drawBars(bars, [
    { label: "Доход", plan: facts.plan.income, fact: facts.inc },
    { label: "Расходы", plan: facts.plan.expenses, fact: facts.exp },
    { label: "Долги", plan: facts.plan.debts, fact: facts.debt },
    { label: "Свадьба", plan: facts.plan.wedding, fact: facts.wed },
  ]);

  const catRows = EXPENSE_CATEGORIES.map((c) => {
    const fact = facts.byCat[c.id] || 0;
    const pct = Math.min(100, Math.round((fact / c.limit) * 100));
    const over = fact > c.limit;
    return `<div class="bar-row"><span>${c.label}</span><div class="bar ${over ? "warn" : ""}"><i style="width:${pct}%"></i></div><b>${moneyShort(fact)}</b></div>`;
  }).join("");
  document.getElementById("cat-bars").innerHTML = catRows || "";

  drawDonut(document.getElementById("donut"), EXPENSE_CATEGORIES.map((c) => ({ label: c.label.split(" ")[0], value: facts.byCat[c.id] || 0 })).filter((s) => s.value > 0).concat(facts.exp ? [] : [{ label: "пока пусто", value: 1 }]));

  const fmtHtml = INCOME_FORMATS.map((f) => {
    const rec = facts.byFormat[f.id] || { amount: 0, hours: 0 };
    const hourly = rec.hours ? rec.amount / rec.hours : f.hourly;
    return `<div class="row"><div class="dot"></div><div class="meta"><b>${f.label}</b><span>${money(rec.amount)} · ${rec.hours ? rec.hours.toFixed(1) + " ч" : "часы по модели"} · ≈ ${money(hourly)} /час</span></div></div>`;
  }).join("");
  document.getElementById("formats").innerHTML = fmtHtml;

  const path = MONTHS.map((m) => {
    const f = monthFacts(m.id);
    const ok = f.inc >= m.income * 0.9;
    return `<div class="bar-row"><span>${m.short}</span><div class="bar gold"><i style="width:${Math.min(100, (f.inc / m.income) * 100)}%"></i></div><b style="color:${ok ? "#2f9e96" : "#6b7c8f"}">${moneyShort(f.inc)}</b></div>`;
  }).join("");
  document.getElementById("year-path").innerHTML = path;

  const hall = facts.byFormat.group5000?.amount || 0;
  const hallH = facts.byFormat.group5000?.hours || 0;
  document.getElementById("insight").innerHTML = `
    <div class="card">
      <div class="label">Экономика зала</div>
      <p>Аренда 35 000 ₽ уже есть. Формат 7×5 000 даёт около 4 375 ₽/час — сильнее индивидуалки в 2 000 ₽. В этом месяце групповой «золотой» формат принёс ${money(hall)}${hallH ? ` за ${hallH.toFixed(1)} ч` : ""}.</p>
    </div>`;
}

function renderDebts() {
  const pri = priorityDebt();
  document.getElementById("debt-hero").innerHTML = `
    <div class="label">Остаток королевского долга</div>
    <div class="metric" style="font-size:34px">${money(totalDebt())}</div>
    <div class="label">Правило: минимумы по всем → остаток в ${pri ? pri.name + " (" + Math.round(pri.rate * 100) + "%)" : "ничего — ты свободна"}</div>`;
  document.getElementById("debt-list").innerHTML = state.debts.map((d) => {
    const rest = debtRemaining(d.id);
    const pct = Math.max(0, Math.round((1 - rest / d.start) * 100));
    const paidM = sum(debtPays(selectedMonth).filter((p) => p.debtId === d.id));
    const isPri = pri && pri.id === d.id;
    return `<div class="debt-card ${isPri ? "priority" : ""}">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <b>${d.name}${isPri ? " · удар сейчас" : ""}</b>
        <span>${Math.round(d.rate * 100)}% · мин. ${money(d.min)}</span>
      </div>
      <div class="metric">${money(rest)}</div>
      <div class="bar gold" style="margin:8px 0"><i style="width:${pct}%"></i></div>
      <div class="label">старт ${money(d.start)} · в этом месяце ${money(paidM)} · закрыто ${pct}%</div>
    </div>`;
  }).join("");

  const facts = monthFacts(currentMonthId());
  const suggestion = Math.max(0, facts.inc - facts.exp);
  const parts = allocate(Math.max(facts.plan.debts, suggestion || 0) || APP.minimaTotal, currentMonthId());
  document.getElementById("debt-suggest").innerHTML = `
    <div class="card">
      <div class="label">Как распределить ближайший платёж</div>
      <p>Если направить ${money(Math.max(facts.plan.debts, APP.minimaTotal))}, казна предлагает:</p>
      ${parts.map((p) => `<div class="row"><div class="dot debt"></div><div class="meta"><b>${state.debts.find((d) => d.id === p.debtId).name}</b></div><div class="sum">${money(p.amount)}</div></div>`).join("")}
    </div>`;
}

function renderPlan() {
  const now = currentMonthId();
  document.getElementById("plan-list").innerHTML = MONTHS.map((m) => {
    const f = monthFacts(m.id);
    const cls = m.id === now ? "now" : (m.id < now ? "done" : "");
    return `<div class="tl ${cls}">
      <b>${m.label}${m.id === now ? " · сейчас" : ""}</b>
      <div class="muted">${m.task}</div>
      <div class="label">доход ${moneyShort(f.inc)} / ${moneyShort(m.income)} · долги ${moneyShort(f.debt)} / ${moneyShort(m.debts)} · свадьба ${moneyShort(f.wed)} / ${moneyShort(m.wedding)}</div>
    </div>`;
  }).join("");

  document.getElementById("checkpoints").innerHTML = CHECKPOINTS.map((c) =>
    `<div class="row"><div class="dot"></div><div class="meta"><b>${c.title}</b><span>${c.text}</span></div></div>`
  ).join("");

  const freeze = state.creditFreeze[now] || false;
  document.getElementById("rules").innerHTML = MONTHLY_RULES.map((r, i) =>
    `<label class="check"><input type="checkbox" ${i === 1 && freeze ? "checked" : ""} onchange="toggleRule(${i}, this.checked)"><span>${r}</span></label>`
  ).join("");
}

function toggleRule(i, checked) {
  if (i === 1) {
    state.creditFreeze[currentMonthId()] = checked;
    persist();
    toast(checked ? "Этот месяц без новых трат с кредиток. Сильный ход." : "Отметка снята.");
  }
}

function shiftMonth(dir) {
  const idx = MONTHS.findIndex((m) => m.id === selectedMonth);
  const next = MONTHS[Math.max(0, Math.min(MONTHS.length - 1, idx + dir))];
  selectedMonth = next.id;
  render();
}

function renderSettingsBits() {
  document.getElementById("name-input").value = state.profile.name || "";
}

function saveName() {
  state.profile.name = document.getElementById("name-input").value.trim() || APP.ownerDefault;
  persist();
  toast("Имя сохранено");
  render();
}

function doExport() {
  const blob = new Blob([exportState(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sokrovishcha-korolevy.json";
  a.click();
}

function doImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = importState(String(reader.result));
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, next);
      persist();
      toast("Данные восстановлены");
      render();
    } catch {
      toast("Не получилось прочитать файл");
    }
  };
  reader.readAsText(file);
}

function render() {
  document.getElementById("hello-name").textContent = state.profile.name || APP.ownerDefault;
  renderCoach();
  if (view === "home") renderHome();
  if (view === "analytics") renderAnalytics();
  if (view === "debts") renderDebts();
  if (view === "plan") renderPlan();
  renderSettingsBits();
}

function closeWelcome() {
  state.onboardingDone = true;
  persist();
  document.getElementById("welcome").classList.remove("show");
}

function boot() {
  if (!state.onboardingDone) document.getElementById("welcome").classList.add("show");
  selectedMonth = currentMonthId();
  if (!MONTHS.some((m) => m.id === selectedMonth)) selectedMonth = MONTHS[0].id;
  setView("home");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
}

window.app = {
  setView, openSheet, closeSheet, padInput, submitEntry, shiftMonth,
  saveName, doExport, doImport, closeWelcome, chooseFormat, chooseCategory, chooseDebt, toggleRule,
};
window.setView = setView;
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.padInput = padInput;
window.submitEntry = submitEntry;
window.shiftMonth = shiftMonth;
window.saveName = saveName;
window.doExport = doExport;
window.doImport = (e) => doImport(e.target.files[0]);
window.closeWelcome = closeWelcome;
window.chooseFormat = chooseFormat;
window.chooseCategory = chooseCategory;
window.chooseDebt = chooseDebt;
window.toggleRule = toggleRule;
window.sheetTabTo = (tab) => { sheetTab = tab; renderSheet(); };

document.addEventListener("DOMContentLoaded", boot);
