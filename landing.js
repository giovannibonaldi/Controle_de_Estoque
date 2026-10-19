"use strict";
function openLandingLogin(){
  document.getElementById('authGate').style.display='grid';
  document.getElementById('authUsername')?.focus();
}
document.querySelectorAll('[data-landing-login]').forEach(button=>button.addEventListener('click',openLandingLogin));
document.getElementById('landingBack')?.addEventListener('click',()=>document.getElementById('authGate').style.display='none');
document.getElementById('goToPDV')?.addEventListener('click',()=>document.getElementById('pdvSection')?.scrollIntoView({behavior:'smooth',block:'start'}));
