"use strict";

const STORAGE_KEY = "estoqueAzul.v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("pt-BR");
const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

const palette = { blue: "#2f91e7", navy: "#10345d", cyan: "#22b8cf", green: "#1f9d74", amber: "#e39a22", red: "#d14a5c", gray: "#9aabc0", grid: "#e4edf5", text: "#6b7b91" };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const isoDate = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const offsetDate = days => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};
const parseDate = value => value ? new Date(`${value}T12:00:00`) : null;
const daysBetween = (from, to = new Date()) => {
  const a = parseDate(from);
  const b = to instanceof Date ? new Date(to) : parseDate(to);
  if (!a || !b) return null;
  a.setHours(12, 0, 0, 0); b.setHours(12, 0, 0, 0);
  return Math.floor((b - a) / 86400000);
};
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createSeedData() {
  const productSpecs = [
    ["ARR-001", "Arroz integral 5 kg", "Mercearia", "Alimentos Brasil", "pct", 18.9, 27.9, 46, 21, 10, -42, 220, "A1-P1"],
    ["FEI-002", "Feijão carioca 1 kg", "Mercearia", "Grãos do Vale", "pct", 7.2, 11.9, 36, 8, 9, -35, 160, "A1-P2"],
    ["MAC-003", "Macarrão espaguete", "Mercearia", "Massa Boa", "pct", 4.1, 7.5, 52, 34, 12, -28, 310, "A2-P1"],
    ["FRZ-004", "Vegetais congelados", "Congelados", "FrioSul", "pct", 11.5, 18.9, 28, 5, 7, -18, 5, "F1-P1"],
    ["BAT-005", "Batata lavada", "Hortifruti", "Horta Direta", "kg", 3.6, 6.9, 40, 17, 10, -9, 9, "H1-P1"],
    ["CEN-006", "Cenoura", "Hortifruti", "Horta Direta", "kg", 3.2, 6.5, 25, 4, 6, -7, 2, "H1-P2"],
    ["MAM-007", "Mamão formosa", "Hortifruti", "Frutas Real", "kg", 5.4, 9.9, 30, 0, 5, -6, -1, "H2-P1"],
    ["CAF-008", "Café torrado 500 g", "Bebidas", "Serra Cafés", "pct", 14.8, 23.9, 44, 29, 10, -55, 280, "B1-P1"],
    ["SUC-009", "Suco de uva integral", "Bebidas", "Vinícola Aurora", "lt", 8.7, 14.5, 24, 12, 6, -31, 62, "B1-P2"],
    ["MIL-010", "Milho verde em lata", "Enlatados", "Alimentos Brasil", "un", 3.9, 6.8, 60, 45, 12, -67, 420, "A3-P1"],
    ["QUE-011", "Queijo muçarela fatiado", "Frios", "Laticínios Serra", "kg", 29.5, 45.9, 18, 7, 4, -12, 8, "F2-P1"],
    ["DET-012", "Detergente neutro", "Limpeza", "Casa Limpa", "un", 2.1, 4.2, 48, 40, 10, -74, null, "L1-P1"]
  ];
  const products = productSpecs.map((p, index) => ({
    id: `p${index + 1}`, sku: p[0], name: p[1], category: p[2], supplier: p[3], unit: p[4],
    cost: p[5], price: p[6], initialStock: p[7], stock: p[8], minimum: p[9],
    purchaseDate: offsetDate(p[10]), expiryDate: p[11] === null ? "" : offsetDate(p[11]), location: p[12]
  }));

  const movements = [];
  const saleProducts = products.slice(0, 11);
  for (let day = 30; day >= 0; day--) {
    const first = saleProducts[(day * 3 + 2) % saleProducts.length];
    const qty = 1 + ((day * 7) % 6);
    movements.push({ id: `m-s-${day}`, productId: first.id, type: day % 11 === 0 ? "Perda" : "Saída", quantity: qty, unitValue: first.price, date: offsetDate(-day), note: day % 11 === 0 ? "Avaria identificada" : "Venda do dia" });
    if (day % 5 === 0) {
      const second = saleProducts[(day + 5) % saleProducts.length];
      movements.push({ id: `m-e-${day}`, productId: second.id, type: "Entrada", quantity: 8 + (day % 9), unitValue: second.cost, date: offsetDate(-day), note: "Reposição do fornecedor" });
    }
  }
  return { products, movements, createdAt: new Date().toISOString() };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.products && saved?.movements) return saved;
  } catch (error) { console.warn("Backup local inválido", error); }
  const seed = createSeedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

let state = loadState();
let currentView = "dashboard";

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function productById(id) { return state.products.find(product => product.id === id); }
function margin(product) { return product.cost > 0 ? (product.price / product.cost) - 1 : 0; }
function expiryDays(product) { return product.expiryDate ? -daysBetween(new Date(), parseDate(product.expiryDate)) : null; }
function daysToExpiry(product) {
  if (!product.expiryDate) return null;
  return Math.ceil((parseDate(product.expiryDate) - new Date(new Date().setHours(12, 0, 0, 0))) / 86400000);
}
function productStatus(product) {
  const expiry = daysToExpiry(product);
  if (expiry !== null && expiry < 0) return { key: "vencido", label: "Vencido", cls: "bad" };
  if (product.stock <= 0) return { key: "zerado", label: "Zerado", cls: "bad" };
  if (expiry !== null && expiry <= 7) return { key: "vencendo", label: "Vencendo", cls: "warn" };
  if (product.stock <= product.minimum) return { key: "baixo", label: "Estoque baixo", cls: "warn" };
  return { key: "normal", label: "Normal", cls: "good" };
}
function movementSign(type) { return ["Entrada", "Ajuste +"].includes(type) ? 1 : -1; }
function saleMovements() { return state.movements.filter(m => m.type === "Saída"); }
function productSales(productId) { return saleMovements().filter(m => m.productId === productId).reduce((sum, m) => sum + Number(m.quantity), 0); }
function productRevenue(productId) { return saleMovements().filter(m => m.productId === productId).reduce((sum, m) => sum + Number(m.quantity) * Number(m.unitValue || productById(productId)?.price || 0), 0); }

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function updateHeader() {
  setText("todayLabel", longDate.format(new Date()));
  const titles = { dashboard: "Visão geral do estoque", produtos: "Cadastro e saldo de produtos", movimentacoes: "Movimentações do estoque", vencimentos: "Controle de vencimentos", relatorios: "Relatórios gerenciais" };
  setText("viewTitle", titles[currentView]);
}

function switchView(view) {
  currentView = view;
  $$(".view").forEach(section => section.classList.toggle("active", section.id === view));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#sidebar").classList.remove("open");
  updateHeader();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderNotices() {
  const low = state.products.filter(p => p.stock <= p.minimum && p.stock > 0).length;
  const zero = state.products.filter(p => p.stock <= 0).length;
  const expiring = state.products.filter(p => { const d = daysToExpiry(p); return d !== null && d >= 0 && d <= 7; }).length;
  const notices = [];
  if (zero) notices.push(`<div class="notice danger"><b>!</b><div><strong>${zero} produto${zero > 1 ? "s" : ""} sem estoque</strong><small>Priorize a reposição.</small></div></div>`);
  if (low) notices.push(`<div class="notice warning"><b>↓</b><div><strong>${low} item${low > 1 ? "s" : ""} abaixo do mínimo</strong><small>Revise as compras planejadas.</small></div></div>`);
  if (expiring) notices.push(`<div class="notice warning"><b>◷</b><div><strong>${expiring} lote${expiring > 1 ? "s" : ""} vencendo em 7 dias</strong><small>Considere promoção ou remanejamento.</small></div></div>`);
  if (!notices.length) notices.push(`<div class="notice"><b>✓</b><div><strong>Estoque sem alertas críticos</strong><small>Todos os níveis estão dentro dos parâmetros.</small></div></div>`);
  $("#noticeRow").innerHTML = notices.join("");
}

function renderKpis() {
  const units = state.products.reduce((sum, p) => sum + Number(p.stock), 0);
  const costValue = state.products.reduce((sum, p) => sum + p.stock * p.cost, 0);
  const saleValue = state.products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const avgMargin = state.products.length ? state.products.reduce((sum, p) => sum + margin(p), 0) / state.products.length : 0;
  const alerts = state.products.filter(p => productStatus(p).key !== "normal").length;
  setText("kpiProducts", state.products.length);
  setText("kpiProductsNote", `${new Set(state.products.map(p => p.category)).size} categorias cadastradas`);
  setText("kpiUnits", integer.format(units));
  setText("kpiUnitsNote", `${money.format(costValue)} investidos`);
  setText("kpiSaleValue", money.format(saleValue));
  setText("kpiMarginNote", `Margem média de ${percent.format(avgMargin)}`);
  setText("kpiAlerts", alerts);
  setText("kpiAlertsNote", alerts ? "Revise os itens prioritários" : "Nenhuma ocorrência crítica");
  const normal = state.products.filter(p => productStatus(p).key === "normal").length;
  const score = state.products.length ? Math.round((normal / state.products.length) * 100) : 100;
  setText("healthScore", `${score}%`); $("#healthBar").style.width = `${score}%`;
}

function renderActionList() {
  const items = [...state.products].filter(p => productStatus(p).key !== "normal").sort((a, b) => {
    const order = { vencido: 0, zerado: 1, vencendo: 2, baixo: 3 }; return order[productStatus(a).key] - order[productStatus(b).key];
  }).slice(0, 5);
  $("#actionList").innerHTML = items.length ? items.map(p => {
    const status = productStatus(p); const expiry = daysToExpiry(p);
    const note = status.key.includes("venc") ? `${expiry < 0 ? "Venceu há" : "Vence em"} ${Math.abs(expiry)} dia(s)` : `${p.stock} ${p.unit} disponíveis • mínimo ${p.minimum}`;
    return `<div class="action-item"><span class="action-icon">${status.cls === "bad" ? "!" : "↓"}</span><div><strong>${escapeHTML(p.name)}</strong><small>${note}</small></div><span class="tag ${status.cls}">${status.label}</span></div>`;
  }).join("") : `<div class="empty-state">Tudo em ordem por aqui.</div>`;
}

function movementBadge(type) {
  const positive = ["Entrada", "Ajuste +"].includes(type);
  return `<span class="tag ${positive ? "good" : type === "Perda" ? "bad" : "warn"}">${escapeHTML(type)}</span>`;
}

function renderRecentMovements() {
  const body = $("#recentTable tbody");
  const rows = [...state.movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  body.innerHTML = rows.map(m => {
    const p = productById(m.productId); return `<tr><td>${shortDate.format(parseDate(m.date))}</td><td><strong>${escapeHTML(p?.name || "Produto removido")}</strong></td><td>${movementBadge(m.type)}</td><td class="number ${movementSign(m.type) > 0 ? "positive" : "negative"}">${movementSign(m.type) > 0 ? "+" : "−"}${integer.format(m.quantity)}</td><td class="number">${money.format(m.quantity * m.unitValue)}</td><td>${escapeHTML(m.note || "—")}</td></tr>`;
  }).join("") || `<tr><td colspan="6" class="empty-state">Nenhuma movimentação registrada.</td></tr>`;
}

function renderCategoryFilter() {
  const select = $("#categoryFilter"); const selected = select.value;
  select.innerHTML = `<option value="">Todas</option>` + [...new Set(state.products.map(p => p.category))].sort().map(c => `<option>${escapeHTML(c)}</option>`).join("");
  select.value = selected;
}

function filteredProducts() {
  const query = $("#globalSearch").value.trim().toLowerCase();
  const category = $("#categoryFilter").value; const status = $("#statusFilter").value;
  return state.products.filter(p => (!query || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query)) && (!category || p.category === category) && (!status || productStatus(p).key === status));
}

function renderProducts() {
  renderCategoryFilter();
  const products = filteredProducts(); setText("productCount", `${products.length} ${products.length === 1 ? "item" : "itens"}`);
  $("#productsTable tbody").innerHTML = products.map(p => {
    const status = productStatus(p); const age = daysBetween(p.purchaseDate); const expiry = daysToExpiry(p);
    const fill = clamp((p.stock / Math.max(p.initialStock, 1)) * 100, 0, 100);
    return `<tr><td class="product-cell"><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.sku)} • ${escapeHTML(p.location || "Sem localização")}</small></td><td>${escapeHTML(p.category)}</td><td>${shortDate.format(parseDate(p.purchaseDate))}</td><td><strong>${age} dias</strong></td><td class="stock-cell"><div class="stock-line"><strong>${integer.format(p.stock)} ${escapeHTML(p.unit)}</strong><small>mín. ${p.minimum}</small></div><div class="mini-progress"><span style="width:${fill}%;background:${p.stock <= p.minimum ? palette.red : palette.green}"></span></div></td><td class="number">${money.format(p.cost)}</td><td class="number">${money.format(p.price)}</td><td class="number positive">${percent.format(margin(p))}</td><td>${expiry === null ? "—" : `${shortDate.format(parseDate(p.expiryDate))}<br><small>${expiry < 0 ? `há ${Math.abs(expiry)} dias` : `em ${expiry} dias`}</small>`}</td><td><span class="tag ${status.cls}">${status.label}</span></td><td><div class="row-actions"><button data-edit-product="${p.id}" title="Editar">✎</button><button data-move-product="${p.id}" title="Movimentar">⇄</button><button data-delete-product="${p.id}" title="Excluir">×</button></div></td></tr>`;
  }).join("") || `<tr><td colspan="11" class="empty-state">Nenhum produto encontrado.</td></tr>`;
}

function filterMovements() {
  const type = $("#movementTypeFilter").value; const period = $("#movementPeriodFilter").value;
  return [...state.movements].filter(m => (!type || m.type === type) && (period === "all" || daysBetween(m.date) <= Number(period))).sort((a, b) => b.date.localeCompare(a.date));
}

function renderMovements() {
  const movements = filterMovements();
  const today = isoDate(); const todayRows = state.movements.filter(m => m.date === today);
  const todayIn = todayRows.filter(m => movementSign(m.type) > 0).reduce((s, m) => s + m.quantity, 0);
  const todayOut = todayRows.filter(m => movementSign(m.type) < 0).reduce((s, m) => s + m.quantity, 0);
  const monthSales = state.movements.filter(m => m.type === "Saída" && m.date.slice(0, 7) === today.slice(0, 7)).reduce((s, m) => s + m.quantity * m.unitValue, 0);
  const losses = state.movements.filter(m => m.type === "Perda" && m.date.slice(0, 7) === today.slice(0, 7)).reduce((s, m) => s + m.quantity * m.unitValue, 0);
  $("#movementKpis").innerHTML = [["Entradas hoje", `${todayIn} un.`], ["Saídas hoje", `${todayOut} un.`], ["Vendas no mês", money.format(monthSales)], ["Perdas no mês", money.format(losses)]].map(([label, value]) => `<div class="mini-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("#movementsTable tbody").innerHTML = movements.map(m => { const p = productById(m.productId); return `<tr><td>${shortDate.format(parseDate(m.date))}</td><td><strong>${escapeHTML(p?.name || "Produto removido")}</strong><br><small>${escapeHTML(p?.sku || "—")}</small></td><td>${movementBadge(m.type)}</td><td class="number">${integer.format(m.quantity)}</td><td class="number">${money.format(m.unitValue)}</td><td class="number"><strong>${money.format(m.quantity * m.unitValue)}</strong></td><td>${escapeHTML(m.note || "—")}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty-state">Nenhuma movimentação no filtro selecionado.</td></tr>`;
}

function renderExpiry() {
  const groups = { vencidos: [], sete: [], trinta: [], depois: [], sem: [] };
  state.products.forEach(p => { const d = daysToExpiry(p); if (d === null) groups.sem.push(p); else if (d < 0) groups.vencidos.push(p); else if (d <= 7) groups.sete.push(p); else if (d <= 30) groups.trinta.push(p); else groups.depois.push(p); });
  $("#expirySummary").innerHTML = [["Vencidos", groups.vencidos.length, "bad"], ["Até 7 dias", groups.sete.length, "warn"], ["De 8 a 30 dias", groups.trinta.length, ""], ["Acima de 30 dias", groups.depois.length, "good"]].map(([label, value, cls]) => `<div class="expiry-card"><span>${label}</span><strong class="${cls === "bad" ? "negative" : cls === "good" ? "positive" : ""}">${value}</strong></div>`).join("");
  $("#recommendations").innerHTML = [
    ["Bloqueie a venda de vencidos", `${groups.vencidos.length} produto(s) devem ser segregados e revisados.`],
    ["Priorize o FEFO", "Use primeiro os produtos cuja validade está mais próxima."],
    ["Crie uma ação comercial", `${groups.sete.length + groups.trinta.length} item(ns) podem receber desconto ou destaque.`]
  ].map(([title, note]) => `<div class="recommendation"><strong>${title}</strong><small>${note}</small></div>`).join("");
  const ordered = state.products.filter(p => p.expiryDate).sort((a, b) => daysToExpiry(a) - daysToExpiry(b));
  $("#expiryTable tbody").innerHTML = ordered.map(p => { const d = daysToExpiry(p); const cls = d < 0 ? "bad" : d <= 7 ? "warn" : d <= 30 ? "" : "good"; const label = d < 0 ? "Crítica" : d <= 7 ? "Alta" : d <= 30 ? "Média" : "Baixa"; return `<tr><td><strong>${escapeHTML(p.name)}</strong></td><td>${escapeHTML(p.sku)}</td><td>${shortDate.format(parseDate(p.expiryDate))}</td><td class="number ${d < 0 ? "negative" : ""}">${d < 0 ? `${Math.abs(d)} dias vencido` : `${d} dias`}</td><td class="number">${p.stock} ${escapeHTML(p.unit)}</td><td class="number">${money.format(Math.max(0, p.stock) * p.cost)}</td><td><span class="tag ${cls}">${label}</span></td></tr>`; }).join("") || `<tr><td colspan="7" class="empty-state">Nenhuma validade cadastrada.</td></tr>`;
  return groups;
}

function reportRows() {
  return state.products.map(p => {
    const sold = productSales(p.id); const revenue = productRevenue(p.id); const costSold = sold * p.cost; const profit = revenue - costSold; const giro = p.initialStock ? sold / p.initialStock : 0;
    return { product: p, age: daysBetween(p.purchaseDate), sold, revenue, costSold, profit, giro, realizedMargin: revenue ? profit / revenue : 0 };
  });
}

function renderReports() {
  const rows = reportRows(); const revenue = rows.reduce((s, r) => s + r.revenue, 0); const profit = rows.reduce((s, r) => s + r.profit, 0); const stockCost = state.products.reduce((s, p) => s + p.stock * p.cost, 0); const sold = rows.reduce((s, r) => s + r.sold, 0);
  $("#reportCards").innerHTML = [["Receita registrada", money.format(revenue)], ["Lucro bruto estimado", money.format(profit)], ["Capital em estoque", money.format(stockCost)], ["Unidades vendidas", integer.format(sold)]].map(([label, value]) => `<div class="report-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("#rankingList").innerHTML = [...rows].sort((a, b) => b.sold - a.sold).slice(0, 7).map((r, index) => `<div class="rank-item"><span class="rank-number">${index + 1}</span><div><strong>${escapeHTML(r.product.name)}</strong><small>${r.sold} ${escapeHTML(r.product.unit)} vendidas</small></div><span class="rank-value">${money.format(r.revenue)}</span></div>`).join("");
  $("#reportTable tbody").innerHTML = rows.map(r => `<tr><td><strong>${escapeHTML(r.product.name)}</strong></td><td>${r.age} dias</td><td class="number">${r.product.stock} ${escapeHTML(r.product.unit)}</td><td class="number">${r.sold}</td><td class="number">${percent.format(r.giro)}</td><td class="number">${money.format(r.revenue)}</td><td class="number">${money.format(r.costSold)}</td><td class="number ${r.profit >= 0 ? "positive" : "negative"}">${money.format(r.profit)}</td><td class="number">${percent.format(r.realizedMargin)}</td></tr>`).join("");
}

function setupCanvas(canvas) {
  if (!canvas || canvas.offsetParent === null) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); const rect = canvas.getBoundingClientRect(); const height = Number(canvas.getAttribute("height")) || rect.height || 250;
  canvas.width = Math.max(300, Math.floor(rect.width * dpr)); canvas.height = Math.floor(height * dpr); canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); return { ctx, width: canvas.width / dpr, height };
}

function drawLineChart(canvas, labels, series) {
  const setup = setupCanvas(canvas); if (!setup) return; const { ctx, width, height } = setup; const pad = { l: 42, r: 16, t: 18, b: 35 }; const chartW = width - pad.l - pad.r; const chartH = height - pad.t - pad.b;
  const max = Math.max(5, ...series.flatMap(s => s.values)); ctx.font = "11px Segoe UI"; ctx.fillStyle = palette.text; ctx.strokeStyle = palette.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pad.t + chartH * (i / 4); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); ctx.fillText(integer.format(max * (1 - i / 4)), 4, y + 4); }
  series.forEach(s => { ctx.strokeStyle = s.color; ctx.lineWidth = 2.4; ctx.beginPath(); s.values.forEach((v, i) => { const x = pad.l + (chartW * i / Math.max(1, labels.length - 1)); const y = pad.t + chartH - (v / max) * chartH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); s.values.forEach((v, i) => { const x = pad.l + (chartW * i / Math.max(1, labels.length - 1)); const y = pad.t + chartH - (v / max) * chartH; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2); ctx.fill(); }); });
  ctx.fillStyle = palette.text; ctx.textAlign = "center"; const step = labels.length > 20 ? 5 : labels.length > 14 ? 3 : 2; labels.forEach((label, i) => { if (i % step && i !== labels.length - 1) return; const x = pad.l + (chartW * i / Math.max(1, labels.length - 1)); ctx.fillText(label, x, height - 10); }); ctx.textAlign = "left";
}

function drawBarChart(canvas, labels, values, colors = palette.blue) {
  const setup = setupCanvas(canvas); if (!setup) return; const { ctx, width, height } = setup; const pad = { l: 42, r: 12, t: 15, b: 46 }; const max = Math.max(1, ...values); const chartW = width - pad.l - pad.r; const chartH = height - pad.t - pad.b; const slot = chartW / Math.max(1, values.length); const barW = Math.min(46, slot * .58);
  ctx.font = "10px Segoe UI"; ctx.strokeStyle = palette.grid; ctx.fillStyle = palette.text;
  for (let i = 0; i <= 4; i++) { const y = pad.t + chartH * (i / 4); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); ctx.fillText(integer.format(max * (1 - i / 4)), 3, y + 3); }
  values.forEach((value, i) => { const x = pad.l + slot * i + (slot - barW) / 2; const h = (value / max) * chartH; const y = pad.t + chartH - h; ctx.fillStyle = Array.isArray(colors) ? colors[i % colors.length] : colors; ctx.beginPath(); ctx.roundRect(x, y, barW, h, 5); ctx.fill(); ctx.save(); ctx.translate(pad.l + slot * i + slot / 2, height - 7); ctx.rotate(-.35); ctx.fillStyle = palette.text; ctx.textAlign = "right"; ctx.fillText(labels[i].length > 14 ? `${labels[i].slice(0, 13)}…` : labels[i], 0, 0); ctx.restore(); });
}

function drawDonut(canvas, items) {
  const setup = setupCanvas(canvas); if (!setup) return; const { ctx, width, height } = setup; const total = items.reduce((s, i) => s + i.value, 0) || 1; const radius = Math.min(width, height) * .34; const cx = width / 2, cy = height / 2; let angle = -Math.PI / 2;
  items.forEach(item => { const slice = (item.value / total) * Math.PI * 2; ctx.beginPath(); ctx.strokeStyle = item.color; ctx.lineWidth = 28; ctx.arc(cx, cy, radius, angle, angle + slice); ctx.stroke(); angle += slice; });
  ctx.textAlign = "center"; ctx.fillStyle = palette.navy; ctx.font = "700 27px Segoe UI"; ctx.fillText(String(items.reduce((s, i) => s + i.value, 0)), cx, cy + 4); ctx.fillStyle = palette.text; ctx.font = "11px Segoe UI"; ctx.fillText("produtos", cx, cy + 22); ctx.textAlign = "left";
}

function renderCharts() {
  if (currentView === "dashboard") {
    const labels = Array.from({ length: 14 }, (_, i) => offsetDate(i - 13));
    const entries = labels.map(date => state.movements.filter(m => m.date === date && movementSign(m.type) > 0).reduce((s, m) => s + m.quantity, 0));
    const outputs = labels.map(date => state.movements.filter(m => m.date === date && movementSign(m.type) < 0).reduce((s, m) => s + m.quantity, 0));
    drawLineChart($("#movementChart"), labels.map(d => d.slice(8)), [{ values: entries, color: palette.blue }, { values: outputs, color: palette.cyan }]);
    const statusItems = [
      { label: "Normal", key: "normal", color: palette.green }, { label: "Estoque baixo", key: "baixo", color: palette.amber }, { label: "Vencendo", key: "vencendo", color: palette.blue }, { label: "Crítico", keys: ["zerado", "vencido"], color: palette.red }
    ].map(item => ({ ...item, value: state.products.filter(p => item.keys ? item.keys.includes(productStatus(p).key) : productStatus(p).key === item.key).length }));
    drawDonut($("#statusChart"), statusItems); $("#statusLegend").innerHTML = statusItems.map(i => `<div><span class="dot" style="background:${i.color}"></span><span>${i.label}</span><strong>${i.value}</strong></div>`).join("");
    const categories = [...new Set(state.products.map(p => p.category))]; const values = categories.map(c => state.products.filter(p => p.category === c).reduce((s, p) => s + p.stock * p.cost, 0));
    drawBarChart($("#categoryChart"), categories, values, [palette.blue, palette.cyan, palette.green, palette.amber, palette.navy]);
  }
  if (currentView === "vencimentos") {
    const groups = renderExpiry(); drawBarChart($("#expiryChart"), ["Vencidos", "Até 7 dias", "8–30 dias", "> 30 dias", "Sem validade"], [groups.vencidos.length, groups.sete.length, groups.trinta.length, groups.depois.length, groups.sem.length], [palette.red, palette.amber, palette.blue, palette.green, palette.gray]);
  }
  if (currentView === "relatorios") {
    const labels = Array.from({ length: 31 }, (_, i) => offsetDate(i - 30));
    const sales = labels.map(date => state.movements.filter(m => m.date === date && m.type === "Saída").reduce((s, m) => s + m.quantity * m.unitValue, 0));
    drawLineChart($("#dailySalesChart"), labels.map(d => d.slice(8)), [{ values: sales, color: palette.blue }]);
  }
}

function renderAll() {
  renderNotices(); renderKpis(); renderActionList(); renderRecentMovements(); renderProducts(); renderMovements(); renderExpiry(); renderReports();
  requestAnimationFrame(renderCharts);
}

function openModal(id) {
  const modal = document.getElementById(id); if (!modal) return;
  if (id === "productModal" && !$("#productId").value) { $("#productForm").reset(); $("#productPurchase").value = isoDate(); $("#productModalTitle").textContent = "Novo produto"; }
  if (id === "movementModal") { populateMovementProducts(); $("#movementDate").value = isoDate(); }
  modal.classList.add("open"); setTimeout(() => $("input,select", modal)?.focus(), 50);
}
function closeModal(modal) { (typeof modal === "string" ? document.getElementById(modal) : modal.closest(".modal"))?.classList.remove("open"); }

function editProduct(id) {
  const p = productById(id); if (!p) return;
  const fields = { productId: p.id, productName: p.name, productSku: p.sku, productCategory: p.category, productSupplier: p.supplier, productUnit: p.unit, productCost: p.cost, productPrice: p.price, productInitial: p.initialStock, productMinimum: p.minimum, productPurchase: p.purchaseDate, productExpiry: p.expiryDate, productLocation: p.location };
  Object.entries(fields).forEach(([id, value]) => { document.getElementById(id).value = value ?? ""; });
  setText("productModalTitle", "Editar produto"); openModal("productModal");
}
function prepareMovement(id) { openModal("movementModal"); $("#movementProduct").value = id; updateMovementValue(); }
function populateMovementProducts() { const select = $("#movementProduct"); const selected = select.value; select.innerHTML = state.products.map(p => `<option value="${p.id}">${escapeHTML(p.sku)} — ${escapeHTML(p.name)} (${p.stock} ${escapeHTML(p.unit)})</option>`).join(""); if (selected && productById(selected)) select.value = selected; updateMovementValue(); }
function updateMovementValue() { const p = productById($("#movementProduct").value); const type = $("#movementType").value; if (p) $("#movementUnitValue").value = ["Entrada", "Ajuste +"].includes(type) ? p.cost : p.price; }

function handleProductSubmit(event) {
  event.preventDefault(); const id = $("#productId").value; const existing = productById(id);
  const product = { id: id || uid("p"), name: $("#productName").value.trim(), sku: $("#productSku").value.trim().toUpperCase(), category: $("#productCategory").value.trim(), supplier: $("#productSupplier").value.trim(), unit: $("#productUnit").value, cost: Number($("#productCost").value), price: Number($("#productPrice").value), initialStock: Number($("#productInitial").value), stock: existing ? existing.stock : Number($("#productInitial").value), minimum: Number($("#productMinimum").value), purchaseDate: $("#productPurchase").value, expiryDate: $("#productExpiry").value, location: $("#productLocation").value.trim() };
  if (state.products.some(p => p.sku.toLowerCase() === product.sku.toLowerCase() && p.id !== product.id)) return showToast("Já existe um produto com esse SKU.");
  if (product.price < product.cost) { if (!confirm("O preço de venda está abaixo do custo. Deseja salvar mesmo assim?")) return; }
  if (existing) Object.assign(existing, product); else state.products.push(product);
  saveState(); closeModal("productModal"); $("#productForm").reset(); showToast(existing ? "Produto atualizado." : "Produto cadastrado."); renderAll();
}

function handleMovementSubmit(event) {
  event.preventDefault(); const p = productById($("#movementProduct").value); if (!p) return showToast("Selecione um produto válido.");
  const type = $("#movementType").value; const quantity = Number($("#movementQuantity").value); const change = movementSign(type) * quantity;
  if (p.stock + change < 0) return showToast(`Saldo insuficiente. Estoque atual: ${p.stock} ${p.unit}.`);
  p.stock += change;
  state.movements.push({ id: uid("m"), productId: p.id, type, quantity, unitValue: Number($("#movementUnitValue").value || (change > 0 ? p.cost : p.price)), date: $("#movementDate").value, note: $("#movementNote").value.trim() });
  saveState(); closeModal("movementModal"); $("#movementForm").reset(); showToast("Movimentação registrada e saldo atualizado."); renderAll();
}

function deleteProduct(id) {
  const p = productById(id); if (!p || !confirm(`Excluir “${p.name}”? O histórico ficará identificado como produto removido.`)) return;
  state.products = state.products.filter(item => item.id !== id); saveState(); renderAll(); showToast("Produto excluído.");
}

function downloadFile(filename, content, mime = "text/plain;charset=utf-8") { const blob = new Blob([content], { type: mime }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
function csvEscape(value) { const text = String(value ?? ""); return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function exportCsv(filename, headers, rows) { const csv = "\ufeff" + [headers, ...rows].map(row => row.map(csvEscape).join(";")).join("\n"); downloadFile(filename, csv, "text/csv;charset=utf-8"); showToast("Arquivo CSV gerado."); }
function exportProducts() { exportCsv("produtos_estoque.csv", ["SKU", "Produto", "Categoria", "Fornecedor", "Unidade", "Custo", "Venda", "Estoque inicial", "Estoque atual", "Estoque mínimo", "Compra", "Dias corridos", "Validade", "Status"], state.products.map(p => [p.sku, p.name, p.category, p.supplier, p.unit, p.cost, p.price, p.initialStock, p.stock, p.minimum, p.purchaseDate, daysBetween(p.purchaseDate), p.expiryDate, productStatus(p).label])); }
function exportMovements() { exportCsv("movimentacoes_estoque.csv", ["Data", "SKU", "Produto", "Tipo", "Quantidade", "Valor unitário", "Total", "Observação"], filterMovements().map(m => { const p = productById(m.productId); return [m.date, p?.sku || "", p?.name || "Produto removido", m.type, m.quantity, m.unitValue, m.quantity * m.unitValue, m.note]; })); }
function exportReport() { exportCsv("relatorio_gerencial_estoque.csv", ["Produto", "SKU", "Comprado há (dias)", "Estoque", "Vendidas", "Giro", "Receita", "Custo vendido", "Lucro bruto", "Margem"], reportRows().map(r => [r.product.name, r.product.sku, r.age, r.product.stock, r.sold, r.giro, r.revenue, r.costSold, r.profit, r.realizedMargin])); }
function exportBackup() { downloadFile(`backup_estoque_${isoDate()}.json`, JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2), "application/json"); showToast("Backup completo exportado."); }

function restoreBackup(file) {
  const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.products) || !Array.isArray(data.movements)) throw new Error(); state = data; saveState(); renderAll(); showToast("Backup restaurado com sucesso."); } catch { showToast("O arquivo selecionado não é um backup válido."); } }; reader.readAsText(file);
}

function bindEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$('[data-go-view]').forEach(button => button.addEventListener("click", () => switchView(button.dataset.goView)));
  $$('[data-open-modal]').forEach(button => button.addEventListener("click", () => { $("#productId").value = ""; openModal(button.dataset.openModal); }));
  $$(".modal-close").forEach(button => button.addEventListener("click", () => closeModal(button)));
  $$(".modal").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) closeModal(modal); }));
  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#globalSearch").addEventListener("input", () => { renderProducts(); if (currentView !== "produtos" && $("#globalSearch").value.trim().length > 1) switchView("produtos"); });
  $("#categoryFilter").addEventListener("change", renderProducts); $("#statusFilter").addEventListener("change", renderProducts);
  $("#movementTypeFilter").addEventListener("change", renderMovements); $("#movementPeriodFilter").addEventListener("change", renderMovements);
  $("#productForm").addEventListener("submit", handleProductSubmit); $("#movementForm").addEventListener("submit", handleMovementSubmit);
  $("#movementProduct").addEventListener("change", updateMovementValue); $("#movementType").addEventListener("change", updateMovementValue);
  $("#productsTable tbody").addEventListener("click", event => { const edit = event.target.closest("[data-edit-product]"); const move = event.target.closest("[data-move-product]"); const del = event.target.closest("[data-delete-product]"); if (edit) editProduct(edit.dataset.editProduct); if (move) prepareMovement(move.dataset.moveProduct); if (del) deleteProduct(del.dataset.deleteProduct); });
  $("#backupButton").addEventListener("click", exportBackup); $("#restoreButton").addEventListener("click", () => $("#restoreInput").click()); $("#restoreInput").addEventListener("change", event => { if (event.target.files[0]) restoreBackup(event.target.files[0]); event.target.value = ""; });
  $("#exportProductsCsv").addEventListener("click", exportProducts); $("#exportMovementsCsv").addEventListener("click", exportMovements); $("#exportReportCsv").addEventListener("click", exportReport); $("#printReport").addEventListener("click", () => window.print());
  document.addEventListener("keydown", event => { if (event.key === "Escape") $$(".modal.open").forEach(closeModal); });
  let resizeTimer; window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderCharts, 160); });
}

bindEvents(); updateHeader(); renderAll();
