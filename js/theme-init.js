(function () {
  try {
    const saved = localStorage.getItem('atlas-theme');
    if (['arctic', 'midnight', 'gold'].includes(saved)) document.documentElement.dataset.theme = saved;
  } catch { /* Arctic Steel remains the default when browser storage is blocked. */ }
})();
