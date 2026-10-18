/**
 * Keyboard access for mouse-only controls.
 *
 * Much of the UI is built from <div>/<span> elements with a click handler. They work with a mouse
 * but can't be reached with Tab or activated with Enter/Space. Rather than rewrite hundreds of
 * elements, this finds everything the stylesheets (or inline styles) mark with `cursor: pointer`
 * that isn't natively focusable and gives it the missing pieces: tabindex="0", role="button", and
 * Enter/Space to click. New elements are handled as they appear.
 *
 * Genuinely interactive controls should still be real <button>/<a> elements: this is the safety net.
 */
const NATIVE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"], label';

/** Selectors of every rule with `cursor: pointer`, with :hover/:focus/:active parts removed. */
export function collectPointerSelectors(doc = document) {
  const out = new Set(['[style*="cursor: pointer"]', '[style*="cursor:pointer"]']);
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet
    for (const rule of Array.from(rules || [])) {
      if (!rule.selectorText || !rule.style || rule.style.cursor !== 'pointer') continue;
      for (const raw of rule.selectorText.split(',')) {
        const sel = raw.trim().replace(/:(hover|focus|focus-visible|active|focus-within)\b/g, '');
        if (!sel || sel.includes('::') || /[:]not\(/.test(sel) && sel.length > 200) continue;
        try { doc.createDocumentFragment().querySelector(sel); out.add(sel); } catch { /* invalid here: skip */ }
      }
    }
  }
  return Array.from(out);
}

export function makeKeyboardOperable(el) {
  if (el.matches(NATIVE) || el.closest('[aria-hidden="true"]') || el.hasAttribute('data-kbd')) return;
  el.setAttribute('tabindex', '0');
  el.setAttribute('data-kbd', '1');
  if (!el.getAttribute('role')) el.setAttribute('role', 'button');
}

export function installKeyboardSupport(doc = document) {
  const selector = collectPointerSelectors(doc).join(',');
  if (!selector) return () => {};

  const enhance = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches(selector)) makeKeyboardOperable(root);
    root.querySelectorAll(selector).forEach(makeKeyboardOperable);
  };

  const onKey = (e) => {
    const el = e.target;
    if (!(el instanceof Element) || el.getAttribute('data-kbd') !== '1') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // stops Space from scrolling the page
      el.click();
    }
  };
  doc.addEventListener('keydown', onKey);

  let pending = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const nodes = pending; pending = [];
    nodes.forEach(enhance);
  };
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach((n) => pending.push(n));
    if (!scheduled && pending.length) { scheduled = true; (window.requestAnimationFrame || setTimeout)(flush); }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  enhance(doc.body);

  return () => { doc.removeEventListener('keydown', onKey); observer.disconnect(); };
}
