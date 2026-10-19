"use strict";
let authUser=null;
let setupMode=false;
let stateRevision=-1;
let syncTimer=null;
const RIGHTS={products_write:'Cadastrar e editar produtos',products_delete:'Excluir produtos',movements_write:'Registrar entradas, saídas e ajustes',movements_delete:'Excluir movimentações',alerts_write:'Alterar alertas e sazonalidade',trends_write:'Cadastrar e excluir eventos de tendências',backup_export:'Exportar backup completo',backup_import:'Restaurar backup completo',users_manage:'Gerenciar usuários e permissões'};
const DEFAULT_OPERATOR=['products_write','movements_write','alerts_write','trends_write','backup_export'];
const ROLENAMES={admin:'Administrador',operator:'Operador',viewer:'Consulta'};
function can(permission){return !!authUser&&(authUser.role==='admin'||authUser.permissions.includes(permission))}
function guard(permission){if(can(permission))return true;showToast('Sua conta não tem permissão para esta ação.');return false}
async function appApi(path, method='GET', data=undefined){
  let response;
  try{response=await fetch('/api'+path,{method,credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});}catch{throw new Error('Servidor indisponível. Inicie o aplicativo pelo arquivo INICIAR_ESTOQUE.bat ou pelo Node.js.')}
  let payload={};try{payload=await response.json()}catch{}
  if(!response.ok)throw new Error(payload.error||`Erro ${response.status}`);
  return payload;
}
async function updateFromServer(method,url,payload){
  try{const response=await appApi(url,method,payload);if(response.state){state=normalizeStateShape(response.state);stateRevision=response.revision;renderAll();}return true;}
  catch(error){showToast(error.message);return false}
}
function applyUIRights(){
 if(!authUser)return;
 const rules=[['[data-open-modal="productModal"]','products_write'],['[data-open-modal="movementModal"]','movements_write'],['[data-edit-product]','products_write'],['[data-delete-product]','products_delete'],['[data-move-product]','movements_write'],['[data-edit-movement]','movements_write'],['[data-delete-movement]','movements_delete'],['[data-toggle-product-alert]','alerts_write'],['[data-toggle-seasonal]','alerts_write'],['[data-remove-trend-event]','trends_write'],['#backupButton','backup_export'],['#restoreButton','backup_import'],];
 for(const [selector,p] of rules)document.querySelectorAll(selector).forEach(el=>{el.hidden=!can(p);el.style.display=can(p)?'':'none'});
 const form=document.getElementById('trendEventForm');if(form)form.hidden=!can('trends_write');
 const nav=document.querySelector('[data-view="usuarios"]');if(nav)nav.hidden=!can('users_manage');
 const username=document.getElementById('accountName'),role=document.getElementById('accountRole');if(username)username.textContent=authUser.name;if(role)role.textContent=ROLENAMES[authUser.role]||'Personalizado';
}
function showAuth(mode, openDialog=false){
 setupMode=mode==='setup';if(typeof resetPDV==='function')resetPDV();document.body.classList.remove('auth-ready');
 document.getElementById('authGate').style.display=openDialog?'grid':'none';document.getElementById('setupNameLabel').hidden=!setupMode;
 document.getElementById('authTitle').textContent=setupMode?'Configure o primeiro acesso':'Bem-vindo de volta';
 document.getElementById('authDescription').textContent=setupMode?'Crie sua conta de administrador. Ela terá permissão para autorizar outras pessoas. Nenhuma senha inicial é pré-definida.':'Entre com o login e a senha liberados pelo administrador.';
 document.getElementById('authSubmit').textContent=setupMode?'Criar administrador e iniciar':'Entrar no sistema →';
 document.getElementById('authPassword').setAttribute('autocomplete',setupMode?'new-password':'current-password');
 document.getElementById('authError').textContent='';if(openDialog)document.getElementById('authUsername').focus();else window.scrollTo(0,0);
}
async function beginAuth(){
 document.getElementById('authGate').style.display='none';
 document.getElementById('authForm').addEventListener('submit',async e=>{
   e.preventDefault();const b=document.getElementById('authSubmit');b.disabled=true;
   const error=document.getElementById('authError');error.textContent='';
   try{
     const data={username:document.getElementById('authUsername').value.trim(),password:document.getElementById('authPassword').value};
     if(setupMode){data.name=document.getElementById('setupName').value.trim();await appApi('/setup','POST',data);showAuth('login',true);error.style.color='#167b68';error.textContent='Conta criada. Entre com a senha que você escolheu.';document.getElementById('authPassword').value='';}
     else {await appApi('/login','POST',data);await startSession();}
   }catch(err){error.style.color='#b4384b';error.textContent=err.message;}finally{b.disabled=false}
 });
 document.getElementById('logoutButton').addEventListener('click',async()=>{try{await appApi('/logout','POST')}catch{}authUser=null;clearInterval(syncTimer);showAuth('login')});
 document.getElementById('createUserForm').addEventListener('submit',createUserFromForm);
 document.getElementById('userPasswordForm').addEventListener('submit',saveUserPassword);
 document.getElementById('usersList').addEventListener('click',handleUsersClick);
 try{const b=await appApi('/bootstrap');if(!b.configured){showAuth('setup');return}await startSession();}
 catch(e){if(e.message.includes('Faça login'))showAuth('login');else{showAuth('login');document.getElementById('authError').textContent=e.message}}
}
async function startSession(){
 const me=await appApi('/me');authUser=me.user;const inventory=await appApi('/state');state=normalizeStateShape(inventory.state);stateRevision=inventory.revision;
 document.body.classList.add('auth-ready');document.getElementById('authGate').style.display='none';
 updateHeader();renderAll();applyUIRights();
 if(can('users_manage'))await refreshUsers();
 if(typeof renderPDV === 'function')renderPDV();
 if(syncTimer)clearInterval(syncTimer);syncTimer=setInterval(syncSharedState,18000);
}
async function refreshUsers(){if(!can('users_manage'))return;
 const [u,a]=await Promise.all([appApi('/users'),appApi('/audit')]);
 document.getElementById('userCount').textContent=`${u.users.length} contas`;
 const container=document.getElementById('usersList');container.innerHTML=u.users.map(x=>`<article class="user-card"><div class="user-card-header"><div><strong>${escapeHTML(x.name)}</strong><small>@${escapeHTML(x.username)} ${x.id===authUser.id?'• você':''}</small></div><span class="tag ${x.active?'good':'bad'}">${escapeHTML(ROLENAMES[x.role])} · ${x.active?'Ativo':'Desativado'}</span></div><div class="user-card-details"><span>${x.permissions.length} permissões</span><span>${x.role==='admin'?'Acesso administrativo completo':'Permissões personalizáveis'}</span></div><div class="user-card-actions"><button data-edit-user="${x.id}">Permissões</button><button data-user-password="${x.id}">Nova senha</button>${x.id!==authUser.id?`<button data-user-active="${x.id}">${x.active?'Desativar':'Ativar'}</button><button data-delete-user="${x.id}">Excluir conta</button>`:''}</div><div id="edit-${x.id}" class="permission-editor" hidden></div></article>`).join('');
 window.userCache=u.users;
 document.getElementById('auditList').innerHTML=a.entries.map(x=>`<div class="audit-row"><span>${new Date(x.timestamp).toLocaleString('pt-BR')}</span><strong>${escapeHTML(x.username)} · ${escapeHTML(x.action.replaceAll('_',' '))}</strong><span>${escapeHTML(x.detail)}</span></div>`).join('')||'<p>Sem ações registradas.</p>';
}
async function createUserFromForm(e){e.preventDefault();if(!guard('users_manage'))return;const f=e.currentTarget,values=Object.fromEntries(new FormData(f));const role=values.role;const perms=role==='operator'?DEFAULT_OPERATOR:role==='admin'?Object.keys(RIGHTS):[];
 try{await appApi('/users','POST',{...values,role,permissions:perms});f.reset();await refreshUsers();showToast('Nova conta criada. Entregue a senha à pessoa por um canal seguro.');}catch(err){showToast(err.message)}
}
async function handleUsersClick(e){
 const target=e.target.closest('button');if(!target)return;const x=window.userCache.find(u=>u.id===(target.dataset.editUser||target.dataset.userPassword||target.dataset.userActive||target.dataset.deleteUser||target.dataset.saveUser));if(!x)return;
 try{
 if(target.dataset.editUser){const editor=document.getElementById('edit-'+x.id);editor.hidden=!editor.hidden;if(!editor.hidden)editor.innerHTML=`<label>Perfil de acesso<select class="edit-role"><option value="viewer" ${x.role==='viewer'?'selected':''}>Consulta</option><option value="operator" ${x.role==='operator'?'selected':''}>Operador</option><option value="admin" ${x.role==='admin'?'selected':''}>Administrador</option></select></label><div class="permission-options">${Object.entries(RIGHTS).map(([key,label])=>`<label><input type="checkbox" value="${key}" ${x.permissions.includes(key)?'checked':''}>${label}</label>`).join('')}</div><label><input type="checkbox" class="user-active" ${x.active?'checked':''}>Conta ativa</label><button class="button primary" data-save-user="${x.id}">Salvar permissões</button><small>Contas de administrador possuem acesso total. As restrições são verificadas no servidor.</small>`;return;}
 if(target.dataset.saveUser){const root=document.getElementById('edit-'+x.id),role=root.querySelector('.edit-role').value,permissions=[...root.querySelectorAll('.permission-options input:checked')].map(el=>el.value),active=root.querySelector('.user-active').checked;await appApi('/users/'+x.id,'PATCH',{role,permissions,active});await refreshUsers();showToast('Permissões atualizadas.');return;}
 if(target.dataset.userPassword){document.getElementById('userPasswordForm').reset();document.getElementById('userPasswordId').value=x.id;document.getElementById('passwordModalTitle').textContent='Redefinir senha de @'+x.username;document.getElementById('userPasswordModal').classList.add('open');document.getElementById('userNewPassword').focus();return;}
 if(target.dataset.userActive){if(!confirm(`${x.active?'Desativar':'Ativar'} a conta @${x.username}?`))return;await appApi('/users/'+x.id,'PATCH',{active:!x.active});await refreshUsers();showToast('Status da conta atualizado.');return;}
 if(target.dataset.deleteUser){if(!confirm(`Excluir o acesso de @${x.username}?`))return;await appApi('/users/'+x.id,'DELETE');await refreshUsers();showToast('Conta excluída.');}
 }catch(err){showToast(err.message)}
}

async function saveUserPassword(e){
 e.preventDefault();if(!guard('users_manage'))return;
 const password=document.getElementById('userNewPassword').value,confirm=document.getElementById('userConfirmPassword').value,id=document.getElementById('userPasswordId').value;
 if(password!==confirm)return showToast('As senhas digitadas não conferem.');
 try{await appApi('/users/'+id+'/password','POST',{password});document.getElementById('userPasswordModal').classList.remove('open');await refreshUsers();showToast('Senha redefinida. A sessão antiga foi encerrada.');}
 catch(err){showToast(err.message)}
}

async function syncSharedState(){
 if(!authUser || document.visibilityState==='hidden' || document.querySelector('.modal.open') || document.activeElement?.closest('form'))return;
 try{const result=await appApi('/state');if(result.revision!==stateRevision){stateRevision=result.revision;state=normalizeStateShape(result.state);renderAll();}}
 catch(e){if(e.message.includes('login')){authUser=null;clearInterval(syncTimer);showAuth('login')}}
}
