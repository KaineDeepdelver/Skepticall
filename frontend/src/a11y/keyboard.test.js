import { collectPointerSelectors, installKeyboardSupport } from './keyboard';

describe('keyboard support for mouse-only controls', () => {
  let stop;
  beforeEach(() => {
    document.head.innerHTML = '<style>.row{cursor:pointer}.row:hover{background:red}.plain{color:red}.native{cursor:pointer}</style>';
    document.body.innerHTML = `
      <div class="row" id="row">Open</div>
      <div class="plain" id="plain">Not clickable</div>
      <button class="native" id="btn">Real button</button>
      <span id="inline" style="cursor: pointer">Inline</span>
      <div class="row" id="hidden" aria-hidden="true">Decorative</div>`;
  });
  afterEach(() => { if (stop) stop(); stop = null; });

  test('finds the pointer selectors and drops hover states', () => {
    const selectors = collectPointerSelectors();

    expect(selectors).toContain('.row');
    expect(selectors.some((s) => s.includes(':hover'))).toBe(false);
    expect(selectors).not.toContain('.plain');
  });

  test('makes a clickable div focusable and a button role', () => {
    stop = installKeyboardSupport();

    const row = document.getElementById('row');
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.getAttribute('role')).toBe('button');
    expect(document.getElementById('inline').getAttribute('tabindex')).toBe('0');
  });

  test('leaves native controls, plain elements and hidden ones alone', () => {
    stop = installKeyboardSupport();

    expect(document.getElementById('btn').hasAttribute('role')).toBe(false);
    expect(document.getElementById('plain').hasAttribute('tabindex')).toBe(false);
    expect(document.getElementById('hidden').hasAttribute('tabindex')).toBe(false);
  });

  test('Enter and Space click it, other keys do not', () => {
    stop = installKeyboardSupport();
    const row = document.getElementById('row');
    const onClick = jest.fn();
    row.addEventListener('click', onClick);

    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test('elements added later are handled too', async () => {
    stop = installKeyboardSupport();
    const late = document.createElement('div');
    late.className = 'row';
    document.body.appendChild(late);

    await new Promise((r) => setTimeout(r, 50));

    expect(late.getAttribute('tabindex')).toBe('0');
  });
});
