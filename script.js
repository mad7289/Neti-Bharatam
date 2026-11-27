(() => {
  const languageButton = document.getElementById('languageButton');
  const languageKey = 'netibharatam-language';
  let currentLanguage = 'en';

  try {
    const savedLanguage = localStorage.getItem(languageKey);
    if (savedLanguage === 'en' || savedLanguage === 'te') currentLanguage = savedLanguage;
  } catch (error) {
    // The page remains usable if browser storage is unavailable.
  }

  function applyLanguage(language) {
    currentLanguage = language;
    document.documentElement.lang = language;
    document.querySelectorAll('[data-en][data-te]').forEach((element) => {
      element.textContent = element.dataset[language];
    });
    languageButton.textContent = language === 'en' ? 'తెలుగు' : 'English';
    languageButton.setAttribute('aria-label', language === 'en' ? 'Switch to Telugu' : 'Switch to English');
    try { localStorage.setItem(languageKey, language); } catch (error) { /* Storage is optional. */ }
  }

  languageButton.addEventListener('click', () => {
    applyLanguage(currentLanguage === 'en' ? 'te' : 'en');
  });

  document.getElementById('currentYear').textContent = new Date().getFullYear();
  applyLanguage(currentLanguage);
})();