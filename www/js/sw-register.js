// ===============================
// PSM SAWIT - sw-register.js
// ===============================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW REGISTERED v20'))
      .catch(err => console.log('SW FAILED', err));
  });
}
