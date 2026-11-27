(() => {
  const languageButton = document.getElementById('languageButton');
  const languageKey = 'netibharatam-language';
  const viewLinks = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view-panel');
  const footer = document.querySelector('.site-footer');
  const marketLinks = document.querySelectorAll('[data-market]');
  const detailPanels = document.querySelectorAll('.detail-panel');
  let currentLanguage = 'en';

  try {
    const savedLanguage = localStorage.getItem(languageKey);
    if (savedLanguage === 'en' || savedLanguage === 'te') currentLanguage = savedLanguage;
  } catch (error) {}

  function applyLanguage(language) {
    currentLanguage = language;
    document.documentElement.lang = language;
    document.querySelectorAll('[data-en][data-te]').forEach((element) => {
      element.textContent = element.dataset[language];
    });
    languageButton.textContent = language === 'en' ? 'తెలుగు' : 'English';
    languageButton.setAttribute('aria-label', language === 'en' ? 'Switch to Telugu' : 'Switch to English');
    try { localStorage.setItem(languageKey, language); } catch (error) {}
  }

  function showView(viewId) {
    views.forEach((view) => { view.hidden = view.id !== viewId; });
    detailPanels.forEach((panel) => { panel.hidden = true; });
    footer.hidden = false;
    if (viewId) history.replaceState(null, '', '#' + viewId);
  }

  viewLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showView(link.dataset.view);
    });
  });

  marketLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      detailPanels.forEach((panel) => { panel.hidden = panel.id !== link.dataset.market; });
      history.replaceState(null, '', '#' + link.dataset.market);
    });
  });

  document.getElementById('homeLink').addEventListener('click', (event) => {
    event.preventDefault();
    views.forEach((view) => { view.hidden = true; });
    detailPanels.forEach((panel) => { panel.hidden = true; });
    footer.hidden = true;
    history.replaceState(null, '', location.pathname);
  });

  languageButton.addEventListener('click', () => {
    applyLanguage(currentLanguage === 'en' ? 'te' : 'en');
  });

  document.getElementById('currentYear').textContent = new Date().getFullYear();
  applyLanguage(currentLanguage);

  const initialHash = location.hash.slice(1);
  if (['education', 'indian-markets', 'global-markets'].includes(initialHash)) {
    showView(initialHash);
  } else if (['nifty', 'stocks', 'sensex', 'bank-nifty'].includes(initialHash)) {
    showView('indian-markets');
    detailPanels.forEach((panel) => { panel.hidden = panel.id !== initialHash; });
  } else {
    views.forEach((view) => { view.hidden = true; });
    footer.hidden = true;
  }
})();