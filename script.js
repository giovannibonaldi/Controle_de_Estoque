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

function normalizeProductShape(product) {
  if (product.seasonal === undefined) product.seasonal = false;
  if (product.alertMuted === undefined) product.alertMuted = false;
  return product;
}
function normalizeStateShape(data) {
  if (!Array.isArray(data.events)) data.events = [];
  data.products = (data.products || []).map(normalizeProductShape);
  return data;
}

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
    purchaseDate: offsetDate(p[10]), expiryDate: p[11] === null ? "" : offsetDate(p[11]), location: p[12], seasonal: false, alertMuted: false
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
  return { products, movements, events: [], createdAt: new Date().toISOString() };
}

function loadState(){return {products:[],movements:[],events:[],createdAt:new Date().toISOString()}}

let state = loadState();
let currentView = "dashboard";

function saveState(){throw new Error('Use a API do servidor para alterar dados.')}
function productById(id) { return state.products.find(product => product.id === id); }
function margin(product) { return product.cost > 0 ? (product.price / product.cost) - 1 : 0; }
function expiryDays(product) { return product.expiryDate ? -daysBetween(new Date(), parseDate(product.expiryDate)) : null; }
function daysToExpiry(product) {
  if (!product.expiryDate) return null;
  return Math.ceil((parseDate(product.expiryDate) - new Date(new Date().setHours(12, 0, 0, 0))) / 86400000);
}
function productStatus(product) {
  if(product.trackStock===false)return {key:"normal",label:"Sem controle",cls:"muted"};
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
function isMuted(product) { return !!product?.alertMuted; }
function seasonalLabel(product) { return product?.seasonal ? '<span class="tag seasonal">Sazonal</span>' : ''; }
function recentAverageDemand(productId, days = 14) {
  const start = offsetDate(-(days - 1));
  const end = isoDate();
  const total = state.movements.filter(m => m.productId === productId && m.type === "Saída" && m.date >= start && m.date <= end).reduce((sum, m) => sum + Number(m.quantity || 0), 0);
  return total / days;
}
function daysOfCoverage(product) {
  const avg = recentAverageDemand(product.id, 14);
  return avg > 0 ? product.stock / avg : null;
}
function alertPriority(product) {
  if(product.trackStock===false && !product.seasonal)return null;
  const coverage = daysOfCoverage(product);
  if (product.stock <= 0) return { level: 'critical', label: 'Reposição urgente', reason: 'Produto sem estoque', coverage };
  if (coverage !== null && coverage <= 3) return { level: 'critical', label: 'Risco muito alto', reason: `Cobertura estimada de ${Math.max(0, Math.round(coverage))} dia(s)`, coverage };
  if (product.stock <= product.minimum) return { level: 'warning', label: 'Pode acabar logo', reason: `Saldo ${product.stock} ${product.unit} · mínimo ${product.minimum}`, coverage };
  if (coverage !== null && coverage <= 7) return { level: 'warning', label: 'Pode acabar logo', reason: `Cobertura estimada de ${Math.max(0, Math.round(coverage))} dia(s)`, coverage };
  if (product.seasonal) return { level: 'seasonal', label: 'Produto sazonal', reason: 'Perfil sazonal cadastrado', coverage };
  return null;
}
function alertItems(includeMuted = false) {
  return state.products.map(product => ({ product, status: productStatus(product), alert: alertPriority(product) }))
    .filter(item => item.alert && (includeMuted || !isMuted(item.product)));
}

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function updateHeader() {
  setText("todayLabel", longDate.format(new Date()));
  const titles = { usuarios: "Usuários e permissões", dashboard: "Painel do estoque", produtos: "Cadastro e saldo de produtos", movimentacoes: "Movimentações do estoque", vencimentos: "Controle de vencimentos", alertas: "Alertas e reposição", relatorios: "Relatórios gerenciais", tendencias: "Tendências por produto" };
  setText("viewTitle", titles[currentView]);
}

function switchView(view) {
  if (view === "usuarios" && !can("users_manage")) return showToast("Acesso restrito a administradores.");
  if (view === "usuarios") refreshUsers().catch(err => showToast(err.message));
  currentView = view;
  $$(".view").forEach(section => section.classList.toggle("active", section.id === view));
  $$(".nav-item").forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  updateHeader();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderNotices() {
  const low = state.products.filter(p => !isMuted(p) && p.stock <= p.minimum && p.stock > 0).length;
  const zero = state.products.filter(p => !isMuted(p) && p.stock <= 0).length;
  const expiring = state.products.filter(p => !isMuted(p) && (() => { const d = daysToExpiry(p); return d !== null && d >= 0 && d <= 7; })()).length;
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
  const alerts = state.products.filter(p => !isMuted(p) && productStatus(p).key !== "normal").length;
  setText("kpiProducts", state.products.length);
  setText("kpiProductsNote", `${new Set(state.products.map(p => p.category)).size} categorias cadastradas`);
  setText("kpiUnits", integer.format(units));
  setText("kpiUnitsNote", `${money.format(costValue)} investidos`);
  setText("kpiSaleValue", money.format(saleValue));
  setText("kpiMarginNote", `Estimativa se todo o estoque for vendido • acréscimo médio de ${percent.format(avgMargin)} sobre o custo`);
  setText("kpiAlerts", alerts);
  setText("kpiAlertsNote", alerts ? "Revise os itens prioritários" : "Nenhuma ocorrência crítica");
  const normal = state.products.filter(p => productStatus(p).key === "normal").length;
  const score = state.products.length ? Math.round((normal / state.products.length) * 100) : 100;
  setText("healthScore", `${score}%`); $("#healthBar").style.width = `${score}%`;
}

function renderHomeSummary() {
  const count = state.products.length;
  const attention = state.products.filter(p => !isMuted(p) && productStatus(p).key !== "normal");
  const critical = attention.filter(p => ["vencido", "zerado"].includes(productStatus(p).key)).length;
  const dueSoon = state.products.filter(p => { const days = daysToExpiry(p); return days !== null && days >= 0 && days <= 7; }).length;
  const summary = !count
    ? "Seu painel está pronto! Cadastre um produto para começar a acompanhar saldos, vencimentos e resultados."
    : critical
    ? `Você tem ${integer.format(count)} produtos cadastrados e ${critical} situação${critical === 1 ? " crítica" : "es críticas"} para conferir agora. ${dueSoon ? `${dueSoon} produto(s) também vence(m) em até 7 dias.` : "Veja a lista de prioridades logo abaixo."}`
    : attention.length
    ? `Você acompanha ${integer.format(count)} produtos. ${attention.length} precisa(m) de atenção por quantidade ou validade. Consulte as prioridades abaixo.`
    : `Seus ${integer.format(count)} produtos estão sem alertas neste momento. Continue registrando entradas e saídas para manter os dados atualizados.`;
  setText("homeSummary", summary);
}

function renderActionList() {
  const items = [...state.products].filter(p => !isMuted(p) && productStatus(p).key !== "normal").sort((a, b) => {
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
    return `<tr><td class="product-cell"><span class="table-product-pic">${productImageMarkup(p)}</span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.sku)} • ${escapeHTML(p.location || "Sem localização")}</small></td><td>${escapeHTML(p.category)}</td><td>${shortDate.format(parseDate(p.purchaseDate))}</td><td><strong>${age} dias</strong></td><td class="stock-cell"><div class="stock-line"><strong>${integer.format(p.stock)} ${escapeHTML(p.unit)}</strong><small>mín. ${p.minimum}</small></div><div class="mini-progress"><span style="width:${fill}%;background:${p.stock <= p.minimum ? palette.red : palette.green}"></span></div></td><td class="number">${money.format(p.cost)}</td><td class="number">${money.format(p.price)}</td><td class="number positive">${percent.format(margin(p))}</td><td>${expiry === null ? "—" : `${shortDate.format(parseDate(p.expiryDate))}<br><small>${expiry < 0 ? `há ${Math.abs(expiry)} dias` : `em ${expiry} dias`}</small>`}</td><td><span class="tag ${status.cls}">${status.label}</span> ${seasonalLabel(p)}</td><td><div class="row-actions"><button data-edit-product="${p.id}" title="Editar">✎</button><button data-move-product="${p.id}" title="Movimentar">⇄</button><button data-delete-product="${p.id}" title="Excluir">×</button></div></td></tr>`;
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
  $("#movementsTable tbody").innerHTML = movements.map(m => { const p = productById(m.productId); return `<tr><td>${shortDate.format(parseDate(m.date))}</td><td><strong>${escapeHTML(p?.name || "Produto removido")}</strong><br><small>${escapeHTML(p?.sku || "—")}</small></td><td>${movementBadge(m.type)}</td><td class="number">${integer.format(m.quantity)}</td><td class="number">${money.format(m.unitValue)}</td><td class="number"><strong>${money.format(m.quantity * m.unitValue)}</strong></td><td>${escapeHTML(m.note || "—")}</td><td><div class="row-actions"><button class="table-action" data-edit-movement="${m.id}" title="Corrigir movimentação">Editar</button><button class="table-action danger" data-delete-movement="${m.id}" title="Excluir movimentação">Excluir</button></div></td></tr>`; }).join("") || `<tr><td colspan="8" class="empty-state">Nenhuma movimentação no filtro selecionado.</td></tr>`;
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

// Escalas automáticas: degraus legíveis, unidades inteiras e valores em R$ abreviados.
// Determina um teto arredondado e legível, sem cortar picos do período.
function axisRange(numbers, type = "quantity", minimumMax = 0) {
  const peak = Math.max(0, ...numbers.map(n => Number(n) || 0));
  if (minimumMax > 0 && peak <= minimumMax) return { max: minimumMax, steps: 5 };
  if (peak === 0 && minimumMax === 0) return { max: type === "money" ? 5 : 5, steps: 5 };
  const target = (Math.max(peak * 1.12, minimumMax)) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const steps = [1, 1.25, 1.5, 2, 2.5, 4, 5, 10];
  const candidate = steps.find(factor => factor * magnitude >= target) || 10;
  const tick = type === "quantity" ? Math.max(1, Math.ceil(candidate * magnitude)) : candidate * magnitude;
  return { max: Math.max(minimumMax, tick * 5), steps: 5 };
}

function compactNumber(value, type = "quantity") {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (type === "money") {
    if (abs >= 100000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
    return money.format(value);
  }
  if (abs >= 1000000) return `${(value / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 100000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function axisTickLabels(values, type = "quantity", minimumMax = 0) {
  const axis = axisRange(values, type, minimumMax);
  return {
    max: axis.max,
    steps: axis.steps,
    labels: Array.from({ length: axis.steps + 1 }, (_, i) => compactNumber(axis.max * (1 - i / axis.steps), type))
  };
}

function setupCanvas(canvas) {
  if (!canvas || canvas.offsetParent === null) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 60) return null;
  const cssWidth = Math.max(60, Math.round(rect.width));
  const cssHeight = Math.max(120, Number(canvas.getAttribute("height")) || 200);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight };
}

function drawGrid(ctx, width, height, pad, values, format = "quantity", minAxis = 0) {
  const axis = axisTickLabels(values, format, minAxis);
  const graphH = height - pad.t - pad.b;
  ctx.font = "600 11px Segoe UI, sans-serif";
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  for (let i = 0; i <= axis.steps; i++) {
    const y = pad.t + graphH * i / axis.steps;
    ctx.beginPath(); ctx.strokeStyle = palette.grid;
    ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    ctx.fillStyle = "#5a7289";
    ctx.fillText(axis.labels[i], pad.l - 10, y);
  }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  return axis.max;
}

function chartPadding(ctx, values, format, bottom = 33, minAxis = 0) {
  const axis = axisTickLabels(values, format, minAxis);
  ctx.font = "600 11px Segoe UI, sans-serif";
  const tickWidth = Math.max(...axis.labels.map(label => ctx.measureText(label).width));
  return { l: Math.max(52, Math.ceil(tickWidth) + 16), r: 18, t: 14, b: bottom };
}

function drawLineChart(canvas, labels, series, valueType = "quantity", minAxis = 0) {
  const setup = setupCanvas(canvas); if (!setup) return;
  const { ctx, width, height } = setup;
  const values = series.flatMap(s => s.values);
  const pad = chartPadding(ctx, values, valueType, 31, minAxis);
  const graphW = Math.max(1, width - pad.l - pad.r);
  const graphH = height - pad.t - pad.b;
  const max = drawGrid(ctx, width, height, pad, values, valueType, minAxis);
  series.forEach(s => {
    if (!s.values.length) return;
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = pad.l + graphW * i / Math.max(1, labels.length - 1);
      const y = pad.t + graphH - Math.max(0, v) / max * graphH;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
    s.values.forEach((v, i) => {
      if (labels.length > 15 && i % Math.ceil(labels.length / 15) && i !== labels.length - 1) return;
      const x = pad.l + graphW * i / Math.max(1, labels.length - 1);
      const y = pad.t + graphH - Math.max(0, v) / max * graphH;
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
    });
  });
  ctx.font = "600 11px Segoe UI, sans-serif"; ctx.fillStyle = "#5a7289"; ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(graphW / 56))));
  labels.forEach((label, i) => {
    if (i % step && i !== labels.length - 1) return;
    ctx.fillText(label, pad.l + graphW * i / Math.max(1, labels.length - 1), height - 9);
  });
  if (values.every(v => !v)) {
    ctx.textAlign = "center"; ctx.font = "12px Segoe UI"; ctx.fillStyle = palette.text;
    ctx.fillText("Nenhuma movimentação no período", pad.l + graphW / 2, pad.t + graphH / 2 - 14);
  }
  ctx.textAlign = "left";
}

function drawBarChart(canvas, labels, values, colors = palette.blue, valueType = "quantity") {
  const setup = setupCanvas(canvas); if (!setup) return;
  const { ctx, width, height } = setup;
  const pad = chartPadding(ctx, values, valueType, 51);
  const graphW = Math.max(1, width - pad.l - pad.r);
  const graphH = height - pad.t - pad.b;
  const max = drawGrid(ctx, width, height, pad, values, valueType);
  const slot = graphW / Math.max(1, values.length);
  const barW = Math.min(39, slot * .56);
  values.forEach((value, i) => {
    const x = pad.l + slot * i + (slot - barW) / 2;
    const h = Math.max(0, value) / max * graphH;
    const y = pad.t + graphH - h;
    ctx.fillStyle = Array.isArray(colors) ? colors[i % colors.length] : colors;
    if (h > 0) {
      ctx.beginPath(); ctx.roundRect(x, y, barW, h, Math.min(5, h / 2)); ctx.fill();
    }
    ctx.save();
    ctx.translate(pad.l + slot * i + slot / 2, height - 7);
    ctx.rotate(width < 430 ? -Math.PI / 7 : -Math.PI / 10);
    ctx.fillStyle = "#425a73"; ctx.font = "700 11px Segoe UI"; ctx.textAlign = "right";
    const name = String(labels[i]);
    const limit = width < 440 ? 10 : 15;
    ctx.fillText(name.length > limit ? name.slice(0, limit - 1) + "…" : name, 0, 0);
    ctx.restore();
  });
  if (!values.length || values.every(v => !v)) {
    ctx.fillStyle = palette.text; ctx.textAlign = "center"; ctx.font = "12px Segoe UI";
    ctx.fillText("Nenhum valor registrado", pad.l + graphW / 2, pad.t + graphH / 2 - 12);
  }
}

// Barras horizontais para categorias: rótulos inteiros e eixo compacto, sem sobreposição.
function drawHorizontalBarChart(canvas, labels, values, colors, valueType = "money") {
  const setup = setupCanvas(canvas); if (!setup) return;
  const { ctx, width, height } = setup;
  const pad = { l: width < 460 ? 96 : 132, r: width < 460 ? 72 : 102, t: 11, b: 32 };
  const graphW = Math.max(45, width - pad.l - pad.r);
  const graphH = height - pad.t - pad.b;
  const range = axisRange(values, valueType);
  ctx.font = "700 11px Segoe UI";
  for (let i = 0; i <= range.steps; i++) {
    const x = pad.l + graphW * i / range.steps;
    ctx.strokeStyle = palette.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, height - pad.b + 2); ctx.stroke();
    ctx.fillStyle = "#4f6882"; ctx.textAlign = "center"; ctx.font = "700 11px Segoe UI";
    ctx.fillText(compactNumber(range.max * i / range.steps, valueType), x, height - 8);
  }
  if (!values.length) { ctx.fillStyle = palette.text; ctx.textAlign = "center"; ctx.fillText("Nenhuma categoria cadastrada", width / 2, height / 2); return; }
  const slot = graphH / values.length;
  labels.forEach((label, i) => {
    const centerY = pad.t + i * slot + slot / 2;
    const value = Math.max(0, values[i]);
    const barHeight = Math.max(10, Math.min(18, slot * .62));
    const barWidth = value / range.max * graphW;
    ctx.fillStyle = "#425a73"; ctx.font = "700 11px Segoe UI"; ctx.textAlign = "right";
    let display = String(label);
    while (display.length > 2 && ctx.measureText(display).width > pad.l - 15) display = display.slice(0, -1);
    if (display !== String(label)) display = display.slice(0, -1) + "…";
    ctx.fillText(display, pad.l - 9, centerY + 3.5);
    if (value) { ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.roundRect(pad.l, centerY - barHeight / 2, Math.max(1, barWidth), barHeight, 4); ctx.fill(); }
    ctx.textAlign = "right"; ctx.fillStyle = palette.navy; ctx.font = "800 11px Segoe UI";
    ctx.fillText(compactNumber(value, valueType), width - 3, centerY + 3.5);
  });
  ctx.textAlign = "left";
}

// Barras em HTML: os rótulos e valores permanecem legíveis em qualquer resolução.
function renderCategoryBars(groups, metric) {
  const holder = document.getElementById("categoryBars");
  if (!holder) return;
  const isMoney = metric !== "units";
  const format = number => isMoney ? money.format(number) : `${integer.format(number)} un.`;
  if (!groups.length) { holder.innerHTML = '<p class="empty-state">Cadastre produtos para comparar as categorias.</p>'; return; }
  const maxValue = Math.max(1, ...groups.map(group => Number(group.value) || 0));
  const colors = ["#2673cc", "#159fb4", "#7268ce", "#e69b40", "#459a89", "#8b9aaf"];
  const rows = groups.map((group, index) => {
    const ratio = Math.max(0, Number(group.value) || 0) / maxValue * 100;
    return `<div class="category-bar-row">
      <div class="category-bar-info"><strong title="${escapeHTML(group.label)}">${escapeHTML(group.label)}</strong><span>${format(group.value)}</span></div>
      <div class="category-bar-track" aria-label="${escapeHTML(group.label)}: ${format(group.value)}"><span style="width:${ratio}%;background:${colors[index % colors.length]}"></span></div>
    </div>`;
  }).join("");
  holder.innerHTML = `<div class="category-chart-head"><span>Categoria</span><span>${isMoney ? "Custo do estoque" : "Unidades em estoque"}</span></div>${rows}
    <div class="category-axis"><span>0</span><span>${format(maxValue / 2)}</span><span>${format(maxValue)}</span></div>`;
  holder.setAttribute("aria-label", `Comparação entre ${groups.length} categorias por ${isMoney ? "custo em reais" : "quantidade em unidades"}. Valores mostrados por categoria.`);
}

function drawDonut(canvas, items) {
  const setup = setupCanvas(canvas); if (!setup) return;
  const { ctx, width, height } = setup;
  const total = items.reduce((s, i) => s + i.value, 0);
  const radius = Math.min(width, height) * .34;
  const cx = width / 2, cy = height / 2;
  let angle = -Math.PI / 2;
  if (!total) { ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = palette.grid; ctx.lineWidth = 18; ctx.stroke(); }
  items.forEach(item => {
    if (!item.value) return;
    const slice = item.value / total * Math.PI * 2;
    ctx.beginPath(); ctx.strokeStyle = item.color; ctx.lineWidth = 18;
    ctx.arc(cx, cy, radius, angle, angle + slice); ctx.stroke(); angle += slice;
  });
  ctx.textAlign = "center"; ctx.fillStyle = palette.navy;
  ctx.font = "700 25px Segoe UI"; ctx.fillText(String(total), cx, cy + 4);
  ctx.fillStyle = palette.text; ctx.font = "10px Segoe UI"; ctx.fillText("produtos", cx, cy + 19);
  ctx.textAlign = "left";
}

function limitCategories(groups, limit = 5) {
  const sorted = [...groups].sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  return [...sorted.slice(0, limit), { label: "Outras", value: sorted.slice(limit).reduce((s, item) => s + item.value, 0) }];
}

function renderCharts() {
  if (currentView === "dashboard") {
    const countDays = Number($("#chartPeriod").value) || 14;
    const metric = $("#movementMetric").value;
    const labels = Array.from({ length: countDays }, (_, i) => offsetDate(i - (countDays - 1)));
    const incoming = labels.map(date => state.movements.filter(m => m.date === date && movementSign(m.type) > 0).reduce((sum, m) => sum + (metric === "money" ? m.quantity * m.unitValue : m.quantity), 0));
    const outgoing = labels.map(date => state.movements.filter(m => m.date === date && movementSign(m.type) < 0).reduce((sum, m) => sum + (metric === "money" ? m.quantity * m.unitValue : m.quantity), 0));
    const axisSelect = $("#unitAxisScale");
    const isUnits = metric === "quantity";
    $("#unitAxisControl").hidden = !isUnits;
    const preferredScale = axisSelect.value === "auto" ? 0 : Number(axisSelect.value) || 50;
    const allValues = incoming.concat(outgoing);
    const chartAxisMax = axisRange(allValues, isUnits ? "quantity" : "money", isUnits ? preferredScale : 0).max;
    drawLineChart($("#movementChart"), labels.map(date => date.slice(5).replace("-", "/")), [{ values: incoming, color: palette.blue }, { values: outgoing, color: palette.cyan }], isUnits ? "quantity" : "money", isUnits ? preferredScale : 0);
    const sumIncoming = incoming.reduce((sum, v) => sum + v, 0);
    const sumOutgoing = outgoing.reduce((sum, v) => sum + v, 0);
    setText("chartIncomingTotal", isUnits ? `${integer.format(sumIncoming)} un.` : money.format(sumIncoming));
    setText("chartOutgoingTotal", isUnits ? `${integer.format(sumOutgoing)} un.` : money.format(sumOutgoing));
    setText("movementChartHint", isUnits
      ? `Escala atual de 0 a ${integer.format(chartAxisMax)} unidades. Você pode escolher 50, 100, 250, 500, 1.000 ou automática; os números do eixo aparecem completos para facilitar a leitura.`
      : `Escala de 0 a ${money.format(chartAxisMax)}; entradas usam custo e saídas usam valor informado na movimentação.`);
    const statusItems = [
      { label: "Normal", key: "normal", color: palette.green },
      { label: "Estoque baixo", key: "baixo", color: palette.amber },
      { label: "Vencendo", key: "vencendo", color: palette.blue },
      { label: "Crítico", keys: ["zerado", "vencido"], color: palette.red }
    ].map(item => ({ ...item, value: state.products.filter(p => item.keys ? item.keys.includes(productStatus(p).key) : productStatus(p).key === item.key).length }));
    drawDonut($("#statusChart"), statusItems);
    $("#statusLegend").innerHTML = statusItems.map(item => `<div><span class="dot" style="background:${item.color}"></span><span>${item.label}</span><strong>${item.value}</strong></div>`).join("");

    const categoryMode = $("#categoryMetric").value;
    const categoryLabels = [...new Set(state.products.map(p => p.category))];
    const groups = limitCategories(categoryLabels.map(label => ({ label, value: state.products.filter(p => p.category === label).reduce((sum, p) => sum + (categoryMode === "units" ? p.stock : p.stock * p.cost), 0) })));
    renderCategoryBars(groups, categoryMode);
  }
  if (currentView === "vencimentos") {
    const groups = renderExpiry();
    drawBarChart($("#expiryChart"), ["Vencidos", "Até 7 dias", "8–30 dias", "> 30 dias", "Sem validade"], [groups.vencidos.length, groups.sete.length, groups.trinta.length, groups.depois.length, groups.sem.length], [palette.red, palette.amber, palette.blue, palette.green, palette.gray]);
  }
  if (currentView === "tendencias") drawTrendCharts();
  if (currentView === "relatorios") {
    const labels = Array.from({ length: 31 }, (_, i) => offsetDate(i - 30));
    const sales = labels.map(date => state.movements.filter(m => m.date === date && m.type === "Saída").reduce((sum, m) => sum + m.quantity * m.unitValue, 0));
    drawLineChart($("#dailySalesChart"), labels.map(date => date.slice(5).replace("-", "/")), [{ values: sales, color: palette.blue }], "money");
  }
}

function renderAlerts() {
  const summary = $("#alertsSummary");
  const list = $("#alertsAllList");
  const mutedList = $("#alertsMutedList");
  if (!summary || !list || !mutedList) return;
  const active = alertItems(false);
  const muted = state.products.filter(product => product.alertMuted).map(product => ({ product, alert: alertPriority(product), status: productStatus(product) })).filter(item => item.alert);
  const critical = active.filter(item => item.alert.level === "critical");
  const warning = active.filter(item => item.alert.level === "warning");
  const seasonal = state.products.filter(p => p.seasonal).length;
  summary.innerHTML = [["Reposição urgente", critical.length, "Itens sem estoque ou com cobertura muito curta"], ["Pode acabar logo", warning.length, "Itens abaixo do mínimo ou com poucos dias de cobertura"], ["Sazonais", seasonal, "Produtos marcados como sazonais"], ["Ignorados", muted.length, "Alertas pausados temporariamente"]].map(([label, value, note]) => `<article class="alert-summary-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
  const priorityOrder = { critical: 0, warning: 1, seasonal: 2 };
  const sorted = [...active].sort((a, b) => priorityOrder[a.alert.level] - priorityOrder[b.alert.level] || a.product.name.localeCompare(b.product.name));
  list.innerHTML = sorted.map(({ product, alert, status }) => {
    const coverage = alert.coverage == null ? 'Sem referência recente' : `${Math.max(0, Math.round(alert.coverage))} dia(s) de cobertura`;
    const expiry = daysToExpiry(product);
    const expiryNote = expiry === null ? 'Sem validade cadastrada' : expiry < 0 ? `Validade vencida há ${Math.abs(expiry)} dia(s)` : `Validade em ${expiry} dia(s)`;
    return `<article class="alert-card ${alert.level}"><div class="alert-card-main"><div class="alert-card-top"><div><h3>${escapeHTML(product.name)}</h3><small>${escapeHTML(product.sku)} • ${escapeHTML(product.category)} ${product.seasonal ? '• sazonal' : ''}</small></div><div class="alert-badges"><span class="tag ${status.cls}">${status.label}</span>${product.seasonal ? '<span class="tag seasonal">Sazonal</span>' : ''}<span class="tag ${alert.level === 'critical' ? 'bad' : alert.level === 'warning' ? 'warn' : 'info'}">${alert.label}</span></div></div><div class="alert-card-data"><span><strong>${integer.format(product.stock)} ${escapeHTML(product.unit)}</strong><small>saldo atual</small></span><span><strong>${integer.format(product.minimum)}</strong><small>estoque mínimo</small></span><span><strong>${coverage}</strong><small>estimativa</small></span><span><strong>${expiryNote}</strong><small>validade</small></span></div><p class="alert-reason">${escapeHTML(alert.reason)}</p></div><div class="alert-actions"><button class="button primary small" data-move-product="${product.id}">Repor agora</button><button class="button secondary small" data-toggle-product-alert="${product.id}">${product.alertMuted ? 'Voltar a alertar' : 'Ignorar alerta'}</button><button class="button ghost small" data-toggle-seasonal="${product.id}">${product.seasonal ? 'Remover sazonal' : 'Marcar sazonal'}</button><button class="button ghost danger small" data-delete-product="${product.id}">Excluir produto</button></div></article>`;
  }).join("") || `<div class="empty-state">Nenhum alerta acionável no momento.</div>`;
  mutedList.innerHTML = muted.map(({ product, alert }) => `<article class="alert-muted-item"><div><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(alert?.label || 'Alerta pausado')} • ${escapeHTML(product.sku)}</small></div><div class="alert-actions inline"><button class="button secondary small" data-toggle-product-alert="${product.id}">Voltar a alertar</button><button class="button ghost small" data-toggle-seasonal="${product.id}">${product.seasonal ? 'Remover sazonal' : 'Marcar sazonal'}</button></div></article>`).join("") || `<div class="empty-state">Nenhum alerta ignorado.</div>`;
}

async function deleteMovement(id){
  if(!guard('movements_delete'))return;
  if(!state.movements.some(m=>m.id===id)||!confirm('Excluir esta movimentação? O servidor vai desfazer o ajuste no estoque.'))return;
  if(await updateFromServer('DELETE','/movements/'+encodeURIComponent(id)))showToast('Movimentação excluída com saldo recalculado.');
}

async function toggleProductAlert(id){
  if(!guard('alerts_write'))return;const p=productById(id);if(!p)return;
  if(await updateFromServer('PATCH','/alerts/'+encodeURIComponent(id),{alertMuted:!p.alertMuted}))showToast(p.alertMuted?'Alerta ignorado.':'Alerta reativado.');
}

async function toggleProductSeasonal(id){
  if(!guard('alerts_write'))return;const p=productById(id);if(!p)return;
  if(await updateFromServer('PATCH','/alerts/'+encodeURIComponent(id),{seasonal:!p.seasonal}))showToast('Perfil sazonal atualizado.');
}

function renderAll() {
  renderHomeSummary(); renderNotices(); renderKpis(); renderActionList(); renderRecentMovements(); renderProducts(); renderMovements(); renderExpiry(); renderAlerts(); renderReports(); renderHomeTrend(); renderTrends();
  const banner=document.getElementById('demoBanner');if(banner)banner.hidden=!state.demo;const demoReset=document.getElementById('resetDemoButton');if(demoReset)demoReset.hidden=!authUser||authUser.role!=='admin';
  requestAnimationFrame(renderCharts);
  if (authUser) applyUIRights();
  if (typeof renderPDV === "function") renderPDV();
}

function openModal(id) {
  if (!guard(id === "productModal" ? "products_write" : "movements_write")) return;
  const modal = document.getElementById(id); if (!modal) return;
  if (id === "productModal" && !$("#productId").value) { $("#productForm").reset();$("#productSeasonal").value="nao";$("#productPurchase").value=isoDate();$("#productWholesaleMinQty").value=6;$("#productId").value="";$("#productModalTitle").textContent="Novo produto";showProductImagePreview();refreshProductMargin(); }
  if (id === "movementModal") { $("#movementId").value = ""; $("#movementForm").reset(); populateMovementProducts(); $("#movementDate").value = isoDate(); $("#movementModalTitle").textContent = "Registrar movimentação"; }
  modal.classList.add("open"); setTimeout(() => $("input,select", modal)?.focus(), 50);
}
function closeModal(modal) { (typeof modal === "string" ? document.getElementById(modal) : modal.closest(".modal"))?.classList.remove("open"); }

function safeProductImage(value){
  return typeof value==='string' && (/^https:\/\//i.test(value) || /^data:image\/(png|jpeg|webp);base64,/i.test(value)) ? value : '';
}
function productImageMarkup(product,cls=''){
  const src=safeProductImage(product?.imageUrl);
  return src ? `<img class="${cls}" src="${escapeHTML(src)}" loading="lazy" referrerpolicy="no-referrer" alt="Foto de ${escapeHTML(product.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="fallback-image" hidden>📦</span>` : `<span class="fallback-image">📦</span>`;
}
function showProductImagePreview(){
  const src=safeProductImage($('#productImageUrl').value.trim());
  const img=$('#productImagePreview');img.hidden=!src;
  if(src)img.src=src;else img.removeAttribute('src');
  $('#productImageEmpty').hidden=!!src;
}
function editProduct(id) {
 const p=productById(id);if(!p)return;
 const fields={productId:p.id,productName:p.name,productSku:p.sku,productBarcode:p.barcode||'',productBrand:p.brand||'',
  productCategory:p.category,productGroup:p.group||'',productSubgroup:p.subgroup||'',productSupplier:p.supplier||'',
  productUnit:p.unit,productSize:p.size||'',productPackaging:p.packaging||'',productCost:p.cost,productPrice:p.price,
  productCashPrice:p.cashPrice??p.price,productInstallmentPrice:p.installmentPrice??p.price,
  productWholesalePrice:p.wholesalePrice??p.price,productWholesaleMinQty:p.wholesaleMinQty??0,
  productCommission:p.commissionPercent??0,productPromoPrice:p.promoPrice??p.price,productPromoStart:p.promoStart||'',productPromoEnd:p.promoEnd||'',
  productInitial:p.initialStock,productMinimum:p.minimum,productTrackStock:p.trackStock===false?'nao':'sim',
  productUseScale:p.useScale?'sim':'nao',productSeasonal:p.seasonal?'sim':'nao',productShowPDV:p.showInPDV===false?'nao':'sim',
  productIndividual:p.sellIndividually===false?'nao':'sim',productPdvTableMode:p.pdvTableMode?'sim':'nao',productPurchase:p.purchaseDate,productExpiry:p.expiryDate||'',
  productLocation:p.location||'',productNote:p.note||'',productIngredients:p.ingredients||'',
  productImageUrl:p.imageUrl||'',productImageCredit:p.imageCredit||''};
 Object.entries(fields).forEach(([key,value])=>{const el=document.getElementById(key);if(el)el.value=value??''});
 showProductImagePreview();refreshProductMargin();$('#productImageFile').value='';
 setText('productModalTitle','Editar produto');openModal('productModal');
}
function refreshProductMargin(){
 const cost=Number($('#productCost').value)||0,price=Number($('#productPrice').value)||0;
 const profit=price-cost;
 setText('productProfitPreview',money.format(profit));
 setText('productProfitPercentPreview',cost>0 ? `${(profit/cost*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% sobre o custo`:'Defina o custo para calcular.');
}
async function loadProductPhoto(file){
 if(!file)return; if(!/^image\/(jpeg|png|webp)$/.test(file.type))return showToast('Selecione uma foto JPG, PNG ou WebP.');
 if(file.size>7*1024*1024)return showToast('Imagem original muito grande (máximo 7 MB).');
 const reader=new FileReader();reader.onload=()=>{
  const temp=new Image();temp.onload=()=>{
   const factor=Math.min(1,720/Math.max(temp.naturalWidth,temp.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(temp.naturalWidth*factor));canvas.height=Math.max(1,Math.floor(temp.naturalHeight*factor));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(temp,0,0,canvas.width,canvas.height);
   const out=canvas.toDataURL('image/jpeg',0.76);
   if(out.length>840000)return showToast('Imagem ainda muito grande. Use foto menor.');
   $('#productImageUrl').value=out;$('#productImageCredit').value='Foto enviada pelo usuário';showProductImagePreview();
  };temp.src=reader.result;
 };reader.readAsDataURL(file);
}

function prepareMovement(id) { openModal("movementModal"); $("#movementProduct").value = id; updateMovementValue(); }
function editMovement(id){
  if(!guard('movements_write'))return;const m=state.movements.find(x=>x.id===id);if(!m)return;
  openModal('movementModal');$('#movementId').value=m.id;$('#movementProduct').value=m.productId;
  $('#movementType').value=m.type;$('#movementQuantity').value=m.quantity;$('#movementDate').value=m.date;
  $('#movementUnitValue').value=m.unitValue;$('#movementNote').value=m.note||'';
  $('#movementModalTitle').textContent='Corrigir movimentação';
}
function populateMovementProducts() { const select = $("#movementProduct"); const selected = select.value; select.innerHTML = state.products.map(p => `<option value="${p.id}">${escapeHTML(p.sku)} — ${escapeHTML(p.name)} (${p.stock} ${escapeHTML(p.unit)})</option>`).join(""); if (selected && productById(selected)) select.value = selected; updateMovementValue(); }
function updateMovementValue() { const p = productById($("#movementProduct").value); const type = $("#movementType").value; if (p) $("#movementUnitValue").value = ["Entrada", "Ajuste +"].includes(type) ? p.cost : p.price; }

async function handleProductSubmit(event){
  event.preventDefault();if(!guard('products_write'))return;
  const id=$('#productId').value,existing=productById(id);
  const product={name:$('#productName').value.trim(),sku:$('#productSku').value.trim().toUpperCase(),barcode:$('#productBarcode').value.trim(),brand:$('#productBrand').value.trim(),
  category:$('#productCategory').value.trim(),group:$('#productGroup').value.trim(),subgroup:$('#productSubgroup').value.trim(),supplier:$('#productSupplier').value.trim(),
  unit:$('#productUnit').value,size:$('#productSize').value.trim(),packaging:$('#productPackaging').value.trim(),
  cost:Number($('#productCost').value),price:Number($('#productPrice').value),cashPrice:Number($('#productCashPrice').value||$('#productPrice').value),
  installmentPrice:Number($('#productInstallmentPrice').value||$('#productPrice').value),wholesalePrice:Number($('#productWholesalePrice').value||$('#productPrice').value),
  wholesaleMinQty:Number($('#productWholesaleMinQty').value||0),commissionPercent:Number($('#productCommission').value||0),
  promoPrice:Number($('#productPromoPrice').value||$('#productPrice').value),promoStart:$('#productPromoStart').value,promoEnd:$('#productPromoEnd').value,
  initialStock:Number($('#productInitial').value),minimum:Number($('#productMinimum').value),
  trackStock:$('#productTrackStock').value==='sim',useScale:$('#productUseScale').value==='sim',seasonal:$('#productSeasonal').value==='sim',
  showInPDV:$('#productShowPDV').value==='sim',sellIndividually:$('#productIndividual').value==='sim',pdvTableMode:$('#productPdvTableMode').value==='sim',
  purchaseDate:$('#productPurchase').value,expiryDate:$('#productExpiry').value,location:$('#productLocation').value.trim(),
  ingredients:$('#productIngredients').value.trim(),note:$('#productNote').value.trim(),
  imageUrl:$('#productImageUrl').value.trim(),imageCredit:$('#productImageCredit').value.trim()}
  if(product.price<product.cost&&!confirm('Preço de venda abaixo do custo. Deseja continuar?'))return;
  if(await updateFromServer(existing?'PUT':'POST',existing?'/products/'+encodeURIComponent(id):'/products',product)){
    closeModal('productModal');$('#productId').value='';$('#productForm').reset();showToast(existing?'Produto atualizado.':'Produto cadastrado.');
  }
}

async function handleMovementSubmit(event){
  event.preventDefault();if(!guard('movements_write'))return;
  const p=productById($('#movementProduct').value);if(!p)return showToast('Selecione um produto.');
  const type=$('#movementType').value,quantity=Number($('#movementQuantity').value);
  const movement={productId:p.id,type,quantity,unitValue:Number($('#movementUnitValue').value||(['Entrada','Ajuste +'].includes(type)?p.cost:p.price)),date:$('#movementDate').value,note:$('#movementNote').value.trim()};
  const editing=$('#movementId').value;
  if(await updateFromServer(editing?'PUT':'POST',editing?'/movements/'+encodeURIComponent(editing):'/movements',movement)){
    closeModal('movementModal');$('#movementForm').reset();showToast(editing?'Movimentação corrigida e saldo atualizado.':'Movimentação registrada e saldo atualizado.');
  }
}

async function deleteProduct(id){
  if(!guard('products_delete'))return;const p=productById(id);
  if(!p||!confirm(`Excluir ${p.name}? O histórico ficará como produto removido.`))return;
  if(await updateFromServer('DELETE','/products/'+encodeURIComponent(id)))showToast('Produto excluído.');
}

function downloadFile(filename, content, mime = "text/plain;charset=utf-8") { const blob = new Blob([content], { type: mime }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
function csvEscape(value) { const text = String(value ?? ""); return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function exportCsv(filename, headers, rows) { const csv = "\ufeff" + [headers, ...rows].map(row => row.map(csvEscape).join(";")).join("\n"); downloadFile(filename, csv, "text/csv;charset=utf-8"); showToast("Arquivo CSV gerado."); }
function exportProducts() { exportCsv("produtos_estoque.csv", ["SKU", "Produto", "Categoria", "Fornecedor", "Unidade", "Custo", "Venda", "Estoque inicial", "Estoque atual", "Estoque mínimo", "Perfil", "Compra", "Dias corridos", "Validade", "Status"], state.products.map(p => [p.sku, p.name, p.category, p.supplier, p.unit, p.cost, p.price, p.initialStock, p.stock, p.minimum, p.seasonal ? "Sazonal" : "Regular", p.purchaseDate, daysBetween(p.purchaseDate), p.expiryDate, productStatus(p).label])); }
function exportMovements() { exportCsv("movimentacoes_estoque.csv", ["Data", "SKU", "Produto", "Tipo", "Quantidade", "Valor unitário", "Total", "Observação"], filterMovements().map(m => { const p = productById(m.productId); return [m.date, p?.sku || "", p?.name || "Produto removido", m.type, m.quantity, m.unitValue, m.quantity * m.unitValue, m.note]; })); }
function exportReport() { exportCsv("relatorio_gerencial_estoque.csv", ["Produto", "SKU", "Comprado há (dias)", "Estoque", "Vendidas", "Giro", "Receita", "Custo vendido", "Lucro bruto", "Margem"], reportRows().map(r => [r.product.name, r.product.sku, r.age, r.product.stock, r.sold, r.giro, r.revenue, r.costSold, r.profit, r.realizedMargin])); }
async function exportBackup(){
  if(!guard('backup_export'))return;
  try{const data=await appApi('/backup');downloadFile(`backup_estoque_${isoDate()}.json`,JSON.stringify(data,null,2),'application/json');showToast('Backup completo exportado.');}catch(err){showToast(err.message)}
}

function restoreBackup(file){
  if(!guard('backup_import'))return;
  const reader=new FileReader();reader.onload=async()=>{
    try{const data=JSON.parse(reader.result);if(!Array.isArray(data.products)||!Array.isArray(data.movements))throw new Error('Backup inválido.');
      if(!confirm('Restaurar este backup? Todos os produtos e movimentações atuais serão substituídos (contas de usuário permanecem).'))return;
      if(await updateFromServer('POST','/restore',data))showToast('Backup restaurado.');
    }catch(err){showToast(err.message)}
  };reader.readAsText(file);
}

function bindEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$('[data-go-view]').forEach(button => button.addEventListener("click", () => switchView(button.dataset.goView)));
  $$('[data-open-modal]').forEach(button => button.addEventListener("click", () => { $("#productId").value = ""; openModal(button.dataset.openModal); }));
  $$(".modal-close").forEach(button => button.addEventListener("click", () => closeModal(button)));
  $$(".modal").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) closeModal(modal); }));
  $("#homeLink").addEventListener("click", event => { event.preventDefault(); switchView("dashboard"); });
  $("#globalSearch").addEventListener("input", () => { renderProducts(); if (currentView !== "produtos" && $("#globalSearch").value.trim().length > 1) switchView("produtos"); });
  $("#categoryFilter").addEventListener("change", renderProducts); $("#statusFilter").addEventListener("change", renderProducts);
  $("#movementTypeFilter").addEventListener("change", renderMovements); $("#movementPeriodFilter").addEventListener("change", renderMovements);
  ['productCost','productPrice'].forEach(id=>$('#'+id).addEventListener('input',refreshProductMargin));
  $('#productImageUrl').addEventListener('input',showProductImagePreview);
  $('#productImageFile').addEventListener('change',e=>loadProductPhoto(e.target.files?.[0]));
  $("#productForm").addEventListener("submit", handleProductSubmit); $("#movementForm").addEventListener("submit", handleMovementSubmit);
  ["chartPeriod", "movementMetric", "categoryMetric", "unitAxisScale"].forEach(id => document.getElementById(id)?.addEventListener("change", renderCharts));
  $("#movementProduct").addEventListener("change", updateMovementValue); $("#movementType").addEventListener("change", updateMovementValue);
  $("#productsTable tbody").addEventListener("click", event => { const edit = event.target.closest("[data-edit-product]"); const move = event.target.closest("[data-move-product]"); const del = event.target.closest("[data-delete-product]"); if (edit) editProduct(edit.dataset.editProduct); if (move) prepareMovement(move.dataset.moveProduct); if (del) deleteProduct(del.dataset.deleteProduct); });
  $("#movementsTable tbody").addEventListener("click", event => { const edit=event.target.closest("[data-edit-movement]");const del = event.target.closest("[data-delete-movement]");if(edit)editMovement(edit.dataset.editMovement);if (del) deleteMovement(del.dataset.deleteMovement); });
  ["#alertsAllList", "#alertsMutedList"].forEach(selector => $(selector)?.addEventListener("click", event => { const move = event.target.closest("[data-move-product]"); const mute = event.target.closest("[data-toggle-product-alert]"); const seasonal = event.target.closest("[data-toggle-seasonal]"); const del = event.target.closest("[data-delete-product]"); if (move) prepareMovement(move.dataset.moveProduct); if (mute) toggleProductAlert(mute.dataset.toggleProductAlert); if (seasonal) toggleProductSeasonal(seasonal.dataset.toggleSeasonal); if (del) deleteProduct(del.dataset.deleteProduct); }));
  document.getElementById('resetDemoButton')?.addEventListener('click',async()=>{
   if(!authUser||authUser.role!=='admin')return showToast('Apenas administradores.');
   if(!confirm('Esta ação substituirá TODOS os produtos e movimentações do banco atual por dados fictícios. Faça Backup antes! Deseja continuar?'))return;
   if(!confirm('Confirma reiniciar os 20 produtos e 12 meses de dados demonstrativos?'))return;
   const ok=await updateFromServer('POST','/demo/reset',{confirmation:'RESTAURAR DEMONSTRACAO'});if(ok)showToast('Base de demonstração restaurada.');
  });
  $("#backupButton").addEventListener("click", exportBackup); $("#restoreButton").addEventListener("click", () => $("#restoreInput").click()); $("#restoreInput").addEventListener("change", event => { if (event.target.files[0]) restoreBackup(event.target.files[0]); event.target.value = ""; });
  $("#exportProductsCsv").addEventListener("click", exportProducts); $("#exportMovementsCsv").addEventListener("click", exportMovements); $("#exportReportCsv").addEventListener("click", exportReport); $("#printReport").addEventListener("click", () => window.print());
  bindTrendEvents();
  document.addEventListener("keydown", event => { if (event.key === "Escape") $$(".modal.open").forEach(closeModal); });
  let resizeTimer; window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderCharts, 160); });
}

bindEvents(); beginAuth();
