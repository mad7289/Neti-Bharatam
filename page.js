(() => {
 const key='netibharatam-language'; let lang='en';
 try { const saved=localStorage.getItem(key); if(saved==='en'||saved==='te') lang=saved; } catch(e) {}
 const button=document.getElementById('languageButton');
 function applyLanguage(next){ lang=next; document.documentElement.lang=lang; document.querySelectorAll('[data-en][data-te]').forEach(el=>{el.textContent=el.dataset[lang];}); button.textContent=lang==='en'?'తెలుగు':'English'; button.setAttribute('aria-label',lang==='en'?'Switch to Telugu':'Switch to English'); try{localStorage.setItem(key,lang);}catch(e){} }
 button.addEventListener('click',()=>applyLanguage(lang==='en'?'te':'en'));
 const year=document.getElementById('currentYear'); if(year) year.textContent=new Date().getFullYear();
 applyLanguage(lang);
})();