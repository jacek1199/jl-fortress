/* ============ JL Fortress — logika aplikacji ============ */

const STORAGE_KEY = "jlfortress";

const defaultState = {
  businesses: [],
  transactions: [], // {id, bizId, type: 'income'|'expense', amount, desc, category, date}
  events: [],       // {id, date: 'YYYY-MM-DD', time, title, bizId}
  notes: []         // {id, title, body, bizId, updated}
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    alert("Uwaga: nie udało się zapisać danych w przeglądarce.\n" +
      "Sprawdź, czy nie przeglądasz w trybie prywatnym/incognito — w nim dane nie są trwałe.");
    console.error("saveState failed:", err);
  }
  schedulePush();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Formatowanie ---------- */
const fmtMoney = (v) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const bizName = (id) => state.businesses.find((b) => b.id === id)?.name ?? "—";

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Nawigacja ---------- */
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("section-" + btn.dataset.section).classList.add("active");
    renderAll();
  });
});

document.getElementById("today-date").textContent =
  new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* ---------- Modal ---------- */
const overlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalForm = document.getElementById("modal-form");

function openModal(title, fieldsHtml, onSubmit) {
  modalTitle.textContent = title;
  modalForm.innerHTML =
    fieldsHtml +
    `<div class="modal-actions">
       <button type="button" class="btn" id="modal-cancel">Anuluj</button>
       <button type="submit" class="btn btn-gold">Zapisz</button>
     </div>`;
  overlay.classList.remove("hidden");
  modalForm.onsubmit = (e) => {
    e.preventDefault();
    onSubmit(new FormData(modalForm));
    closeModal();
    saveState();
    renderAll();
  };
  document.getElementById("modal-cancel").onclick = closeModal;
}

function closeModal() {
  overlay.classList.add("hidden");
  modalForm.innerHTML = "";
}

overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

const bizOptions = (selected) =>
  state.businesses
    .map((b) => `<option value="${b.id}" ${b.id === selected ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
    .join("");

/* ============ BIZNESY ============ */
document.getElementById("btn-add-business").addEventListener("click", () => businessModal());

function businessModal(biz) {
  openModal(
    biz ? "Edytuj biznes" : "Nowy biznes",
    `<label>Nazwa
       <input name="name" required value="${escapeHtml(biz?.name ?? "")}" placeholder="np. JL Electrics">
     </label>
     <label>Opis
       <input name="desc" value="${escapeHtml(biz?.desc ?? "")}" placeholder="czym się zajmuje">
     </label>`,
    (fd) => {
      if (biz) {
        biz.name = fd.get("name").trim();
        biz.desc = fd.get("desc").trim();
      } else {
        state.businesses.push({ id: uid(), name: fd.get("name").trim(), desc: fd.get("desc").trim() });
      }
    }
  );
}

function deleteBusiness(id) {
  const biz = state.businesses.find((b) => b.id === id);
  if (!confirm(`Usunąć biznes „${biz.name}" wraz z jego transakcjami, wydarzeniami i notatkami?`)) return;
  state.businesses = state.businesses.filter((b) => b.id !== id);
  state.transactions = state.transactions.filter((t) => t.bizId !== id);
  state.events = state.events.filter((e) => e.bizId !== id);
  state.notes = state.notes.filter((n) => n.bizId !== id);
  saveState();
  renderAll();
}

function renderBusinesses() {
  const grid = document.getElementById("business-grid");
  if (!state.businesses.length) {
    grid.innerHTML = `<p class="empty-msg" style="display:block">Nie masz jeszcze żadnego biznesu. Dodaj pierwszy przyciskiem powyżej.</p>`;
    return;
  }
  grid.innerHTML = state.businesses
    .map((b) => {
      const balance = state.transactions
        .filter((t) => t.bizId === b.id)
        .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      return `<div class="business-card">
        <h3>${escapeHtml(b.name)}</h3>
        <p class="desc">${escapeHtml(b.desc)}</p>
        <div class="biz-balance ${balance >= 0 ? "amount-income" : "amount-expense"}">${fmtMoney(balance)}</div>
        <div class="business-actions">
          <button class="btn btn-sm" data-edit="${b.id}">Edytuj</button>
          <button class="btn btn-sm btn-danger" data-del="${b.id}">Usuń</button>
        </div>
      </div>`;
    })
    .join("");
  grid.querySelectorAll("[data-edit]").forEach((el) =>
    el.addEventListener("click", () => businessModal(state.businesses.find((b) => b.id === el.dataset.edit))));
  grid.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", () => deleteBusiness(el.dataset.del)));
}

/* ============ FINANSE ============ */
document.getElementById("btn-add-transaction").addEventListener("click", () => {
  if (!state.businesses.length) { alert("Najpierw dodaj przynajmniej jeden biznes."); return; }
  openModal(
    "Nowa transakcja",
    `<label>Typ
       <select name="type">
         <option value="income">Przychód</option>
         <option value="expense">Wydatek</option>
       </select>
     </label>
     <label>Kwota (zł)
       <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0,00">
     </label>
     <label>Opis
       <input name="desc" required placeholder="np. faktura za usługę">
     </label>
     <label>Kategoria
       <input name="category" placeholder="np. usługi, materiały, ZUS">
     </label>
     <label>Biznes
       <select name="bizId">${bizOptions()}</select>
     </label>
     <label>Data
       <input name="date" type="date" required value="${todayISO()}">
     </label>`,
    (fd) => {
      state.transactions.push({
        id: uid(),
        type: fd.get("type"),
        amount: parseFloat(fd.get("amount")),
        desc: fd.get("desc").trim(),
        category: fd.get("category").trim(),
        bizId: fd.get("bizId"),
        date: fd.get("date")
      });
    }
  );
});

const financeFilter = document.getElementById("finance-filter");
financeFilter.addEventListener("change", renderFinances);

function renderFinanceFilter() {
  const current = financeFilter.value;
  financeFilter.innerHTML =
    `<option value="">Wszystkie biznesy</option>` + bizOptions();
  financeFilter.value = current && state.businesses.some((b) => b.id === current) ? current : "";
}

function filteredTransactions() {
  const f = financeFilter.value;
  return state.transactions.filter((t) => !f || t.bizId === f);
}

function renderFinances() {
  const txs = [...filteredTransactions()].sort((a, b) => b.date.localeCompare(a.date));
  const rows = document.getElementById("transaction-rows");
  rows.innerHTML = txs
    .map(
      (t) => `<tr>
        <td>${fmtDate(t.date)}</td>
        <td>${escapeHtml(t.desc)}</td>
        <td>${escapeHtml(bizName(t.bizId))}</td>
        <td>${t.category ? `<span class="tag">${escapeHtml(t.category)}</span>` : ""}</td>
        <td class="right ${t.type === "income" ? "amount-income" : "amount-expense"}">
          ${t.type === "income" ? "+" : "−"}${fmtMoney(t.amount)}
        </td>
        <td class="right"><button class="btn btn-sm btn-danger" data-del-tx="${t.id}">✕</button></td>
      </tr>`
    )
    .join("");
  document.getElementById("transactions-empty").style.display = txs.length ? "none" : "block";
  rows.querySelectorAll("[data-del-tx]").forEach((el) =>
    el.addEventListener("click", () => {
      state.transactions = state.transactions.filter((t) => t.id !== el.dataset.delTx);
      saveState();
      renderAll();
    }));
  renderChart();
}

function renderChart() {
  const txs = filteredTransactions();
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pl-PL", { month: "short" }),
      income: 0,
      expense: 0
    });
  }
  txs.forEach((t) => {
    const m = months.find((m) => t.date.startsWith(m.key));
    if (m) m[t.type] += t.amount;
  });
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  document.getElementById("finance-chart").innerHTML = months
    .map(
      (m) => `<div class="chart-month">
        <div class="chart-bars">
          <div class="chart-bar income" style="height:${(m.income / max) * 100}%" title="Przychody: ${fmtMoney(m.income)}"></div>
          <div class="chart-bar expense" style="height:${(m.expense / max) * 100}%" title="Wydatki: ${fmtMoney(m.expense)}"></div>
        </div>
        <span class="chart-label">${m.label}</span>
      </div>`
    )
    .join("");
}

/* ============ KALENDARZ ============ */
let calDate = new Date();
let selectedDay = todayISO();

document.getElementById("cal-prev").addEventListener("click", () => {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1);
  renderCalendar();
});

document.getElementById("btn-add-event").addEventListener("click", () => eventModal(selectedDay));

function eventModal(dateISO) {
  openModal(
    "Nowe wydarzenie",
    `<label>Tytuł
       <input name="title" required placeholder="np. spotkanie z klientem">
     </label>
     <label>Data
       <input name="date" type="date" required value="${dateISO || todayISO()}">
     </label>
     <label>Godzina
       <input name="time" type="time">
     </label>
     <label>Biznes (opcjonalnie)
       <select name="bizId"><option value="">—</option>${bizOptions()}</select>
     </label>`,
    (fd) => {
      state.events.push({
        id: uid(),
        title: fd.get("title").trim(),
        date: fd.get("date"),
        time: fd.get("time"),
        bizId: fd.get("bizId")
      });
      selectedDay = fd.get("date");
    }
  );
}

function renderCalendar() {
  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  document.getElementById("cal-title").textContent =
    calDate.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  const firstDay = new Date(y, m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // poniedziałek = 0
  const gridStart = new Date(y, m, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayEvents = state.events.filter((e) => e.date === iso);
    cells.push(`<div class="cal-day ${d.getMonth() !== m ? "other-month" : ""} ${iso === todayISO() ? "today" : ""} ${iso === selectedDay ? "selected" : ""}" data-day="${iso}">
      <span>${d.getDate()}</span>
      <div class="event-dots">${dayEvents.slice(0, 4).map(() => `<span class="event-dot"></span>`).join("")}</div>
    </div>`);
  }
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = cells.join("");
  grid.querySelectorAll(".cal-day").forEach((el) =>
    el.addEventListener("click", () => {
      selectedDay = el.dataset.day;
      renderCalendar();
    }));
  renderDayEvents();
}

function renderDayEvents() {
  document.getElementById("day-events-title").textContent = `Wydarzenia — ${fmtDate(selectedDay)}`;
  const events = state.events
    .filter((e) => e.date === selectedDay)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const list = document.getElementById("day-events");
  list.innerHTML = events.length
    ? events
        .map(
          (e) => `<div class="dash-item">
            <span>${e.time ? `<b>${e.time}</b> · ` : ""}${escapeHtml(e.title)}${e.bizId ? ` <span class="tag">${escapeHtml(bizName(e.bizId))}</span>` : ""}</span>
            <button class="btn btn-sm btn-danger" data-del-ev="${e.id}">✕</button>
          </div>`
        )
        .join("")
    : `<p class="empty-msg" style="display:block">Brak wydarzeń tego dnia.</p>`;
  list.querySelectorAll("[data-del-ev]").forEach((el) =>
    el.addEventListener("click", () => {
      state.events = state.events.filter((e) => e.id !== el.dataset.delEv);
      saveState();
      renderAll();
    }));
}

/* ============ NOTATNIK ============ */
document.getElementById("btn-add-note").addEventListener("click", () => noteModal());

function noteModal(note) {
  openModal(
    note ? "Edytuj notatkę" : "Nowa notatka",
    `<label>Tytuł
       <input name="title" required value="${escapeHtml(note?.title ?? "")}" placeholder="tytuł notatki">
     </label>
     <label>Treść
       <textarea name="body" placeholder="treść...">${escapeHtml(note?.body ?? "")}</textarea>
     </label>
     <label>Biznes (opcjonalnie)
       <select name="bizId"><option value="">—</option>${bizOptions(note?.bizId)}</select>
     </label>
     ${note ? `<button type="button" class="btn btn-danger" id="note-delete">Usuń notatkę</button>` : ""}`,
    (fd) => {
      if (note) {
        note.title = fd.get("title").trim();
        note.body = fd.get("body");
        note.bizId = fd.get("bizId");
        note.updated = Date.now();
      } else {
        state.notes.push({
          id: uid(),
          title: fd.get("title").trim(),
          body: fd.get("body"),
          bizId: fd.get("bizId"),
          updated: Date.now()
        });
      }
    }
  );
  if (note) {
    document.getElementById("note-delete").onclick = () => {
      if (!confirm("Usunąć tę notatkę?")) return;
      state.notes = state.notes.filter((n) => n.id !== note.id);
      closeModal();
      saveState();
      renderAll();
    };
  }
}

function renderNotes() {
  const grid = document.getElementById("notes-grid");
  const notes = [...state.notes].sort((a, b) => b.updated - a.updated);
  grid.innerHTML = notes
    .map(
      (n) => `<div class="note-card" data-note="${n.id}">
        <h3>${escapeHtml(n.title)}</h3>
        <p class="note-body">${escapeHtml(n.body)}</p>
        <span class="meta">${n.bizId ? escapeHtml(bizName(n.bizId)) + " · " : ""}${new Date(n.updated).toLocaleDateString("pl-PL")}</span>
      </div>`
    )
    .join("");
  document.getElementById("notes-empty").style.display = notes.length ? "none" : "block";
  grid.querySelectorAll("[data-note]").forEach((el) =>
    el.addEventListener("click", () => noteModal(state.notes.find((n) => n.id === el.dataset.note))));
}

/* ============ PULPIT ============ */
function renderDashboard() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const balance = state.transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const monthTx = state.transactions.filter((t) => t.date.startsWith(monthKey));
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  document.getElementById("stat-balance").textContent = fmtMoney(balance);
  document.getElementById("stat-income").textContent = fmtMoney(income);
  document.getElementById("stat-expense").textContent = fmtMoney(expense);
  document.getElementById("stat-businesses").textContent = state.businesses.length;

  const upcoming = state.events
    .filter((e) => e.date >= todayISO())
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .slice(0, 5);
  document.getElementById("dash-events").innerHTML = upcoming.length
    ? upcoming
        .map((e) => `<div class="dash-item"><span>${escapeHtml(e.title)}</span><span class="meta">${fmtDate(e.date)}${e.time ? " " + e.time : ""}</span></div>`)
        .join("")
    : `<p class="empty-msg" style="display:block">Brak nadchodzących wydarzeń.</p>`;

  const recentTx = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  document.getElementById("dash-transactions").innerHTML = recentTx.length
    ? recentTx
        .map(
          (t) => `<div class="dash-item">
            <span>${escapeHtml(t.desc)}</span>
            <span class="${t.type === "income" ? "amount-income" : "amount-expense"}">${t.type === "income" ? "+" : "−"}${fmtMoney(t.amount)}</span>
          </div>`
        )
        .join("")
    : `<p class="empty-msg" style="display:block">Brak transakcji.</p>`;

  const recentNotes = [...state.notes].sort((a, b) => b.updated - a.updated).slice(0, 5);
  document.getElementById("dash-notes").innerHTML = recentNotes.length
    ? recentNotes
        .map((n) => `<div class="dash-item"><span>${escapeHtml(n.title)}</span><span class="meta">${new Date(n.updated).toLocaleDateString("pl-PL")}</span></div>`)
        .join("")
    : `<p class="empty-msg" style="display:block">Brak notatek.</p>`;
}

/* ============ SYNCHRONIZACJA (Supabase) ============ */
const SYNC_CFG_KEY = "jlfortress-sync";
const SYNC_ROW_ID = "jl-fortress";
let sbClient = null;
let pushTimer = null;

function syncCfg() {
  try { return JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || null; }
  catch { return null; }
}

function setSyncStatus(kind, text) {
  const el = document.getElementById("sync-status");
  el.innerHTML = `<span class="s-dot s-${kind}"></span> ${text}`;
}

function initClient() {
  const cfg = syncCfg();
  if (!cfg || !cfg.url || !cfg.key || typeof supabase === "undefined") {
    sbClient = null;
    setSyncStatus("off", "Bez chmury (dane lokalne)");
    return false;
  }
  try {
    sbClient = supabase.createClient(cfg.url, cfg.key);
    return true;
  } catch (err) {
    console.error("createClient failed:", err);
    sbClient = null;
    setSyncStatus("err", "Błędna konfiguracja chmury");
    return false;
  }
}

async function pullRemote() {
  if (!sbClient) return;
  setSyncStatus("busy", "Pobieranie z chmury…");
  const { data, error } = await sbClient
    .from("app_state").select("data").eq("id", SYNC_ROW_ID).maybeSingle();
  if (error) {
    console.error("pull failed:", error);
    setSyncStatus("err", "Błąd pobierania — sprawdź Ustawienia");
    return;
  }
  if (!data) {
    // W chmurze pusto — wyślij dane lokalne
    await pushRemote();
    return;
  }
  const remote = data.data;
  if ((remote?.updatedAt || 0) > (state.updatedAt || 0)) {
    state = { ...structuredClone(defaultState), ...remote };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    renderAll();
    setSyncStatus("ok", "Zsynchronizowano (pobrano nowsze)");
  } else if ((state.updatedAt || 0) > (remote?.updatedAt || 0)) {
    await pushRemote();
  } else {
    setSyncStatus("ok", "Zsynchronizowano");
  }
}

async function pushRemote() {
  if (!sbClient) return;
  setSyncStatus("busy", "Wysyłanie do chmury…");
  const { error } = await sbClient.from("app_state").upsert({
    id: SYNC_ROW_ID,
    data: state,
    updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("push failed:", error);
    setSyncStatus("err", "Błąd wysyłania — spróbuj „Synchronizuj teraz”");
  } else {
    setSyncStatus("ok", "Zsynchronizowano " + new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
  }
}

function schedulePush() {
  if (!sbClient) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushRemote, 1500);
}

function renderSettings() {
  const cfg = syncCfg();
  document.getElementById("sync-url").value = cfg?.url || "";
  document.getElementById("sync-key").value = cfg?.key || "";
  document.getElementById("sync-info").textContent = cfg
    ? "Chmura skonfigurowana. Dane synchronizują się automatycznie po każdej zmianie."
    : "Chmura nieskonfigurowana — dane są tylko na tym urządzeniu.";
}

document.getElementById("sync-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = document.getElementById("sync-url").value.trim().replace(/\/+$/, "");
  const key = document.getElementById("sync-key").value.trim();
  if (!url || !key) { alert("Podaj adres projektu i klucz anon."); return; }
  localStorage.setItem(SYNC_CFG_KEY, JSON.stringify({ url, key }));
  renderSettings();
  if (initClient()) await pullRemote();
});

document.getElementById("btn-sync-now").addEventListener("click", async () => {
  if (!sbClient && !initClient()) { alert("Najpierw skonfiguruj chmurę powyżej."); return; }
  await pullRemote();
});

document.getElementById("btn-sync-off").addEventListener("click", () => {
  if (!confirm("Rozłączyć chmurę? Dane pozostaną lokalnie i w chmurze, ale przestaną się synchronizować.")) return;
  localStorage.removeItem(SYNC_CFG_KEY);
  sbClient = null;
  renderSettings();
  setSyncStatus("off", "Bez chmury (dane lokalne)");
});

/* ---------- Kopia zapasowa ---------- */
document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `jl-fortress-kopia-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("btn-import").addEventListener("click", () =>
  document.getElementById("import-file").click());

document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || typeof imported !== "object" || !Array.isArray(imported.businesses)) {
        throw new Error("bad format");
      }
      if (!confirm("Wczytanie kopii ZASTĄPI obecne dane w aplikacji. Kontynuować?")) return;
      state = { ...structuredClone(defaultState), ...imported };
      saveState();
      renderAll();
      alert("Kopia wczytana.");
    } catch {
      alert("Nie udało się wczytać pliku — to nie jest poprawna kopia JL Fortress.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ============ RENDER ============ */
function renderAll() {
  renderFinanceFilter();
  renderDashboard();
  renderBusinesses();
  renderFinances();
  renderCalendar();
  renderNotes();
  renderSettings();
}

renderAll();
if (initClient()) pullRemote();
window.addEventListener("online", () => { if (sbClient) pullRemote(); });
