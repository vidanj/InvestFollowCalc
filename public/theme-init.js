// Applies the saved theme before the first paint so an explicit choice never flashes.
// Keep the storage key in sync with src/theme/theme.ts.
try {
  var theme = localStorage.getItem('investfollowcalc.theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // Storage unavailable (private mode, blocked): the OS preference applies.
}
