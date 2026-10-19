"use strict";

// Os dados desta área vêm das movimentações locais. Não há fontes externas conectadas.
const TREND_EVENT_TYPES = {
  campanha: ["Propaganda", "📣"], promocao: ["Promoção", "🏷️"],
  sazonalidade: ["Época do ano", "📅"], concorrencia: ["Concorrência", "🏬"],
  clima: ["Clima", "☀️"], fornecedor: ["Fornecedor", "📦"], outro: ["Outro evento", "✦"]
};
const trendSum = (items, f = x => x) => items.reduce((sum, x) => sum + (Number(f(x)) || 0), 0);
const trendFormat = x => integer.format(x);
const trendDateLabel = d => d ? shortDate.format(parseDate(d)) : "—";
const trendDateStep = (date, days) => { const d = parseDate(date); d.setDate(d.getDate() + days); return isoDate(d); };
const trendSales = productId => state.movements.filter(m => m.productId === productId && m.type === "Saída");
const trendEntries = productId => state.movements.filter(m => m.productId === productId && m.type === "Entrada");
const trendDays = (start, end) => {
  const dates = []; let d = start;
  while (d <= end && dates.length < 366) { dates.push(d); d = trendDateStep(d, 1); }
  return dates;
};
const trendRange = (items, start, end) => items.filter(m => m.date >= start && m.date <= end);
const trendVolume = items => trendSum(items, m => m.quantity);
const trendAverage = items => items.length ? trendSum(items) / items.length : 0;
function trendProfile(productId, length = 28) {
  const end = isoDate();
  const labels = Array.from({length}, (_, index) => offsetDate(index - length + 1));
  const mid = length / 2;
  const olderDates = labels.slice(0, mid);
  const newerDates = labels.slice(mid);
  const sales = trendSales(productId);
  const entries = trendEntries(productId);
  const salesDaily = labels.map(d => trendVolume(sales.filter(m => m.date === d)));
  const entryDaily = labels.map(d => trendVolume(entries.filter(m => m.date === d)));
  const beforeSales = trendVolume(trendRange(sales, olderDates[0], olderDates.at(-1)));
  const afterSales = trendVolume(trendRange(sales, newerDates[0], end));
  const afterEntries = trendVolume(trendRange(entries, newerDates[0], end));
  const currentSalesDays = new Set(trendRange(sales, newerDates[0], end).map(m => m.date)).size;
  const previousSalesDays = new Set(trendRange(sales, olderDates[0], olderDates.at(-1)).map(m => m.date)).size;
  const allSalesDays = new Set(trendRange(sales, labels[0], end).map(m => m.date)).size;
  const avg14 = trendVolume(trendRange(sales, offsetDate(-13), end)) / 14;
  const product = productById(productId);
  const coverage = avg14 > 0 ? (product?.stock || 0) / avg14 : null;
  const rate = beforeSales > 0 ? (afterSales - beforeSales) / beforeSales : null;
  const salesByDate = new Map();
  sales.filter(m => m.date >= labels[0] && m.date <= end).forEach(m => {
    const day = salesByDate.get(m.date) || {date:m.date, quantity:0, revenue:0};
    day.quantity += Number(m.quantity) || 0;
    day.revenue += (Number(m.quantity) || 0) * (Number(m.unitValue) || 0);
    salesByDate.set(m.date, day);
  });
  const pricePoints = [...salesByDate.values()].filter(x => x.quantity > 0)
    .sort((a,b) => a.date.localeCompare(b.date)).map(x => ({...x, price: x.revenue / x.quantity}));
  return {labels, salesDaily, entryDaily, sales, entries, beforeSales, afterSales, afterEntries,
    currentSalesDays, previousSalesDays, allSalesDays, avg14, coverage, rate, pricePoints, product, mid, end, length};
}
function trendPearson(xs, ys) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const mx = trendAverage(xs), my = trendAverage(ys);
  const cov = trendSum(xs.map((x,i) => (x-mx)*(ys[i]-my)));
  const vx = trendSum(xs.map(x => (x-mx)**2));
  const vy = trendSum(ys.map(y => (y-my)**2));
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : null;
}
function trendPriceResult(profile) {
  const points = profile.pricePoints;
  if (points.length < 6) return {valid:false, text:`São necessários ao menos 6 dias com saídas; há ${points.length} no período.`};
  const prices = points.map(p => p.price);
  const spread = (Math.max(...prices) - Math.min(...prices)) / Math.max(.01, trendAverage(prices));
  if (spread < .05) return {valid:false,text:"Os preços registrados variaram menos de 5%. Não é possível avaliar a relação preço × volume com segurança."};
  const r = trendPearson(prices, points.map(p => p.quantity));
  if (r === null) return {valid:false,text:"As quantidades não apresentam variação suficiente para calcular a correlação."};
  const sign = r < -.25 ? "inversa" : r > .25 ? "direta" : "fraca ou indefinida";
  return {valid:true,r,sign,text:`Correlação exploratória ${sign} (r = ${r.toFixed(2).replace('.',',')}) em ${points.length} dias com saídas. Isso não mede causalidade nem elasticidade do preço.`};
}
function renderHomeTrend() {
  const summary = document.getElementById("homeTrendText");
  if (!summary) return;
  if (!state.products.length) { summary.textContent = "Cadastre produtos e registre saídas para começar a comparar a demanda e a oferta."; return; }
  // Agregação única, mesmo em catálogos grandes. Metades de 14 dias.
  const cut = offsetDate(-13), beginning = offsetDate(-27), today = isoDate();
  const productTotals = new Map();
  state.movements.forEach(m => {
    if (m.type !== "Saída" || m.date < beginning || m.date > today) return;
    const info = productTotals.get(m.productId) || { before:0, now:0, daysBefore:new Set(), daysNow:new Set() };
    if (m.date < cut) { info.before += Number(m.quantity)||0; info.daysBefore.add(m.date); }
    else { info.now += Number(m.quantity)||0; info.daysNow.add(m.date); }
    productTotals.set(m.productId, info);
  });
  let best = null;
  state.products.forEach(p => {
    const t = productTotals.get(p.id);
    if (!t || t.before < 2 || t.now < 2 || t.daysBefore.size < 3 || t.daysNow.size < 3) return;
    const change = (t.now-t.before)/t.before;
    if (change >= .15 && (!best || change > best.change)) best = { product:p, change };
  });
  if (best) summary.textContent = `${best.product.name}: ${Math.round(best.change*100)}% mais saídas nos últimos 14 dias que nos 14 anteriores. É um sinal observado, não uma previsão garantida.`;
  else summary.textContent = "Acompanhe produtos específicos: compare as saídas, a reposição, o preço praticado e os eventos externos registrados.";
}
function trendMetric(label, value, note, variant = "") {
  return `<article class="trend-metric ${variant}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></article>`;
}
function trendDirection(p) {
  if (p.allSalesDays < 3 || p.currentSalesDays < 3 || p.previousSalesDays < 3) return {label:"Amostra limitada",className:"neutral",text:`Há ${p.previousSalesDays} dia(s) com saídas no período anterior e ${p.currentSalesDays} no atual. A variação pode ser efeito de poucos registros; registre mais vendas antes de concluir que existe uma tendência.`};
  if (p.beforeSales === 0 && p.afterSales === 0) return {label:"Sem movimento",className:"neutral",text:"Não há saídas registradas nos dois períodos comparados."};
  if (p.beforeSales === 0) return {label:"Retomada",className:"up",text:"Existem saídas no período atual, mas não no anterior. Uma variação percentual não seria comparável."};
  if (p.rate >= .15) return {label:"Em alta",className:"up",text:`As saídas cresceram ${Math.round(p.rate*100)}% entre as metades do período.`};
  if (p.rate <= -.15) return {label:"Em queda",className:"down",text:`As saídas caíram ${Math.round(Math.abs(p.rate)*100)}% entre as metades do período.`};
  return {label:"Estável",className:"neutral",text:"A variação das saídas ficou dentro de ±15% no recorte analisado."};
}
function trendInsight(icon, heading, content, tone = "") {
  return `<div class="trend-insight ${tone}"><span class="trend-insight-icon">${icon}</span><div><strong>${escapeHTML(heading)}</strong><p>${escapeHTML(content)}</p></div></div>`;
}
function trendSeason(p) {
  const month = new Date().toLocaleString("pt-BR", {month:"long"});
  const events = state.events.filter(e => (e.productId === p.product.id || e.productId === "all") && e.type === "sazonalidade");
  const olderSales = p.sales.filter(m => m.date.slice(0,4) <= String(new Date().getFullYear()-1));
  const insights=[];
  insights.push(trendInsight("📅",`Período atual: ${month}`, "Anote feriados, férias, campanhas de estação ou datas comerciais relevantes para este produto."));
  if (olderSales.length) {
    const date = new Date(); const year = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,"0");
    const until=String(date.getDate()).padStart(2,"0");
    const current=trendVolume(p.sales.filter(x => x.date >= `${year}-${m}-01` && x.date <= `${year}-${m}-${until}`));
    const past=trendVolume(p.sales.filter(x => x.date >= `${year-1}-${m}-01` && x.date <= `${year-1}-${m}-${until}`));
    insights.push(trendInsight("↗","Mesmo mês do ano passado",past ? `${trendFormat(current)} unidades neste mês até o dia ${date.getDate()}, contra ${trendFormat(past)} no mesmo intervalo do ano anterior. Comparação ainda pode ser afetada pelo estoque disponível.` : "Há histórico antigo, mas não existem saídas no mesmo intervalo do ano anterior para comparar."));
  } else {
    insights.push(trendInsight("◷", "Histórico sazonal insuficiente", "Ainda não há vendas registradas no ano anterior. Comparar a sazonalidade exige histórico em anos diferentes, preferencialmente vários ciclos."));
  }
  insights.push(trendInsight("✦", "Eventos sazonais anotados",`${events.length} registro(s) sazonal(is) para este produto. Campanhas, feriados e condições externas precisam ser informados manualmente.`));
  return insights.join("");
}
function renderTrends() {
  const select = document.getElementById("trendProduct"); if (!select) return;
  const previous = select.value;
  select.innerHTML = state.products.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.sku)})</option>`).join("");
  if (previous && state.products.some(p => p.id === previous)) select.value = previous;
  if (!state.products.length) {
    $("#trendMetrics").innerHTML = trendMetric("Começar análise", "Sem produtos", "Cadastre um produto para analisar suas saídas.");
    $("#trendInsights").innerHTML = trendInsight("ℹ", "Nenhum produto cadastrado", "A análise é gerada depois de cadastrar produtos e registrar movimentações.");
    $("#trendSeasonality").innerHTML = "";
    $("#trendEventList").innerHTML = '<div class="trend-empty">Nenhum produto cadastrado.</div>';
    return;
  }
  const p = trendProfile(select.value, Number($("#trendPeriod").value));
  const direction = trendDirection(p);
  const diff = p.rate == null ? "Não comparável" : `${p.rate >= 0 ? "+" : "−"}${Math.round(Math.abs(p.rate)*100)}%`;
  const evolutionNote = p.previousSalesDays < 3 || p.currentSalesDays < 3 ? `${trendFormat(p.beforeSales)} un. antes · amostra limitada` : `${trendFormat(p.beforeSales)} un. no período anterior`;
  const coverage = p.coverage == null ? "Sem referência" : `${Math.round(p.coverage)} dias`;
  $("#trendMetrics").innerHTML = [
    trendMetric("Demanda observada · período atual",`${trendFormat(p.afterSales)} un.`,`${p.mid} dias mais recentes · ${p.currentSalesDays} com saídas`,"accent"),
    trendMetric("Evolução da demanda",diff,evolutionNote,direction.className),
    trendMetric("Oferta · entradas atuais",`${trendFormat(p.afterEntries)} un.`,`Comparação entre entrada e saída registrada`),
    trendMetric("Cobertura estimada",coverage,`${trendFormat(p.product.stock)} ${p.product.unit} em estoque · média de 14 dias`,"coverage")
  ].join("");
  const price = trendPriceResult(p);
  const insights = [trendInsight("↗",`Demanda: ${direction.label}`, direction.text,direction.className)];
  if (p.afterEntries < p.afterSales) insights.push(trendInsight("📦", "Saídas maiores que reposições", `Saíram ${trendFormat(p.afterSales)} un. e entraram ${trendFormat(p.afterEntries)} un. no período atual. Isso pode exigir reposição se o ritmo persistir.`, "warning"));
  else insights.push(trendInsight("✓", "Reposição no período", `Foram registradas ${trendFormat(p.afterEntries)} entradas e ${trendFormat(p.afterSales)} saídas. A entrada não significa necessariamente venda futura.`));
  if (p.coverage != null && p.coverage < 7) insights.push(trendInsight("!", "Cobertura curta", `No ritmo médio de saídas dos últimos 14 dias, o saldo equivale a cerca de ${Math.round(p.coverage)} dia(s). Este número é indicativo.`, "warning"));
  else if (p.product.stock === 0) insights.push(trendInsight("!", "Produto sem estoque", "Sem estoque, a demanda real pode estar subestimada: o sistema só observa saídas atendidas.", "warning"));
  else insights.push(trendInsight("◷", "Estimativa orientativa", p.coverage == null ? "Não houve saídas nos últimos 14 dias para calcular a cobertura." : `A cobertura estimada de ${Math.round(p.coverage)} dias pressupõe que o ritmo recente continue, o que pode não ocorrer.`));
  insights.push(trendInsight("R$", "Preço e volume", price.text));
  $("#trendInsights").innerHTML = insights.join("");
  $("#trendSeasonality").innerHTML = trendSeason(p);
  renderTrendEvents(p.product.id);
}
function trendEventComparison(event) {
  const last = isoDate();
  if (event.startDate > last) return "Evento futuro: comparação disponível quando houver histórico.";
  const observedEnd = event.endDate < last ? event.endDate : last;
  const duration = trendDays(event.startDate, observedEnd).length;
  if (duration < 3) return "Aguarde pelo menos 3 dias observados para comparar.";
  const beforeStart = trendDateStep(event.startDate, -duration);
  const beforeEnd = trendDateStep(event.startDate, -1);
  const sales=trendSales(event.productId);
  const during=trendVolume(trendRange(sales,event.startDate,observedEnd));
  const before=trendVolume(trendRange(sales,beforeStart,beforeEnd));
  if (!before) return `Período anterior: 0 un.; durante o evento: ${trendFormat(during)} un. Sem base para calcular a variação percentual.`;
  const delta=Math.round((during-before)/before*100);
  return `Saídas em períodos iguais de ${duration} dia(s): ${trendFormat(before)} → ${trendFormat(during)} un. (${delta>=0?'+':''}${delta}%). Associação observada, não prova de efeito.`;
}
function renderTrendEvents(productId) {
  const list=$("#trendEventList");
  const events=state.events.filter(e => e.productId === productId).sort((a,b) => b.startDate.localeCompare(a.startDate));
  list.innerHTML=events.map(e => {
    const kind=TREND_EVENT_TYPES[e.type] || TREND_EVENT_TYPES.outro;
    const expectancy={aumento:"Possível alta", queda:"Possível queda",incerto:"Sem direção definida"}[e.expectation]||"Sem direção definida";
    return `<article class="trend-event"><div class="trend-event-badge">${kind[1]}</div><div class="trend-event-body"><div class="trend-event-meta"><span>${escapeHTML(kind[0])}</span><span>${trendDateLabel(e.startDate)} até ${trendDateLabel(e.endDate)}</span><span>${expectancy}</span></div><strong>${escapeHTML(e.title)}</strong>${e.note ? `<p>${escapeHTML(e.note)}</p>` : ""}<small>${escapeHTML(trendEventComparison(e))}</small></div><button type="button" class="trend-event-remove" data-remove-trend-event="${escapeHTML(e.id)}" aria-label="Excluir evento ${escapeHTML(e.title)}" title="Excluir este evento">×</button></article>`;
  }).join("") || `<div class="trend-empty">Nenhum evento registrado para este produto. Experimente cadastrar uma campanha, promoção ou data sazonal acima.</div>`;
}
function trendCanvasPrice(profile) {
  const canvas=$("#trendPriceChart"), graph=setupCanvas(canvas); if (!graph) return;
  const {ctx,width,height}=graph;
  const points=profile.pricePoints;
  const pad={l:width<440?45:56,r:22,t:17,b:36};
  const w=width-pad.l-pad.r,h=height-pad.t-pad.b;
  const prices=points.map(p=>p.price), units=points.map(p=>p.quantity);
  const minPrice=Math.max(0,(Math.min(...prices)||0)*.88);
  const maxPrice=Math.max(minPrice+1,(Math.max(...prices)||0)*1.1);
  const ymax=axisRange(units,"quantity").max;
  ctx.font="600 10px Segoe UI";
  for(let i=0;i<=5;i++){
    const y=pad.t+i*h/5;
    ctx.strokeStyle="#e4edf5";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();
    ctx.fillStyle="#60768c";ctx.textAlign="right";ctx.fillText(compactNumber(ymax*(1-i/5),"quantity"),pad.l-9,y+3);
    const price=minPrice+(maxPrice-minPrice)*i/5;
    const x=pad.l+i*w/5;
    ctx.fillStyle="#60768c";ctx.textAlign="center";ctx.fillText(`R$ ${price.toLocaleString('pt-BR',{maximumFractionDigits:2})}`,x,height-14);
  }
  ctx.fillStyle="#1682d7";
  points.forEach(p=>{
    const x=pad.l+(p.price-minPrice)/(maxPrice-minPrice)*w;
    const y=pad.t+h-p.quantity/ymax*h;
    ctx.beginPath();ctx.arc(x,y,4.3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#ffffff";ctx.lineWidth=1.3;ctx.stroke();
  });
  if (!points.length){ctx.font="12px Segoe UI";ctx.textAlign="center";ctx.fillStyle="#617993";ctx.fillText("Sem saídas para mostrar preço e volume",pad.l+w/2,pad.t+h/2);}
  ctx.textAlign="left";
  const result=trendPriceResult(profile);
  $("#trendPriceNote").textContent= result.text + " • Cada ponto azul representa um dia com saídas registradas.";
}
function drawTrendCharts(){
  const id=$("#trendProduct").value;if(!id||!productById(id))return;
  const p=trendProfile(id,Number($("#trendPeriod").value));
  drawLineChart($("#trendFlowChart"),p.labels.map(d=>d.slice(5).replace('-', '/')),
    [{values:p.salesDaily,color:palette.blue},{values:p.entryDaily,color:palette.cyan}],"quantity");
  const axis=axisRange(p.salesDaily.concat(p.entryDaily),"quantity");
  $("#trendFlowNote").textContent=`Eixo vertical: 0 a ${trendFormat(axis.max)} unidades. As vendas são aproximação da demanda atendida; ajustes e perdas não entram neste gráfico.`;
  trendCanvasPrice(p);
}
function bindTrendEvents(){
  $("#trendProduct").addEventListener("change", () => {renderTrends();requestAnimationFrame(renderCharts);});
  $("#trendPeriod").addEventListener("change", () => {renderTrends();requestAnimationFrame(renderCharts);});
  $("#trendEventStart").value=isoDate();$("#trendEventEnd").value=isoDate();
  $("#trendEventForm").addEventListener("submit",async event=>{
    event.preventDefault();if(!guard('trends_write'))return;
    const productId=$("#trendProduct").value;
    if(!productById(productId))return showToast("Selecione um produto cadastrado.");
    const payload={productId,title:$("#trendEventTitle").value.trim(),startDate:$("#trendEventStart").value,endDate:$("#trendEventEnd").value,type:$("#trendEventType").value,expectation:$("#trendEventExpectation").value,note:$("#trendEventNote").value.trim()};
    if(!payload.title||payload.endDate<payload.startDate)return showToast('Revise o nome e as datas.');
    if(await updateFromServer('POST','/events',payload)){
      $("#trendEventForm").reset();$("#trendEventStart").value=isoDate();$("#trendEventEnd").value=isoDate();showToast('Evento cadastrado.');
    }
  });
  $("#trendEventList").addEventListener("click",async event=>{
    const button=event.target.closest('[data-remove-trend-event]');if(!button||!guard('trends_write'))return;
    if(!confirm('Excluir este evento de tendências?'))return;
    if(await updateFromServer('DELETE','/events/'+encodeURIComponent(button.dataset.removeTrendEvent)))showToast('Evento excluído.');
  });
}
