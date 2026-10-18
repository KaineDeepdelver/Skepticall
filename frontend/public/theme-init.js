// Applies the saved theme before the page paints (kept as a file so the CSP can forbid inline scripts).
document.documentElement.setAttribute('data-theme', localStorage.getItem('omni_theme') || 'dark');
