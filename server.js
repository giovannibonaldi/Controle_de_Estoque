"use strict";
// Estoque Azul V8: servidor sem dependências externas (Node.js >=22.13).
// Permissões e registros são verificados no servidor; não confie na UI para autorizar ações.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const base = __dirname;
const dataDir = process.env.ESTOQUE_DATA_DIR || path.join(base, 'dados');
fs.mkdirSync(dataDir, {recursive:true, mode:0o700});
const db = new DatabaseSync(path.join(dataDir, 'estoque.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 passwordhash TEXT NOT NULL, role TEXT NOT NULL, permissions TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, username TEXT NOT NULL,
 action TEXT NOT NULL, detail TEXT NOT NULL);`);
if (!db.prepare('SELECT id FROM inventory WHERE id=1').get()) {
 const demoFile=path.join(base,'demonstracao','demo_12_meses_20_produtos.json');
 const freshState=fs.existsSync(demoFile) ? JSON.parse(fs.readFileSync(demoFile,'utf8')) : {products:[],movements:[],events:[],createdAt:new Date().toISOString()};
 db.prepare('INSERT INTO inventory(id,data,revision) VALUES(1,?,0)').run(JSON.stringify(freshState));
 console.log('Base inicial de demonstração carregada somente para instalação nova.');
}
const PERMISSIONS = ['products_write','products_delete','movements_write','movements_delete','alerts_write','trends_write','backup_export','backup_import','users_manage'];
const OPERATOR = ['products_write','movements_write','alerts_write','trends_write','backup_export'];
const sessions = new Map();
const attempts = new Map();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
class ApiError extends Error { constructor(code,message){super(message);this.status=code;} }
const bad=(message,code=400)=>{throw new ApiError(code,message)};
const id=()=>crypto.randomUUID();
function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`}
function verifyPassword(password, hash){const [salt,hex]=hash.split(':');if(!salt||!hex)return false;const digest=crypto.scryptSync(password,salt,64);const stored=Buffer.from(hex,'hex');return stored.length===digest.length && crypto.timingSafeEqual(stored,digest)}
function permissionsFor(user){return user.role==='admin' ? PERMISSIONS : JSON.parse(user.permissions||'[]')}
function publicUser(user){return {id:user.id,username:user.username,name:user.name,role:user.role,permissions:permissionsFor(user),active:!!user.active}}
function getState(){return JSON.parse(db.prepare('SELECT data FROM inventory WHERE id=1').get().data)}
function saveState(state){db.prepare('UPDATE inventory SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(state));return {state,revision:db.prepare('SELECT revision FROM inventory WHERE id=1').get().revision}}
function audit(user,action,detail=''){db.prepare('INSERT INTO audit(timestamp,username,action,detail) VALUES(?,?,?,?)').run(new Date().toISOString(),user.username,action,String(detail).slice(0,160))}
function usernameValid(x){return typeof x==='string' && /^[a-zA-Z0-9._-]{3,32}$/.test(x)}
function nameValid(x){return typeof x==='string' && x.trim().length>=2 && x.trim().length<=80}
function passwordValid(x){return typeof x==='string' && x.length>=10 && x.length<=200}
function roleValid(role){return ['admin','operator','viewer'].includes(role)}
function sanitizePerms(value){return Array.isArray(value)?[...new Set(value.filter(x=>PERMISSIONS.includes(x)))]:[]}
function safeText(v,max=140){return typeof v==='string'?v.slice(0,max).trim():''}
function asNum(v,minimum=0){const n=Number(v); if(!Number.isFinite(n)||n<minimum||n>1e9)bad('Valor numérico inválido.');return n}
function asInt(v,minimum=0){const n=asNum(v,minimum);if(!Number.isInteger(n))bad('Quantidade deve ser inteira.');return n}
function validDate(v,required=false){if(!v&&!required)return '';if(typeof v!=='string'|| !/^\d{4}-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(`${v}T12:00:00Z`)))bad('Data inválida.');return v}
function cleanImage(value) {
 if (typeof value!== 'string' || !value) return '';
 if (value.length > 850000) bad('Fotografia grande demais; utilize até 600 KB após otimização.');
 if (/^https:\/\/[a-z0-9.-]+(?::443)?\//i.test(value) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
 bad('Use URL HTTPS ou imagem JPG, PNG ou WebP carregada pelo formulário.');
}
function cleanProduct(item,existing){if(!item||typeof item!=='object')bad('Produto inválido.');
 const basePrice=asNum(item.price);const cost=asNum(item.cost);
 const product={
 id:existing?.id||id(), name:safeText(item.name,80),sku:safeText(item.sku,24).toUpperCase(),barcode:safeText(item.barcode,32),
 brand:safeText(item.brand,50),category:safeText(item.category,40),group:safeText(item.group,45),subgroup:safeText(item.subgroup,45),
 supplier:safeText(item.supplier,60),unit:safeText(item.unit,8)||'un',size:safeText(item.size,40),packaging:safeText(item.packaging,40),
 cost,price:basePrice,cashPrice:asNum(item.cashPrice??basePrice),installmentPrice:asNum(item.installmentPrice??basePrice),
 wholesalePrice:asNum(item.wholesalePrice??basePrice),wholesaleMinQty:asInt(item.wholesaleMinQty??0),commissionPercent:asNum(item.commissionPercent??0),
 promoPrice:asNum(item.promoPrice??basePrice),promoStart:validDate(item.promoStart),promoEnd:validDate(item.promoEnd),
 initialStock:existing?existing.initialStock:asInt(item.initialStock),stock:existing?existing.stock:asInt(item.initialStock),minimum:asInt(item.minimum),
 purchaseDate:validDate(item.purchaseDate,true),expiryDate:validDate(item.expiryDate),location:safeText(item.location,80),note:safeText(item.note,240),
 ingredients:safeText(item.ingredients,500),trackStock:item.trackStock!==false,useScale:!!item.useScale,
 showInPDV:item.showInPDV!==false,sellIndividually:item.sellIndividually!==false,pdvTableMode:!!item.pdvTableMode,
 seasonal:!!item.seasonal,alertMuted:existing?!!existing.alertMuted:false,
 imageUrl:cleanImage(item.imageUrl),imageCredit:safeText(item.imageCredit,90),demo:existing?!!existing.demo:!!item.demo
 };
 if(!product.name||!product.sku||!product.category)bad('Preencha nome, SKU e categoria.');
 if(product.promoStart && product.promoEnd && product.promoEnd<product.promoStart)bad('Data final da promoção não pode ser anterior à inicial.');
 if(product.promoPrice>product.price*10 && product.price>0)bad('Verifique preço promocional.');
 if(product.commissionPercent>100)bad('A comissão não pode exceder 100%.');
 return product;
}
function saleUnitPrice(product,qty,date,payment='Não informado'){
 let result=Number(product.price)||0;
 if(product.promoStart && product.promoEnd && date>=product.promoStart && date<=product.promoEnd && product.promoPrice>=0) result=product.promoPrice;
 else if((product.wholesaleMinQty||0)>0 && qty>=product.wholesaleMinQty && product.wholesalePrice>=0) result=product.wholesalePrice;
 else if(payment==='Cartão de crédito' && product.installmentPrice>=0) result=product.installmentPrice;
 else if(payment==='Dinheiro' && product.cashPrice>=0) result=product.cashPrice;
 return Math.round(result*100)/100;
}
function movementSign(type){return ['Entrada','Ajuste +'].includes(type)?1:-1}
function cleanMovement(x){if(!x||typeof x!=='object')bad('Movimentação inválida.');const type=safeText(x.type,20);if(!['Entrada','Saída','Perda','Ajuste +','Ajuste -'].includes(type))bad('Tipo de movimentação inválido.');return {id:id(),productId:safeText(x.productId,64),type,quantity:asInt(x.quantity,1),unitValue:asNum(x.unitValue),date:validDate(x.date,true),note:safeText(x.note,100)}}
function cleanEvent(x){if(!x||typeof x!=='object')bad('Evento inválido.');const event={id:id(),productId:safeText(x.productId,64),title:safeText(x.title,70),type:safeText(x.type,30),startDate:validDate(x.startDate,true),endDate:validDate(x.endDate,true),expectation:safeText(x.expectation,30),note:safeText(x.note,150)};if(!event.title||event.endDate<event.startDate)bad('Datas ou nome do evento inválidos.');return event}
function cleanImport(d){if(!d||!Array.isArray(d.products)||!Array.isArray(d.movements))bad('Backup incompatível.');if(d.products.length>15000||d.movements.length>500000||d.events?.length>50000)bad('Backup grande demais.');
 const productIds=new Set(), skus=new Set();const products=d.products.map(p=>{const x=cleanProduct(p);x.id=safeText(p.id,64)||id();x.initialStock=asInt(p.initialStock??p.stock);x.stock=asInt(p.stock);x.alertMuted=!!p.alertMuted;if(productIds.has(x.id)||skus.has(x.sku))bad('Produtos repetidos no backup.');productIds.add(x.id);skus.add(x.sku);return x});
 const movementIds=new Set();const movements=d.movements.map(m=>{const x=cleanMovement(m);x.id=safeText(m.id,64)||id();if(movementIds.has(x.id))bad('Movimentações repetidas no backup.');movementIds.add(x.id);return x});
 const events=(Array.isArray(d.events)?d.events:[]).map(e=>{const x=cleanEvent(e);x.id=safeText(e.id,64)||id();return x});return {products,movements,events,createdAt:safeText(d.createdAt,70)||new Date().toISOString(),demo:!!d.demo,demoPeriod:d.demoPeriod||null};}
function authenticated(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ea_session='));if(!raw)return null;const token=raw.slice('ea_session='.length),sess=sessions.get(token);if(!sess||sess.expires<Date.now())return null;const user=db.prepare('SELECT * FROM users WHERE id=?').get(sess.userId);if(!user?.active)return null;return user}
function cookie(token,secure=false){return `ea_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`}
function reply(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',...headers});res.end(JSON.stringify(data))}
function bodyJSON(req){return new Promise((resolve,reject)=>{let chunks='',size=0;req.on('data',b=>{size+=b.length;if(size>16*1024*1024){reject(new ApiError(413,'Requisição grande demais.'));req.destroy();return}chunks+=b});req.on('end',()=>{try{resolve(chunks?JSON.parse(chunks):{})}catch{reject(new ApiError(400,'JSON inválido.'))}});req.on('error',reject)})}
function needs(user,permission){if(user.role!=='admin'&&!permissionsFor(user).includes(permission))bad('Permissão insuficiente para esta ação.',403)}
function userCount(){return db.prepare('SELECT COUNT(*) as count FROM users').get().count}
function safeRole(role,perms){if(!roleValid(role))bad('Perfil inválido.');return role==='admin'?[]:role==='viewer'?sanitizePerms(perms||[]):sanitizePerms(perms??OPERATOR)}
function lastAdminProtected(target){if(target.role==='admin' && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get().n<=1)bad('É necessário manter pelo menos um administrador ativo.')}
function rateLimit(ip){const now=Date.now();const x=attempts.get(ip)||{n:0,start:now};if(now-x.start>15*60*1000){x.n=0;x.start=now}if(x.n>=12)bad('Muitas tentativas. Tente novamente em 15 minutos.',429);x.n++;attempts.set(ip,x)}
async function handleApi(req,res,url){
 const p=url.pathname,method=req.method,configured=userCount()>0;
 if(p==='/api/bootstrap'&&method==='GET')return reply(res,200,{configured});
 if(p==='/api/setup'&&method==='POST'){
   if(configured)bad('Administrador já configurado.',403);const d=await bodyJSON(req);
   if(!usernameValid(d.username)||!nameValid(d.name)||!passwordValid(d.password))bad('Informe nome, usuário (3–32) e senha de pelo menos 10 caracteres.');
   const u={id:id(),username:d.username.toLowerCase(),name:d.name.trim(),role:'admin'};
   db.prepare('INSERT INTO users(id,username,name,passwordhash,role,permissions,active,created) VALUES(?,?,?,?,?,?,1,?)').run(u.id,u.username,u.name,hashPassword(d.password),'admin','[]',new Date().toISOString());
   audit(u,'setup','Administrador inicial');return reply(res,201,{ok:true});
 }
 if(p==='/api/login'&&method==='POST'){
   rateLimit(req.socket.remoteAddress||'local');const d=await bodyJSON(req);const u=db.prepare('SELECT * FROM users WHERE username=?').get(String(d.username||'').trim().toLowerCase());
   if(!u?.active||!verifyPassword(String(d.password||''),u.passwordhash))bad('Usuário ou senha inválidos.',401);
   attempts.delete(req.socket.remoteAddress||'local');const token=crypto.randomBytes(32).toString('base64url');sessions.set(token,{userId:u.id,expires:Date.now()+12*60*60*1000});
   audit(u,'login','Acesso autorizado');return reply(res,200,{user:publicUser(u)},{'Set-Cookie':cookie(token,req.socket.encrypted||req.headers['x-forwarded-proto']==='https')});
 }
 const u=authenticated(req);if(!u)bad('Faça login para continuar.',401);
 if(p==='/api/logout'&&method==='POST'){const token=(req.headers.cookie||'').match(/ea_session=([^;]+)/)?.[1];if(token)sessions.delete(token);return reply(res,200,{ok:true},{'Set-Cookie':'ea_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'})}
 if(p==='/api/me'&&method==='GET')return reply(res,200,{user:publicUser(u)});
 if(p==='/api/demo/reset'&&method==='POST'){
  if(u.role!=='admin')bad('Somente administradores podem restaurar a base de demonstração.',403);
  const d=await bodyJSON(req);if(d.confirmation!=='RESTAURAR DEMONSTRACAO')bad('Confirmação inválida.');
  const demoFile=path.join(base,'demonstracao','demo_12_meses_20_produtos.json');
  const fresh=cleanImport(JSON.parse(fs.readFileSync(demoFile,'utf8')));
  fresh.demo=true;fresh.demoPeriod={start:'2025-10-15',end:'2026-10-15'};
  const out=saveState(fresh);audit(u,'reiniciar_demonstracao','20 produtos, 12 meses fictícios');return reply(res,200,out);
 }
 if(p==='/api/state'&&method==='GET')return reply(res,200,{state:getState(),revision:db.prepare('SELECT revision FROM inventory WHERE id=1').get().revision});
 if(p==='/api/audit'&&method==='GET'){needs(u,'users_manage');return reply(res,200,{entries:db.prepare('SELECT timestamp,username,action,detail FROM audit ORDER BY id DESC LIMIT 70').all()})}
 if(p==='/api/backup'&&method==='GET'){needs(u,'backup_export');return reply(res,200,{...getState(),exportedAt:new Date().toISOString()})}
 if(p==='/api/restore'&&method==='POST'){needs(u,'backup_import');const d=await bodyJSON(req);const clean=cleanImport(d);const out=saveState(clean);audit(u,'restaurar_backup',`${clean.products.length} produtos`);return reply(res,200,out)}
 if(p==='/api/products'&&method==='POST'){needs(u,'products_write');const d=await bodyJSON(req),state=getState(),x=cleanProduct(d);if(state.products.some(y=>y.sku===x.sku))bad('Já existe produto com este SKU.',409);state.products.push(x);const out=saveState(state);audit(u,'criar_produto',x.sku);return reply(res,201,out)}
 const productRoute=p.match(/^\/api\/products\/([^/]+)$/);
 if(productRoute&&method==='PUT'){needs(u,'products_write');const d=await bodyJSON(req),state=getState(),p0=state.products.find(y=>y.id===productRoute[1]);if(!p0)bad('Produto não encontrado.',404);const x=cleanProduct(d,p0);if(state.products.some(y=>y.sku===x.sku&&y.id!==x.id))bad('SKU já utilizado.',409);Object.assign(p0,x);const out=saveState(state);audit(u,'editar_produto',x.sku);return reply(res,200,out)}
 if(productRoute&&method==='DELETE'){needs(u,'products_delete');const state=getState(),p0=state.products.find(y=>y.id===productRoute[1]);if(!p0)bad('Produto não encontrado.',404);state.products=state.products.filter(y=>y.id!==p0.id);const out=saveState(state);audit(u,'excluir_produto',p0.sku);return reply(res,200,out)}
 if(p==='/api/sales'&&method==='POST'){
  needs(u,'movements_write');
  const data=await bodyJSON(req);
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>60)bad('Selecione de 1 a 60 produtos para a venda.');
  const quantities=new Map();
  for(const item of data.items){
    const productId=safeText(item.productId,64);
    const quantity=asInt(item.quantity,1);
    if(!productId)bad('Produto inválido.');
    quantities.set(productId,(quantities.get(productId)||0)+quantity);
  }
  const payment=safeText(data.payment,30);
  if(!['Não informado','Pix','Dinheiro','Cartão de débito','Cartão de crédito','Outro'].includes(payment))bad('Forma de pagamento inválida.');
  const discount=Math.round(asNum(data.discount)*100)/100;
  const surcharge=Math.round(asNum(data.surcharge)*100)/100;
  const state=getState(), lines=[];
  const today=data.date ? validDate(data.date,true) : new Date().toISOString().slice(0,10);
  for(const [productId,quantity] of quantities){
    const product=state.products.find(x=>x.id===productId);
    if(!product)bad('Um produto não existe mais. Atualize a página.',409);
    if(product.showInPDV===false)bad('Produto indisponível para venda no PDV.',409);
    if(product.sellIndividually===false && quantity<Math.max(1,product.wholesaleMinQty||1))bad(`Venda mínima de ${product.name}: ${product.wholesaleMinQty} un.`,409);
    if(product.trackStock!==false && quantity>product.stock)bad(`Estoque insuficiente para ${product.name}: ${product.stock} disponíveis.`,409);
    const unitCents=Math.round(saleUnitPrice(product,quantity,today,payment)*100);
    lines.push({product,quantity,subtotalCents:unitCents*quantity});
  }
  const subtotalCents=lines.reduce((sum,l)=>sum+l.subtotalCents,0);
  const discountCents=Math.round(discount*100),surchargeCents=Math.round(surcharge*100);
  if(discountCents>subtotalCents)bad('Desconto não pode superar o subtotal.');
  if(surchargeCents>subtotalCents*2+10000000)bad('Acréscimo excessivo.');
  const totalCents=subtotalCents-discountCents+surchargeCents;
  if(!Number.isSafeInteger(totalCents))bad('Total inválido.');
  const saleId=id().slice(0,8).toUpperCase();
  let allocated=0;
  lines.forEach((line,index)=>{
    const lineCents=index===lines.length-1?totalCents-allocated:subtotalCents?Math.round(totalCents*line.subtotalCents/subtotalCents):0;
    allocated+=lineCents;
    if(line.product.trackStock!==false) line.product.stock-=line.quantity;
    state.movements.push({id:id(),productId:line.product.id,type:'Saída',quantity:line.quantity,
      unitValue:(lineCents/100)/line.quantity,date:today,note:`PDV ${saleId} | ${payment}`});
  });
  const out=saveState(state);
  audit(u,'registrar_venda',`PDV ${saleId}: ${lines.length} produto(s), R$ ${(totalCents/100).toFixed(2)}, ${payment}`);
  return reply(res,201,{...out,saleId,total:totalCents/100});
 }
 if(p==='/api/movements'&&method==='POST'){needs(u,'movements_write');const d=await bodyJSON(req),x=cleanMovement(d),state=getState(),product=state.products.find(y=>y.id===x.productId);if(!product)bad('Produto não encontrado.',404);const next=product.stock+(product.trackStock===false?0:movementSign(x.type)*x.quantity);if(next<0)bad(`Estoque insuficiente: ${product.stock} unidades.`,409);product.stock=next;state.movements.push(x);const out=saveState(state);audit(u,'criar_movimentacao',`${product.sku}, ${x.type}, ${x.quantity}`);return reply(res,201,out)}
 const movementRoute=p.match(/^\/api\/movements\/([^/]+)$/);
 if(movementRoute&&method==='PUT'){
  needs(u,'movements_write');const d=await bodyJSON(req),state=getState();
  const existing=state.movements.find(m=>m.id===movementRoute[1]);if(!existing)bad('Movimentação não encontrada.',404);
  const updated=cleanMovement(d);updated.id=existing.id;
  const originalProduct=state.products.find(p=>p.id===existing.productId),nextProduct=state.products.find(p=>p.id===updated.productId);
  if(!nextProduct)bad('Produto não encontrado.',404);
  const originalReversal=movementSign(existing.type)*existing.quantity;
  if(originalProduct && originalProduct.trackStock!==false){originalProduct.stock-=originalReversal;if(originalProduct.stock<0)bad('A correção deixaria o saldo anterior negativo.',409);}
  if(nextProduct.trackStock!==false)nextProduct.stock+=movementSign(updated.type)*updated.quantity;
  if(nextProduct.stock<0)bad('Estoque insuficiente para a nova movimentação.',409);
  Object.assign(existing,updated);const out=saveState(state);audit(u,'editar_movimentacao',`${updated.type}, ${updated.quantity}`);return reply(res,200,out);
 }
 if(movementRoute&&method==='DELETE'){needs(u,'movements_delete');const state=getState(),x=state.movements.find(m=>m.id===movementRoute[1]);if(!x)bad('Movimentação não encontrada.',404);const product=state.products.find(y=>y.id===x.productId);if(product && product.trackStock!==false){const next=product.stock-movementSign(x.type)*x.quantity;if(next<0)bad('A exclusão deixaria o estoque negativo.',409);product.stock=next;}state.movements=state.movements.filter(m=>m.id!==x.id);const out=saveState(state);audit(u,'excluir_movimentacao',`${x.type}, ${x.quantity}`);return reply(res,200,out)}
 const alertRoute=p.match(/^\/api\/alerts\/([^/]+)$/);
 if(alertRoute&&method==='PATCH'){needs(u,'alerts_write');const d=await bodyJSON(req),state=getState(),x=state.products.find(y=>y.id===alertRoute[1]);if(!x)bad('Produto não encontrado.',404);if(typeof d.alertMuted!=='boolean' && typeof d.seasonal!=='boolean')bad('Nenhuma alteração válida.');if(typeof d.alertMuted==='boolean')x.alertMuted=d.alertMuted;if(typeof d.seasonal==='boolean')x.seasonal=d.seasonal;const out=saveState(state);audit(u,'atualizar_alerta',x.sku);return reply(res,200,out)}
 if(p==='/api/events'&&method==='POST'){needs(u,'trends_write');const d=await bodyJSON(req),state=getState(),x=cleanEvent(d);if(!state.products.some(y=>y.id===x.productId))bad('Produto não encontrado.',404);state.events.push(x);const out=saveState(state);audit(u,'registrar_evento',x.title);return reply(res,201,out)}
 const eventRoute=p.match(/^\/api\/events\/([^/]+)$/);
 if(eventRoute&&method==='DELETE'){needs(u,'trends_write');const state=getState();state.events=state.events.filter(x=>x.id!==eventRoute[1]);const out=saveState(state);audit(u,'excluir_evento',eventRoute[1]);return reply(res,200,out)}
 if(p==='/api/users'&&method==='GET'){needs(u,'users_manage');return reply(res,200,{users:db.prepare('SELECT * FROM users ORDER BY created').all().map(publicUser)})}
 if(p==='/api/users'&&method==='POST'){needs(u,'users_manage');const d=await bodyJSON(req);if(!usernameValid(d.username)||!nameValid(d.name)||!passwordValid(d.password))bad('Usuário, nome ou senha inválidos (mínimo 10 caracteres).');const username=d.username.toLowerCase();if(db.prepare('SELECT 1 FROM users WHERE username=?').get(username))bad('Este login já existe.',409);const role=d.role||'viewer',permissions=safeRole(role,d.permissions);const userId=id();db.prepare('INSERT INTO users(id,username,name,passwordhash,role,permissions,active,created) VALUES(?,?,?,?,?,?,1,?)').run(userId,username,d.name.trim(),hashPassword(d.password),role,JSON.stringify(permissions),new Date().toISOString());audit(u,'criar_usuario',username);return reply(res,201,{ok:true})}
 const userRoute=p.match(/^\/api\/users\/([^/]+)$/);
 if(userRoute&&method==='PATCH'){needs(u,'users_manage');const d=await bodyJSON(req),target=db.prepare('SELECT * FROM users WHERE id=?').get(userRoute[1]);if(!target)bad('Usuário não encontrado.',404);const role=d.role||target.role,active=d.active===undefined?!!target.active:!!d.active;const permissions=safeRole(role,d.permissions??permissionsFor(target));if(target.id===u.id && (!active||role!=='admin'))bad('Não é permitido retirar suas próprias permissões administrativas.');if(target.role==='admin'&&(!active||role!=='admin'))lastAdminProtected(target);const name=d.name===undefined?target.name:d.name;if(!nameValid(name))bad('Nome inválido.');db.prepare('UPDATE users SET name=?,role=?,permissions=?,active=? WHERE id=?').run(name.trim(),role,JSON.stringify(permissions),active?1:0,target.id);audit(u,'atualizar_usuario',target.username);return reply(res,200,{ok:true})}
 const passRoute=p.match(/^\/api\/users\/([^/]+)\/password$/);
 if(passRoute&&method==='POST'){needs(u,'users_manage');const d=await bodyJSON(req);if(!passwordValid(d.password))bad('A nova senha precisa ter pelo menos 10 caracteres.');const t=db.prepare('SELECT * FROM users WHERE id=?').get(passRoute[1]);if(!t)bad('Usuário não encontrado.',404);db.prepare('UPDATE users SET passwordhash=? WHERE id=?').run(hashPassword(d.password),t.id);for(const [k,v] of sessions)if(v.userId===t.id)sessions.delete(k);audit(u,'trocar_senha_usuario',t.username);return reply(res,200,{ok:true})}
 if(userRoute&&method==='DELETE'){needs(u,'users_manage');const t=db.prepare('SELECT * FROM users WHERE id=?').get(userRoute[1]);if(!t)bad('Usuário não encontrado.',404);if(t.id===u.id)bad('Não é possível excluir sua própria conta.');if(t.role==='admin')lastAdminProtected(t);db.prepare('DELETE FROM users WHERE id=?').run(t.id);for(const [k,v] of sessions)if(v.userId===t.id)sessions.delete(k);audit(u,'excluir_usuario',t.username);return reply(res,200,{ok:true})}
 bad('Rota não encontrada.',404);
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.ico':'image/x-icon','.svg':'image/svg+xml'};
async function handler(req,res){try{
 const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
 if(url.pathname.startsWith('/api/')){
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(req.method))bad('Método inválido.',405);
  if(req.method!=='GET'){
   const origin=req.headers.origin;
   if(origin){const o=new URL(origin);if(o.host!==req.headers.host||!['http:','https:'].includes(o.protocol))bad('Origem não permitida.',403)}
   if(['POST','PUT','PATCH'].includes(req.method) && url.pathname!=='/api/logout'&&!/^application\/json/.test(req.headers['content-type']||''))bad('Envie JSON.',415);
  }
  return await handleApi(req,res,url);
 }
 if(req.method!=='GET')bad('Método inválido.',405);
 const requested=url.pathname==='/'?'/index.html':url.pathname;
 const filename=path.resolve(base,'.'+decodeURIComponent(requested));
 if(!filename.startsWith(base+path.sep)||!mime[path.extname(filename)])bad('Não encontrado.',404);
 const bytes=fs.readFileSync(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});res.end(bytes);
 }catch(e){if(e.code==='ENOENT')return reply(res,404,{error:'Não encontrado.'});reply(res,e.status||500,{error:e.status?e.message:'Erro interno no servidor.'});if(!e.status)console.error(e)}}
const server=http.createServer(handler);server.listen(PORT,HOST,()=>console.log(`Estoque Azul V10: http://${HOST}:${PORT} (Node ${process.version})`));
