"use strict";
/* Frente de caixa / layout operacional — sem dependências. Toda gravação é autorizada no servidor. */
let posCategory = 'Todas';
let posCart = new Map();
let posBusy = false;
const posMoney = value => money.format(value);
const posIconFor = product => {
  const s = `${product.category} ${product.name}`.toLowerCase();
  if (/café|cafe|chá|cha/.test(s)) return '☕';
  if (/suco|bebida|vinho|água|agua|refrigerante/.test(s)) return '🧃';
  if (/arroz|feijão|feijao|grão|grao|cereal|mercearia/.test(s)) return '🌾';
  if (/milho|enlatado|conserva/.test(s)) return '🥫';
  if (/fruta|mamão|mamao|maçã|maca|banana|hortifruti/.test(s)) return '🍎';
  if (/cenoura|batata|vegetal|legume|congelad/.test(s)) return '🥕';
  if (/queijo|laticínio|laticinio|frios|leite/.test(s)) return '🧀';
  if (/limpeza|detergente|sabão|sabao/.test(s)) return '🧼';
  if (/macarrão|macarrao|massa/.test(s)) return '🍝';
  if (/tecnolog|informat|eletrôn|eletron/.test(s)) return '💻';
  if (/roupa|vestuário|vestuario/.test(s)) return '👕';
  if (/papel|escolar|livro/.test(s)) return '📒';
  return '📦';
};
const posColors = ['aqua','indigo','orange','mint','rose','sky'];
function posUnitPrice(product,quantity=1,payment='Não informado'){
 const day=isoDate();
 if(product.promoStart && product.promoEnd && day>=product.promoStart && day<=product.promoEnd && product.promoPrice>=0) return Number(product.promoPrice);
 if(product.wholesaleMinQty>0 && quantity>=product.wholesaleMinQty && product.wholesalePrice>=0) return Number(product.wholesalePrice);
 if(payment==='Cartão de crédito') return Number(product.installmentPrice??product.price);
 if(payment==='Dinheiro') return Number(product.cashPrice??product.price);
 return Number(product.price)||0;
}
function posEnoughStock(product,quantity){return product.trackStock===false || quantity<=product.stock;}

function posSanitizeBasket() {
  for (const [id, quantity] of posCart) {
    const product = productById(id);
    if(!product || product.showInPDV===false || (product.trackStock!==false && product.stock<=0))posCart.delete(id);
    else if(product.trackStock!==false && quantity>product.stock)posCart.set(id,product.stock);
  }
}
function posTotals() {
  const items = [...posCart].map(([id, qty]) => ({product:productById(id), qty})).filter(x => x.product);
  const payment=document.getElementById('posPayment')?.value||'Não informado';
  const sub=items.reduce((sum,x)=>sum+Math.round(posUnitPrice(x.product,x.qty,payment)*100)*x.qty,0)/100;
  const discount = Math.max(0, Number(document.getElementById('posDiscount')?.value)||0);
  const surcharge = Math.max(0, Number(document.getElementById('posSurcharge')?.value)||0);
  return {items, sub, discount, surcharge, total: Math.round((sub-discount+surcharge)*100)/100};
}
function renderPDV(){
  const panel=document.getElementById('posProducts');if(!panel)return;
  posSanitizeBasket();
  const all=state.products || [];
  const categories=['Todas',...new Set(all.map(p=>p.category).filter(Boolean))];
  if(!categories.includes(posCategory))posCategory='Todas';
  const nav=document.getElementById('posCategories');
  nav.innerHTML=categories.map(c=>`<button type="button" class="pos-category ${c===posCategory?'active':''}" data-pos-category="${escapeHTML(c)}" aria-pressed="${c===posCategory}">${escapeHTML(c)}</button>`).join('');
  const query=(document.getElementById('posSearch')?.value||'').trim().toLowerCase();
  const products=all.filter(p => p.showInPDV!==false && (posCategory==='Todas'||p.category===posCategory) && (!query||`${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query)));
  document.getElementById('posProductCount').textContent=`${products.length} ${products.length===1?'produto':'produtos'}`;
  panel.innerHTML=products.map((p,i)=>{
    const img=posIconFor(p),color=posColors[(i+categories.indexOf(p.category))%posColors.length],none=p.trackStock!==false&&p.stock<=0;
    const photo=safeProductImage(p.imageUrl);
    const visual=photo?`<img src="${escapeHTML(photo)}" alt="Foto do produto ${escapeHTML(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="pos-img-fallback" hidden>${img}</span>`:`<span class="pos-img-fallback">${img}</span>`;
    const basePrice=posUnitPrice(p,1,document.getElementById('posPayment')?.value||'Não informado');
    return `<button type="button" class="pos-product" data-pos-add="${escapeHTML(p.id)}" ${none?'disabled':''} aria-label="${none?'Sem estoque':'Adicionar'}: ${escapeHTML(p.name)}"><div class="pos-product-visual ${color}">${visual}<span class="pos-item-id">${escapeHTML(p.sku)}</span></div><div class="pos-product-body"><strong title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</strong><small>${escapeHTML(p.brand||p.category)} · ${p.trackStock===false?'Estoque livre':`${integer.format(p.stock)} ${escapeHTML(p.unit)}`}</small><div class="pos-product-bottom"><span>${posMoney(basePrice)}</span><b class="${none?'out':''}">${none?'Esgotado':'+'}</b></div></div></button>`;
  }).join('') || `<div class="pos-empty-catalog"><div class="pos-empty-icon">▣</div><h4>${all.length?'Nenhum produto encontrado':'Seu catálogo está vazio'}</h4><p>${all.length?'Tente outra categoria ou pesquisa.':'Cadastre produtos ou restaure um backup para começar.'}</p><button type="button" data-pos-open-products>Ir para produtos →</button></div>`;
  renderPosCart();
  const clerk=document.getElementById('posClerk'), operator=document.getElementById('posOperator');
  if(authUser){clerk.textContent=authUser.name;operator.textContent=`${authUser.name} · ${authUser.role==='admin'?'Administrador':authUser.role==='operator'?'Operador':'Consulta'}`;}
  const submit=document.getElementById('posCheckout');
  const allowed=!!authUser && can('movements_write');
  submit.disabled=!allowed||!posCart.size||posBusy;
  submit.textContent=posBusy?'Registrando…':allowed?'Registrar venda →':'Acesso somente para consulta';
  document.getElementById('posInfo').textContent=allowed?'A venda registra saídas no estoque. Não realiza cobrança bancária nem emite nota fiscal.':'É necessário ter permissão de movimentação para registrar uma venda.';
}
function renderPosCart(){
  const list=document.getElementById('posCart');if(!list)return;
  const calc=posTotals();
  document.getElementById('posQty').textContent=`${calc.items.reduce((s,i)=>s+i.qty,0)} unidades`;
  list.innerHTML=calc.items.map(({product:p,qty})=>`<div class="pos-cart-row"><div class="pos-cart-product"><span class="pos-cart-icon">${posIconFor(p)}</span><div><strong title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</strong><small>${posMoney(posUnitPrice(p,qty,document.getElementById('posPayment')?.value||'Não informado'))} / ${escapeHTML(p.unit)}</small></div></div><div class="pos-counter"><button type="button" data-pos-minus="${escapeHTML(p.id)}" aria-label="Diminuir ${escapeHTML(p.name)}">−</button><output>${qty}</output><button type="button" data-pos-add="${escapeHTML(p.id)}" ${p.trackStock!==false&&qty>=p.stock?'disabled':''} aria-label="Aumentar ${escapeHTML(p.name)}">+</button></div><div class="pos-cart-price"><strong>${posMoney(posUnitPrice(p,qty,document.getElementById('posPayment')?.value||'Não informado')*qty)}</strong><button type="button" class="pos-remove" data-pos-remove="${escapeHTML(p.id)}" aria-label="Remover ${escapeHTML(p.name)}">×</button></div></div>`).join('')||'<div class="pos-empty-cart"><span>🛒</span><strong>Sua venda começa aqui</strong><p>Escolha produtos no catálogo ao lado. Eles aparecerão nesta lista para conferir quantidade e valor.</p></div>';
  document.getElementById('posSubtotal').textContent=posMoney(calc.sub);
  document.getElementById('posAdjustSummary').textContent=posMoney(calc.surcharge-calc.discount);
  document.getElementById('posTotal').textContent=posMoney(Math.max(0,calc.total));
  const button=document.getElementById('posCheckout');if(button){button.disabled=!authUser||!can('movements_write')||!calc.items.length||posBusy;}
}
function resetPDV(){
  posCart.clear(); posCategory='Todas';
  for(const id of ['posDiscount','posSurcharge']){const el=document.getElementById(id);if(el)el.value='0';}
  const search=document.getElementById('posSearch');if(search)search.value='';
  const payment=document.getElementById('posPayment');if(payment)payment.value='Não informado';
}
function bindPOS(){
  const root=document.getElementById('dashboard');if(!root)return;
  root.addEventListener('click',e=>{
    const target=e.target.closest('[data-pos-category],[data-pos-add],[data-pos-minus],[data-pos-remove],[data-pos-open-products]');if(!target)return;
    if(target.hasAttribute('data-pos-open-products'))return switchView('produtos');
    if(target.hasAttribute('data-pos-category')){posCategory=target.dataset.posCategory;renderPDV();return;}
    const id=target.dataset.posAdd||target.dataset.posMinus||target.dataset.posRemove;
    const p=productById(id);if(!p)return;
    if(target.hasAttribute('data-pos-remove'))posCart.delete(id);
    else if(target.hasAttribute('data-pos-add')){if(p.trackStock!==false&&p.stock<=0)return showToast('Produto sem estoque.');if(p.sellIndividually===false && !posCart.has(id)){posCart.set(id,Math.max(1,p.wholesaleMinQty||1));}else{posCart.set(id,p.trackStock===false?(posCart.get(id)||0)+1:Math.min(p.stock,(posCart.get(id)||0)+1));}}
    else {const next=(posCart.get(id)||0)-1;if(next>0)posCart.set(id,next);else posCart.delete(id);}
    renderPDV();
  });
  document.getElementById('posSearch').addEventListener('input',renderPDV);
  document.getElementById('posPayment').addEventListener('change',renderPDV);
  ['posDiscount','posSurcharge'].forEach(id=>document.getElementById(id).addEventListener('input',renderPosCart));
  document.getElementById('posClear').addEventListener('click',()=>{posCart.clear();document.getElementById('posDiscount').value='0';document.getElementById('posSurcharge').value='0';document.getElementById('posPayment').value='Não informado';renderPDV()});
  document.getElementById('posCheckout').addEventListener('click',async()=>{
    if(posBusy||!guard('movements_write'))return;
    posSanitizeBasket();
    const c=posTotals();
    if(!c.items.length)return showToast('Escolha ao menos um produto.');
    if(!Number.isFinite(c.total)||c.total<0||c.discount>c.sub)return showToast('Desconto maior que o subtotal.');
    if(!Number.isFinite(c.surcharge)||c.surcharge>c.sub*2+100000)return showToast('Verifique o acréscimo informado.');
    posBusy=true;renderPDV();
    try {
      const result=await appApi('/sales','POST',{items:c.items.map(i=>({productId:i.product.id,quantity:i.qty})),discount:c.discount,surcharge:c.surcharge,payment:document.getElementById('posPayment').value,date:isoDate()});
      state=normalizeStateShape(result.state);stateRevision=result.revision;
      posCart.clear();document.getElementById('posDiscount').value='0';document.getElementById('posSurcharge').value='0';document.getElementById('posPayment').value='Não informado';
      renderAll();showToast(`Venda ${result.saleId} registrada: ${posMoney(result.total)}.`);
    }catch(e){showToast(e.message)}finally{posBusy=false;renderPDV()}
  });
}
bindPOS();
