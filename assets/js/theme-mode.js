/* Preferências de aparência do dispositivo. */
(function(){
  'use strict';
  const THEME_KEY='nexodent:appearance:device:v1';
  const ACCENT_KEY='nexodent:accent:device:v1';
  window.oralValleLocalAccent=function(){
    try {const c=localStorage.getItem(ACCENT_KEY);return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:'#ff7a00'}
    catch(_){return '#ff7a00'}
  };
  window.oralValleSetLocalAccent=function(c){
    if(!/^#[0-9a-fA-F]{6}$/.test(c||''))return;
    try{localStorage.setItem(ACCENT_KEY,c)}catch(_){}
  };
  function enforceLight(){
    document.documentElement.setAttribute('data-ov-mode','light');
    document.documentElement.style.colorScheme='only light';
  }
  function applyAppearance(value){
    document.documentElement.toggleAttribute('data-ov-soft',value==='soft');
  }
  window.oralValleAppearance=function(){
    return document.documentElement.hasAttribute('data-ov-soft')?'soft':'light';
  };
  window.oralValleSetAppearance=function(value){
    if(value!=='light'&&value!=='soft')return;
    applyAppearance(value);
    try{localStorage.setItem(THEME_KEY,value)}catch(_){}
  };
  try{applyAppearance(localStorage.getItem(THEME_KEY))}catch(_){}
  enforceLight();
  // Mantém compatibilidade com chamadas antigas, sem permitir ativar o modo escuro.
  window.oralValleApplyTheme=function(){enforceLight()};
  document.addEventListener('DOMContentLoaded',enforceLight);
  window.addEventListener('pageshow',enforceLight);
  new MutationObserver(function(){
    if(document.documentElement.getAttribute('data-ov-mode')!=='light')enforceLight();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['data-ov-mode']});
})();
