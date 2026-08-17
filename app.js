// ---------- Stan i localStorage ----------
const LS_PLAN = "fitObiady.plan"; // { [recipeId]: count }
const LS_PANTRY = "fitObiady.pantry"; // [ingredientName, ...] (zawsze w domu)
const LS_CHECKED = "fitObiady.checked"; // [itemKey, ...] (odhaczone na liście zakupów)

const CATEGORY_LABELS = {
  mieso: "Mięso",
  warzywa: "Warzywa i owoce",
  nabial: "Nabiał",
  zboza: "Produkty zbożowe / kasze / makarony",
  przyprawy_sosy: "Przyprawy, sosy, konserwy",
  inne: "Inne",
};

const EQUIP_LABELS = {
  garnek: "🍲 Garnek",
  thermomix: "🌀 Thermomix",
  blender: "🥤 Blender",
  frytkownica: "🍟 Frytkownica",
};

const QUICK_PANTRY_ITEMS = [
  "Sól", "Pieprz", "Oliwa z oliwek", "Oregano suszone", "Bazylia suszona",
  "Papryka słodka mielona", "Kminek mielony", "Curry przyprawa", "Olej sezamowy",
  "Ocet ryżowy/winny", "Zioła prowansalskie", "Tymianek suszony", "Majeranek suszony",
  "Chrzan tarty", "Keczup", "Musztarda", "Miód", "Sos sojowy", "Bułka tarta",
  "Imbir świeży", "Lubczyk suszony, sól, pieprz", "Papryka słodka mielona (do gulaszu)",
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let plan = loadJSON(LS_PLAN, {}); // recipeId -> count
let pantry = new Set(loadJSON(LS_PANTRY, []));
let checked = new Set(loadJSON(LS_CHECKED, []));

let activeEquip = new Set();
let activeProtein = new Set();

function persistPlan() { saveJSON(LS_PLAN, plan); }
function persistPantry() { saveJSON(LS_PANTRY, Array.from(pantry)); }
function persistChecked() { saveJSON(LS_CHECKED, Array.from(checked)); }

function getRecipeById(id) {
  return RECIPES.find((r) => r.id === id);
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "planer") renderPlaner();
    if (btn.dataset.tab === "zakupy") renderShoppingList();
    if (btn.dataset.tab === "spizarnia") renderPantry();
  });
});

// ---------- Przepisy: filtrowanie i render ----------
function matchesFilters(recipe) {
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  if (search && !recipe.name.toLowerCase().includes(search)) return false;
  if (activeEquip.size > 0) {
    const hasAny = recipe.equipment.some((e) => activeEquip.has(e));
    if (!hasAny) return false;
  }
  if (activeProtein.size > 0) {
    if (!activeProtein.has(recipe.protein_source)) return false;
  }
  return true;
}

function sortRecipes(list) {
  const mode = document.getElementById("sort-select").value;
  const copy = [...list];
  if (mode === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  if (mode === "kcal-asc") copy.sort((a, b) => a.kcal - b.kcal);
  if (mode === "kcal-desc") copy.sort((a, b) => b.kcal - a.kcal);
  if (mode === "protein-desc") copy.sort((a, b) => b.protein - a.protein);
  return copy;
}

function renderRecipeGrid() {
  const filtered = sortRecipes(RECIPES.filter(matchesFilters));
  const grid = document.getElementById("recipe-grid");
  document.getElementById("results-count").textContent =
    `${filtered.length} z ${RECIPES.length} przepisów`;

  grid.innerHTML = filtered
    .map((r) => {
      const inPlan = !!plan[r.id];
      return `
      <div class="recipe-card" data-id="${r.id}">
        <h3>${r.name}</h3>
        <div class="recipe-tags">
          <span class="tag protein-tag">${r.protein_source}</span>
          ${r.equipment.map((e) => `<span class="tag">${EQUIP_LABELS[e]}</span>`).join("")}
        </div>
        <div class="macro-row">
          <span><b>${r.kcal}</b> kcal</span>
          <span><b>${r.protein}g</b> białka</span>
          <span><b>~${r.weight_g}g</b> porcja</span>
        </div>
        <div class="card-footer">
          <span class="weight-note">na 2 os. / 2 dni</span>
          <button class="btn-add ${inPlan ? "added" : ""}" data-id="${r.id}">
            ${inPlan ? "✓ W planie" : "+ Do planu"}
          </button>
        </div>
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".recipe-card").forEach((card) => {
    card.addEventListener("click", (ev) => {
      if (ev.target.closest(".btn-add")) return;
      openModal(Number(card.dataset.id));
    });
  });
  grid.querySelectorAll(".btn-add").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      addToPlan(Number(btn.dataset.id));
      renderRecipeGrid();
    });
  });
}

document.getElementById("search-input").addEventListener("input", renderRecipeGrid);
document.getElementById("sort-select").addEventListener("change", renderRecipeGrid);
document.getElementById("filter-equipment").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".chip");
  if (!btn) return;
  const eq = btn.dataset.equip;
  if (activeEquip.has(eq)) { activeEquip.delete(eq); btn.classList.remove("active"); }
  else { activeEquip.add(eq); btn.classList.add("active"); }
  renderRecipeGrid();
});
document.getElementById("filter-protein").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".chip");
  if (!btn) return;
  const p = btn.dataset.protein;
  if (activeProtein.has(p)) { activeProtein.delete(p); btn.classList.remove("active"); }
  else { activeProtein.add(p); btn.classList.add("active"); }
  renderRecipeGrid();
});
document.getElementById("clear-filters").addEventListener("click", () => {
  activeEquip.clear();
  activeProtein.clear();
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  document.getElementById("search-input").value = "";
  document.getElementById("sort-select").value = "name";
  renderRecipeGrid();
});

// ---------- Modal szczegółów ----------
function openModal(id) {
  const r = getRecipeById(id);
  if (!r) return;
  const inPlan = !!plan[id];
  document.getElementById("modal-content").innerHTML = `
    <h2>${r.name}</h2>
    <div class="recipe-tags">
      <span class="tag protein-tag">${r.protein_source}</span>
      ${r.equipment.map((e) => `<span class="tag">${EQUIP_LABELS[e]}</span>`).join("")}
    </div>
    <div class="modal-macros">
      <div><b>${r.kcal}</b>kcal / porcję</div>
      <div><b>${r.protein}g</b>białka</div>
      <div><b>${r.carbs}g</b>węglowodanów</div>
      <div><b>${r.fat}g</b>tłuszczu</div>
      <div><b>~${r.weight_g}g</b>waga porcji</div>
    </div>
    <p class="hint">Wartości kaloryczne i makroskładniki liczone są od wagi surowych/suchych składników (przed gotowaniem) — tak jak podano poniżej i na liście zakupów. Kalorie nie zmieniają się od gotowania, tylko waga (np. ryż/kasza pęcznieją ok. 2-2,5×). "Waga porcji" powyżej to już szacowana waga gotowego dania w pudełku. Przepis na ${r.portions} porcje (2 osoby × 2 dni) — świetnie nadaje się do popudełkowania.</p>
    <div class="modal-section">
      <h4>Składniki (na całą partię, ${r.portions} porcje, wagi surowe/suche)</h4>
      <ul class="ingredient-list">
        ${r.ingredients.map((i) => `<li><span>${i.name}</span><span>${i.amount} ${i.unit}</span></li>`).join("")}
      </ul>
    </div>
    <div class="modal-section">
      <h4>Przygotowanie</h4>
      <ol class="steps-list">
        ${r.steps.map((s) => `<li>${s}</li>`).join("")}
      </ol>
    </div>
    <div class="modal-actions">
      <button class="btn-primary" id="modal-add-btn" data-id="${r.id}">
        ${inPlan ? "✓ W planie tygodnia" : "+ Dodaj do planu tygodnia"}
      </button>
    </div>
  `;
  document.getElementById("modal-add-btn").addEventListener("click", () => {
    addToPlan(id);
    openModal(id);
    renderRecipeGrid();
  });
  document.getElementById("recipe-modal").classList.add("open");
}
document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("recipe-modal").classList.remove("open");
});
document.getElementById("recipe-modal").addEventListener("click", (ev) => {
  if (ev.target.id === "recipe-modal") ev.currentTarget.classList.remove("open");
});

// ---------- Planer ----------
function addToPlan(id) {
  plan[id] = (plan[id] || 0) + 1;
  persistPlan();
  updatePlanBadge();
}
function changePlanQty(id, delta) {
  const next = (plan[id] || 0) + delta;
  if (next <= 0) delete plan[id];
  else plan[id] = next;
  persistPlan();
  updatePlanBadge();
  renderPlaner();
  renderRecipeGrid();
}
function updatePlanBadge() {
  const total = Object.values(plan).reduce((a, b) => a + b, 0);
  document.getElementById("plan-count-badge").textContent = total;
}

function renderPlaner() {
  const entries = Object.entries(plan).map(([id, count]) => ({ recipe: getRecipeById(Number(id)), count }))
    .filter((e) => e.recipe);

  const emptyEl = document.getElementById("planer-empty");
  emptyEl.classList.toggle("show", entries.length === 0);

  const totalDays = entries.reduce((s, e) => s + e.count * 2, 0);
  const totalPortions = entries.reduce((s, e) => s + e.count * 4, 0);
  const totalKcal = entries.reduce((s, e) => s + e.recipe.kcal * e.count, 0);
  const totalProtein = entries.reduce((s, e) => s + e.recipe.protein * e.count, 0);
  const avgKcal = entries.length ? Math.round(entries.reduce((s, e) => s + e.recipe.kcal, 0) / entries.length) : 0;
  const avgProtein = entries.length ? Math.round(entries.reduce((s, e) => s + e.recipe.protein, 0) / entries.length) : 0;

  document.getElementById("planer-summary").innerHTML = `
    <div class="summary-stat"><b>${totalDays}</b><span>dni pokryte obiadem</span></div>
    <div class="summary-stat"><b>${totalPortions}</b><span>porcji do pudełek</span></div>
    <div class="summary-stat"><b>${avgKcal || "–"}</b><span>śr. kcal / porcję</span></div>
    <div class="summary-stat"><b>${avgProtein || "–"}</b><span>śr. białko (g) / porcję</span></div>
  `;

  document.getElementById("planer-list").innerHTML = entries
    .map(
      (e) => `
      <div class="planer-item">
        <div class="pi-main">
          <h4>${e.recipe.name}</h4>
          <div class="pi-meta">${e.recipe.kcal} kcal · ${e.recipe.protein}g białka / porcję · ${e.recipe.equipment.map((x) => EQUIP_LABELS[x]).join(" ")}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn-remove" data-id="${e.recipe.id}" data-delta="-1">−</button>
          <span><b>${e.count}</b>× (${e.count * 2} dni)</span>
          <button class="btn-remove" data-id="${e.recipe.id}" data-delta="1">+</button>
          <button class="btn-remove" data-id="${e.recipe.id}" data-delta="remove">Usuń</button>
        </div>
      </div>`
    )
    .join("");

  document.getElementById("planer-list").querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.delta === "remove") {
        delete plan[id];
        persistPlan();
        updatePlanBadge();
        renderPlaner();
        renderRecipeGrid();
      } else {
        changePlanQty(id, Number(btn.dataset.delta));
      }
    });
  });
}

// ---------- Lista zakupów ----------
function normKey(name, unit) {
  return name.trim().toLowerCase() + "|" + unit.trim().toLowerCase();
}

function buildShoppingAggregate() {
  const map = new Map(); // key -> {name, unit, amount, category}
  Object.entries(plan).forEach(([id, count]) => {
    const recipe = getRecipeById(Number(id));
    if (!recipe) return;
    recipe.ingredients.forEach((ing) => {
      const key = normKey(ing.name, ing.unit);
      const existing = map.get(key);
      if (existing) {
        existing.amount += ing.amount * count;
      } else {
        map.set(key, { name: ing.name, unit: ing.unit, amount: ing.amount * count, category: ing.category });
      }
    });
  });
  return map;
}

function renderShoppingList() {
  const aggregate = buildShoppingAggregate();
  const emptyEl = document.getElementById("zakupy-empty");
  emptyEl.classList.toggle("show", aggregate.size === 0);

  const byCategory = {};
  let skipped = 0;
  aggregate.forEach((item, key) => {
    const owned = pantry.has(item.name.trim().toLowerCase());
    if (owned) { skipped++; return; }
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push({ ...item, key });
  });

  const order = ["mieso", "warzywa", "nabial", "zboza", "przyprawy_sosy", "inne"];
  const container = document.getElementById("shopping-list");
  container.innerHTML = order
    .filter((cat) => byCategory[cat] && byCategory[cat].length)
    .map((cat) => {
      const items = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name, "pl"));
      return `
      <div class="shop-category">
        <h3>${CATEGORY_LABELS[cat]}</h3>
        <ul class="shop-items">
          ${items
            .map((it) => {
              const isChecked = checked.has(it.key);
              const roundedAmount = Math.round(it.amount * 100) / 100;
              return `<li class="${isChecked ? "checked" : ""}">
                <input type="checkbox" data-key="${it.key}" ${isChecked ? "checked" : ""}>
                <span class="shop-item-name">${it.name}</span>
                <span class="shop-item-amount">${roundedAmount} ${it.unit}</span>
              </li>`;
            })
            .join("")}
        </ul>
      </div>`;
    })
    .join("") + (skipped > 0 ? `<p class="pantry-skip-note">Pominięto ${skipped} pozycji oznaczonych jako "mam w spiżarni".</p>` : "");

  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) checked.add(cb.dataset.key);
      else checked.delete(cb.dataset.key);
      persistChecked();
      cb.closest("li").classList.toggle("checked", cb.checked);
    });
  });
}

document.getElementById("reset-checked").addEventListener("click", () => {
  checked.clear();
  persistChecked();
  renderShoppingList();
});

// ---------- Spiżarnia ----------
function getAllUniqueIngredients() {
  const seen = new Map();
  RECIPES.forEach((r) => {
    r.ingredients.forEach((ing) => {
      const key = ing.name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: ing.name, category: ing.category });
    });
  });
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

function renderPantry() {
  const all = getAllUniqueIngredients();
  const container = document.getElementById("pantry-list");
  container.innerHTML =
    `<div style="grid-column:1/-1; margin-bottom:6px;">
      <button class="btn-ghost" id="quick-pantry-btn">Zaznacz typowe przyprawy i podstawy</button>
    </div>` +
    all
      .map((item) => {
        const key = item.name.trim().toLowerCase();
        const isOwned = pantry.has(key);
        return `<label class="pantry-item">
          <input type="checkbox" data-key="${key}" ${isOwned ? "checked" : ""}>
          <span>${item.name}</span>
        </label>`;
      })
      .join("");

  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) pantry.add(cb.dataset.key);
      else pantry.delete(cb.dataset.key);
      persistPantry();
    });
  });

  document.getElementById("quick-pantry-btn").addEventListener("click", () => {
    QUICK_PANTRY_ITEMS.forEach((name) => pantry.add(name.trim().toLowerCase()));
    persistPantry();
    renderPantry();
  });
}

// ---------- Synchronizacja między urządzeniami (QR / link) ----------
function buildSyncPayload() {
  return { v: 1, plan, pantry: Array.from(pantry) };
}

function buildSyncUrl() {
  const encoded = encodeURIComponent(JSON.stringify(buildSyncPayload()));
  return `${location.origin}${location.pathname}?sync=${encoded}`;
}

function extractSyncCode(raw) {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const fromUrl = url.searchParams.get("sync");
    if (fromUrl) return fromUrl;
  } catch (e) {
    // to nie jest pełny URL - traktuj jako surowy kod
  }
  return trimmed;
}

function applySyncPayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.plan) {
    throw new Error("Nieprawidłowy format danych.");
  }
  plan = payload.plan;
  pantry = new Set(payload.pantry || []);
  persistPlan();
  persistPantry();
  updatePlanBadge();
  renderRecipeGrid();
  renderPlaner();
  renderPantry();
}

function decodeSyncCode(rawCode) {
  const code = extractSyncCode(rawCode);
  if (!code) return null;
  return JSON.parse(decodeURIComponent(code));
}

function importSyncCode(rawCode) {
  let payload;
  try {
    payload = decodeSyncCode(rawCode);
  } catch (e) {
    alert("Nie udało się odczytać kodu synchronizacji — sprawdź, czy skopiowałeś go w całości.");
    return;
  }
  if (!payload) return;
  const itemCount = Object.keys(payload.plan || {}).length;
  const pantryCount = (payload.pantry || []).length;
  const ok = confirm(
    `Zaimportować plan (${itemCount} dań) i spiżarnię (${pantryCount} produktów)?\nTo nadpisze obecny plan i spiżarnię na tym urządzeniu.`
  );
  if (!ok) return;
  try {
    applySyncPayload(payload);
  } catch (e) {
    alert("Nie udało się zaimportować: " + e.message);
  }
}

function openSyncModal() {
  const url = buildSyncUrl();
  document.getElementById("sync-link-input").value = url;
  const qrEl = document.getElementById("sync-qr");
  qrEl.innerHTML = "";
  try {
    new QRCode(qrEl, { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  } catch (e) {
    qrEl.innerHTML = '<p class="hint">Plan jest zbyt duży, żeby zmieścić się w kodzie QR — skorzystaj z linku poniżej.</p>';
  }
  document.getElementById("sync-modal").classList.add("open");
}

document.getElementById("open-sync-modal").addEventListener("click", openSyncModal);
document.getElementById("sync-modal-close").addEventListener("click", () => {
  document.getElementById("sync-modal").classList.remove("open");
});
document.getElementById("sync-modal").addEventListener("click", (ev) => {
  if (ev.target.id === "sync-modal") ev.currentTarget.classList.remove("open");
});
document.getElementById("sync-copy-btn").addEventListener("click", () => {
  const input = document.getElementById("sync-link-input");
  input.select();
  const btn = document.getElementById("sync-copy-btn");
  const original = btn.textContent;
  const showCopied = () => {
    btn.textContent = "Skopiowano!";
    setTimeout(() => (btn.textContent = original), 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(input.value).then(showCopied).catch(() => document.execCommand("copy") && showCopied());
  } else {
    document.execCommand("copy");
    showCopied();
  }
});
document.getElementById("sync-import-btn").addEventListener("click", () => {
  importSyncCode(document.getElementById("sync-import-input").value);
});

// Automatyczny import po otwarciu linku/zeskanowaniu kodu QR
(function checkUrlForSyncOnLoad() {
  const code = new URLSearchParams(location.search).get("sync");
  if (!code) return;
  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(code));
  } catch (e) {
    history.replaceState(null, "", location.pathname);
    return;
  }
  const itemCount = Object.keys(payload.plan || {}).length;
  const pantryCount = (payload.pantry || []).length;
  const ok = confirm(
    `Wykryto plan do zaimportowania (${itemCount} dań, ${pantryCount} produktów w spiżarni).\nCzy chcesz go wczytać? To nadpisze obecny plan i spiżarnię na tym urządzeniu.`
  );
  history.replaceState(null, "", location.pathname);
  if (ok) {
    try {
      applySyncPayload(payload);
    } catch (e) {
      alert("Nie udało się zaimportować danych.");
    }
  }
})();

// ---------- Eksport do PDF (menu + lista zakupów) ----------
function buildPrintContent() {
  const entries = Object.entries(plan)
    .map(([id, count]) => ({ recipe: getRecipeById(Number(id)), count }))
    .filter((e) => e.recipe)
    .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, "pl"));

  if (!entries.length) {
    alert("Twój plan jest pusty — dodaj dania w zakładce Przepisy, żeby wygenerować PDF.");
    return false;
  }

  const aggregate = buildShoppingAggregate();
  const byCategory = {};
  let alreadyBought = 0;
  aggregate.forEach((item, key) => {
    const owned = pantry.has(item.name.trim().toLowerCase());
    if (owned) return;
    if (checked.has(key)) { alreadyBought++; return; }
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  });
  const order = ["mieso", "warzywa", "nabial", "zboza", "przyprawy_sosy", "inne"];

  const shopHtml = order
    .filter((cat) => byCategory[cat] && byCategory[cat].length)
    .map((cat) => {
      const items = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name, "pl"));
      return `
      <div class="print-shop-category">
        <h4>${CATEGORY_LABELS[cat]}</h4>
        <ul class="print-shop-items">
          ${items
            .map(
              (it) =>
                `<li><span class="print-checkbox"></span>${it.name} — ${Math.round(it.amount * 100) / 100} ${it.unit}</li>`
            )
            .join("")}
        </ul>
      </div>`;
    })
    .join("");

  const totalDays = entries.reduce((s, e) => s + e.count * 2, 0);
  const totalPortions = entries.reduce((s, e) => s + e.count * 4, 0);

  const recipesHtml = entries
    .map(({ recipe: r, count }) => {
      const scaledPortions = r.portions * count;
      return `
      <div class="print-recipe">
        <h3>${r.name}${count > 1 ? ` (×${count})` : ""}</h3>
        <div class="print-tags">${r.protein_source} · ${r.equipment.map((e) => EQUIP_LABELS[e]).join(" ")} · na ${scaledPortions} porcje</div>
        <div class="print-macros"><b>${r.kcal} kcal</b> / porcję · <b>${r.protein}g</b> białka · <b>${r.carbs}g</b> węgli · <b>${r.fat}g</b> tłuszczu · ~${r.weight_g}g porcja</div>
        <ul class="print-ingredients">
          ${r.ingredients.map((i) => `<li>${i.name} — ${Math.round(i.amount * count * 100) / 100} ${i.unit}</li>`).join("")}
        </ul>
        <ol class="print-steps">
          ${r.steps.map((s) => `<li>${s}</li>`).join("")}
        </ol>
      </div>`;
    })
    .join("");

  const dateStr = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

  document.getElementById("print-area").innerHTML = `
    <div class="print-doc">
      <h1>Fit Obiady 2×2 — Menu tygodnia</h1>
      <p class="print-meta">Wygenerowano ${dateStr} · ${entries.length} dań · ${totalDays} dni pokryte obiadem · ${totalPortions} porcji do pudełek</p>
      <h2>Lista zakupów</h2>
      ${shopHtml || "<p>Brak składników do kupienia (wszystko masz już w spiżarni albo już odznaczone jako kupione).</p>"}
      ${alreadyBought > 0 ? `<p class="print-meta">(Pominięto ${alreadyBought} pozycji już odznaczonych jako kupione na liście zakupów.)</p>` : ""}
      <h2>Przepisy</h2>
      ${recipesHtml}
    </div>
  `;
  return true;
}

document.getElementById("export-pdf-btn").addEventListener("click", () => {
  if (buildPrintContent()) {
    window.print();
  }
});

// ---------- Init ----------
updatePlanBadge();
renderRecipeGrid();
