import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// Per-theme accent palettes — keyed by theme preset id
// Each entry: { id, label, from, to, accent }
const THEME_ACCENTS = {
  'default': [
    { id: 'blue-violet', label: 'Blue Violet', from: '#2952e3', to: '#7c3aed', accent: '#4F6EF7' },
    { id: 'purple-pink', label: 'Purple Pink', from: '#a855f7', to: '#f72585', accent: '#a855f7' },
    { id: 'blue-cyan',   label: 'Blue Cyan',   from: '#1a6fff', to: '#06c8ff', accent: '#1a6fff' },
    { id: 'violet',      label: 'Violet',      from: '#8b5cf6', to: '#6d28d9', accent: '#8b5cf6' },
    { id: 'indigo',      label: 'Indigo',      from: '#6366f1', to: '#4338ca', accent: '#6366f1' },
  ],
  'amoled': [
    { id: 'white',       label: 'White',       from: '#e2e2e2', to: '#ffffff', accent: '#ffffff' },
    { id: 'blue-violet', label: 'Blue Violet', from: '#2952e3', to: '#7c3aed', accent: '#4F6EF7' },
    { id: 'teal',        label: 'Teal',        from: '#0ea5e9', to: '#14b8a6', accent: '#0ea5e9' },
  ],
  'ocean': [
    { id: 'sky',         label: 'Sky',         from: '#38bdf8', to: '#0284c7', accent: '#38bdf8' },
    { id: 'blue-cyan',   label: 'Blue Cyan',   from: '#1a6fff', to: '#06c8ff', accent: '#1a6fff' },
    { id: 'teal',        label: 'Teal',        from: '#0ea5e9', to: '#14b8a6', accent: '#0ea5e9' },
  ],
  'terminal': [
    { id: 'green',       label: 'Green',       from: '#22c55e', to: '#16a34a', accent: '#22c55e' },
    { id: 'emerald',     label: 'Emerald',     from: '#10b981', to: '#059669', accent: '#10b981' },
    { id: 'lime',        label: 'Lime',        from: '#a3e635', to: '#65a30d', accent: '#84cc16' },
  ],
  'volcanic': [
    { id: 'red',         label: 'Red',         from: '#ef4444', to: '#dc2626', accent: '#ef4444' },
    { id: 'pink-orange', label: 'Pink Orange', from: '#f72585', to: '#f97316', accent: '#f72585' },
    { id: 'amber',       label: 'Amber',       from: '#f59e0b', to: '#f97316', accent: '#f59e0b' },
  ],
  'nordic': [
    { id: 'sky',         label: 'Sky',         from: '#38bdf8', to: '#0284c7', accent: '#38bdf8' },
    { id: 'blue-cyan',   label: 'Blue Cyan',   from: '#1a6fff', to: '#06c8ff', accent: '#1a6fff' },
    { id: 'teal',        label: 'Teal',        from: '#0ea5e9', to: '#14b8a6', accent: '#0ea5e9' },
  ],
  'dracula': [
    { id: 'purple-pink', label: 'Purple Pink', from: '#a855f7', to: '#f72585', accent: '#a855f7' },
    { id: 'violet',      label: 'Violet',      from: '#8b5cf6', to: '#6d28d9', accent: '#8b5cf6' },
    { id: 'hot-pink',    label: 'Hot Pink',    from: '#ec4899', to: '#db2777', accent: '#ec4899' },
  ],
  'galaxy': [
    { id: 'purple-pink', label: 'Purple Pink', from: '#a855f7', to: '#f72585', accent: '#a855f7' },
    { id: 'violet',      label: 'Violet',      from: '#8b5cf6', to: '#6d28d9', accent: '#8b5cf6' },
    { id: 'hot-pink',    label: 'Hot Pink',    from: '#ec4899', to: '#db2777', accent: '#ec4899' },
  ],
  // Light themes
  'light-default': [
    { id: 'blue-violet', label: 'Blue Violet', from: '#2952e3', to: '#7c3aed', accent: '#4F6EF7' },
    { id: 'purple-pink', label: 'Purple Pink', from: '#a855f7', to: '#f72585', accent: '#a855f7' },
    { id: 'violet',      label: 'Violet',      from: '#8b5cf6', to: '#6d28d9', accent: '#8b5cf6' },
    { id: 'teal',        label: 'Teal',        from: '#0ea5e9', to: '#14b8a6', accent: '#0ea5e9' },
  ],
  'light-warm': [
    { id: 'amber',       label: 'Amber',       from: '#f59e0b', to: '#f97316', accent: '#f59e0b' },
    { id: 'gold',        label: 'Gold',        from: '#fbbf24', to: '#d97706', accent: '#fbbf24' },
    { id: 'pink-orange', label: 'Pink Orange', from: '#f72585', to: '#f97316', accent: '#f72585' },
  ],
  'light-rose': [
    { id: 'rose',        label: 'Rose',        from: '#fb7185', to: '#e11d48', accent: '#fb7185' },
    { id: 'hot-pink',    label: 'Hot Pink',    from: '#ec4899', to: '#db2777', accent: '#ec4899' },
    { id: 'purple-pink', label: 'Purple Pink', from: '#a855f7', to: '#f72585', accent: '#a855f7' },
  ],
  'light-slate': [
    { id: 'blue-violet', label: 'Blue Violet', from: '#2952e3', to: '#7c3aed', accent: '#4F6EF7' },
    { id: 'teal',        label: 'Teal',        from: '#0ea5e9', to: '#14b8a6', accent: '#0ea5e9' },
    { id: 'indigo',      label: 'Indigo',      from: '#6366f1', to: '#4338ca', accent: '#6366f1' },
  ],
};

// Default accent id per theme
const THEME_DEFAULT_ACCENT = {
  'default':       'blue-violet',
  'amoled':        'blue-violet',
  'ocean':         'sky',
  'terminal':      'green',
  'volcanic':      'red',
  'nordic':        'sky',
  'dracula':       'purple-pink',
  'galaxy':        'purple-pink',
  'light-default': 'blue-violet',
  'light-warm':    'amber',
  'light-rose':    'rose',
  'light-slate':   'blue-violet',
};

// Flat list kept for backward compat (accent lookup by id across all themes)
const ACCENT_PRESETS = Object.values(THEME_ACCENTS).flat().filter(
  (a, i, arr) => arr.findIndex(b => b.id === a.id) === i
);

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r}, ${g}, ${b}`;
}

// Relative luminance per WCAG 2.1
function luminance(hex) {
  const toLinear = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const r = toLinear(parseInt(hex.slice(1,3),16));
  const g = toLinear(parseInt(hex.slice(3,5),16));
  const b = toLinear(parseInt(hex.slice(5,7),16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Returns '#ffffff' or '#000000' based on which gives better contrast on the given bg
function contrastText(hex) {
  return luminance(hex) > 0.35 ? '#000000' : '#ffffff';
}

// Average the two gradient stop colors to pick text for gradient backgrounds
function contrastTextForGradient(from, to) {
  const lum = (luminance(from) + luminance(to)) / 2;
  return lum > 0.35 ? '#000000' : '#ffffff';
}

// Lighten a hex color for hover (mix with white)
function lightenHex(hex, amount = 0.2) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const lr = Math.round(r + (255-r)*amount);
  const lg = Math.round(g + (255-g)*amount);
  const lb = Math.round(b + (255-b)*amount);
  return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
}

function applyAccent(from, to, accent) {
  const root = document.documentElement;
  root.style.setProperty('--accent',        accent);
  root.style.setProperty('--accent-hover',  lightenHex(accent, 0.2));
  root.style.setProperty('--accent-glow',   `rgba(${hexToRgb(accent)}, 0.22)`);
  root.style.setProperty('--gradient',      `linear-gradient(135deg, ${from} 0%, ${to} 100%)`);
  root.style.setProperty('--accent-from',   from);
  root.style.setProperty('--accent-to',     to);
  // Outgoing bubbles follow the accent gradient
  root.style.setProperty('--bubble-out-bg', `linear-gradient(135deg, ${from} 0%, ${to} 100%)`);
  // Contrast-safe text colors — white on dark accents, black on bright ones
  const accentText    = contrastText(accent);
  const gradientText  = contrastTextForGradient(from, to);
  root.style.setProperty('--accent-text',        accentText);
  root.style.setProperty('--bubble-out-text',     gradientText);
  // Sub-tones for timestamps and ticks on outgoing bubbles
  const isLight = gradientText === '#000000';
  root.style.setProperty('--time-out', isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)');
  root.style.setProperty('--tick-out', isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)');
  root.style.setProperty('--tick-read-out', isLight ? 'rgba(0,0,0,0.85)' : '#ffffff');
}

// Full-app background theme presets — each preset directly overrides --bg-* variables.
// light:true presets also set text colors since they flip the whole palette.
const THEME_PRESETS = [
  // ── DARK THEMES ──────────────────────────────────────────────────────────
  {
    id: 'default', label: 'Skepticall Dark', dark: true,
    swatch: 'linear-gradient(135deg, #0D0D1A 50%, #825AFF)',
    vars: null, // falls back to CSS :root defaults
  },
  {
    id: 'amoled', label: 'AMOLED', dark: true,
    swatch: 'linear-gradient(135deg, #111111 60%, #2a2a2a)',
    vars: {
      '--bg-body':     '#111111',
      '--bg-primary':  'rgba(22,22,22,0.92)',
      '--bg-sidebar':  'rgba(18,18,18,0.96)',
      '--bg-card':     'rgba(28,28,28,0.90)',
      '--bg-input':    'rgba(20,20,20,0.95)',
      '--bg-hover':    'rgba(255,255,255,0.08)',
      '--bg-menu':     '#1a1a1a',
      '--border':      'rgba(255,255,255,0.12)',
      '--border-input':'rgba(255,255,255,0.18)',
      '--text-primary':   '#ffffff',
      '--text-secondary': 'rgba(255,255,255,0.78)',
      '--text-muted':     'rgba(255,255,255,0.48)',
    },
  },
  {
    id: 'ocean', label: 'Deep Sea', dark: true,
    swatch: 'linear-gradient(135deg, #0a1628 50%, #1565a0)',
    vars: {
      '--bg-body':     '#0a1628',
      '--bg-primary':  'rgba(12,24,52,0.90)',
      '--bg-sidebar':  'rgba(8,18,40,0.96)',
      '--bg-card':     'rgba(14,28,60,0.85)',
      '--bg-input':    'rgba(10,20,44,0.92)',
      '--bg-hover':    'rgba(30,144,255,0.12)',
      '--bg-menu':     'rgba(8,18,42,0.99)',
      '--border':      'rgba(30,144,255,0.22)',
      '--border-input':'rgba(30,144,255,0.36)',
      '--text-primary':   '#cce8ff',
      '--text-secondary': 'rgba(180,220,255,0.80)',
      '--text-muted':     'rgba(120,180,240,0.55)',
    },
  },
  {
    id: 'terminal', label: 'Terminal', dark: true,
    swatch: 'linear-gradient(135deg, #0d1a0d 50%, #00ff41 100%)',
    vars: {
      '--bg-body':     '#0d1a0d',
      '--bg-primary':  'rgba(16,28,16,0.92)',
      '--bg-sidebar':  'rgba(12,22,12,0.96)',
      '--bg-card':     'rgba(20,34,20,0.88)',
      '--bg-input':    'rgba(14,26,14,0.94)',
      '--bg-hover':    'rgba(0,255,65,0.10)',
      '--bg-menu':     'rgba(12,22,12,0.99)',
      '--border':      'rgba(0,255,65,0.20)',
      '--border-input':'rgba(0,255,65,0.32)',
      '--text-primary':   '#afffaf',
      '--text-secondary': 'rgba(160,255,160,0.82)',
      '--text-muted':     'rgba(100,220,100,0.58)',
    },
  },
  {
    id: 'volcanic', label: 'Volcanic', dark: true,
    swatch: 'linear-gradient(135deg, #1e0800 50%, #ff4500)',
    vars: {
      '--bg-body':     '#1e0800',
      '--bg-primary':  'rgba(36,14,0,0.90)',
      '--bg-sidebar':  'rgba(28,10,0,0.96)',
      '--bg-card':     'rgba(44,18,4,0.86)',
      '--bg-input':    'rgba(32,12,0,0.93)',
      '--bg-hover':    'rgba(255,80,0,0.12)',
      '--bg-menu':     'rgba(28,10,0,0.99)',
      '--border':      'rgba(255,80,0,0.24)',
      '--border-input':'rgba(255,80,0,0.38)',
      '--text-primary':   '#ffd4b0',
      '--text-secondary': 'rgba(255,200,150,0.82)',
      '--text-muted':     'rgba(220,140,80,0.58)',
    },
  },
  {
    id: 'nordic', label: 'Nordic', dark: true,
    swatch: 'linear-gradient(135deg, #1e2a3e 50%, #4a6fa5)',
    vars: {
      '--bg-body':     '#1e2a3e',
      '--bg-primary':  'rgba(28,38,58,0.90)',
      '--bg-sidebar':  'rgba(22,32,50,0.96)',
      '--bg-card':     'rgba(32,44,66,0.85)',
      '--bg-input':    'rgba(24,34,54,0.93)',
      '--bg-hover':    'rgba(74,111,165,0.14)',
      '--bg-menu':     'rgba(22,32,52,0.99)',
      '--border':      'rgba(100,148,210,0.22)',
      '--border-input':'rgba(100,148,210,0.36)',
      '--text-primary':   '#dce8f5',
      '--text-secondary': 'rgba(216,230,248,0.80)',
      '--text-muted':     'rgba(160,196,236,0.55)',
    },
  },
  {
    id: 'dracula', label: 'Dracula', dark: true,
    swatch: 'linear-gradient(135deg, #242535 50%, #bd93f9)',
    vars: {
      '--bg-body':     '#242535',
      '--bg-primary':  'rgba(36,38,54,0.92)',
      '--bg-sidebar':  'rgba(30,32,48,0.96)',
      '--bg-card':     'rgba(44,46,64,0.88)',
      '--bg-input':    'rgba(32,34,50,0.94)',
      '--bg-hover':    'rgba(189,147,249,0.12)',
      '--bg-menu':     'rgba(30,32,48,0.99)',
      '--border':      'rgba(189,147,249,0.20)',
      '--border-input':'rgba(189,147,249,0.34)',
      '--text-primary':   '#f8f8f2',
      '--text-secondary': 'rgba(248,248,242,0.80)',
      '--text-muted':     'rgba(200,190,230,0.55)',
    },
  },
  {
    id: 'galaxy', label: 'Galaxy', dark: true,
    swatch: 'linear-gradient(135deg, #130025 30%, #6600cc 70%, #ff0080)',
    vars: {
      '--bg-body':     '#130025',
      '--bg-primary':  'rgba(22,0,44,0.90)',
      '--bg-sidebar':  'rgba(16,0,36,0.96)',
      '--bg-card':     'rgba(28,0,54,0.86)',
      '--bg-input':    'rgba(18,0,40,0.93)',
      '--bg-hover':    'rgba(180,0,255,0.13)',
      '--bg-menu':     'rgba(16,0,36,0.99)',
      '--border':      'rgba(180,0,255,0.24)',
      '--border-input':'rgba(220,0,255,0.36)',
      '--text-primary':   '#f0d0ff',
      '--text-secondary': 'rgba(230,180,255,0.82)',
      '--text-muted':     'rgba(180,100,240,0.58)',
    },
  },

  // ── LIGHT THEMES ─────────────────────────────────────────────────────────
  {
    id: 'light-default', label: 'Cloud', dark: false,
    swatch: 'linear-gradient(135deg, #f0f0ff 50%, #c4b5fd)',
    vars: {
      '--bg-body':     '#f5f5ff',
      '--bg-primary':  'rgba(255,255,255,0.80)',
      '--bg-sidebar':  'rgba(240,240,255,0.90)',
      '--bg-card':     'rgba(255,255,255,0.75)',
      '--bg-input':    'rgba(255,255,255,0.90)',
      '--bg-hover':    'rgba(130,90,255,0.07)',
      '--bg-menu':     'rgba(255,255,255,0.98)',
      '--border':      'rgba(0,0,0,0.08)',
      '--border-input':'rgba(0,0,0,0.14)',
      '--text-primary':   '#0a0a1a',
      '--text-secondary': '#333344',
      '--text-muted':     '#888899',
    },
  },
  {
    id: 'light-warm', label: 'Parchment', dark: false,
    swatch: 'linear-gradient(135deg, #fdf6e3 50%, #c8a96e)',
    vars: {
      '--bg-body':     '#fdf6e3',
      '--bg-primary':  'rgba(253,246,224,0.85)',
      '--bg-sidebar':  'rgba(245,236,210,0.92)',
      '--bg-card':     'rgba(255,250,235,0.80)',
      '--bg-input':    'rgba(255,252,240,0.92)',
      '--bg-hover':    'rgba(180,130,60,0.08)',
      '--bg-menu':     'rgba(250,242,220,0.99)',
      '--border':      'rgba(160,120,60,0.14)',
      '--border-input':'rgba(160,120,60,0.22)',
      '--text-primary':   '#2c1e0a',
      '--text-secondary': '#5c3d1a',
      '--text-muted':     '#9c7a4a',
    },
  },
  {
    id: 'light-rose', label: 'Rosé', dark: false,
    swatch: 'linear-gradient(135deg, #fff0f3 50%, #ffb3c1)',
    vars: {
      '--bg-body':     '#fff0f3',
      '--bg-primary':  'rgba(255,240,243,0.85)',
      '--bg-sidebar':  'rgba(255,228,234,0.92)',
      '--bg-card':     'rgba(255,245,248,0.80)',
      '--bg-input':    'rgba(255,250,252,0.92)',
      '--bg-hover':    'rgba(255,100,130,0.07)',
      '--bg-menu':     'rgba(255,244,247,0.99)',
      '--border':      'rgba(220,80,110,0.12)',
      '--border-input':'rgba(220,80,110,0.20)',
      '--text-primary':   '#2a0a10',
      '--text-secondary': '#6b2030',
      '--text-muted':     '#b06070',
    },
  },
  {
    id: 'light-slate', label: 'Paper', dark: false,
    swatch: 'linear-gradient(135deg, #f1f5f9 50%, #94a3b8)',
    vars: {
      '--bg-body':     '#f1f5f9',
      '--bg-primary':  'rgba(248,250,252,0.85)',
      '--bg-sidebar':  'rgba(226,232,240,0.92)',
      '--bg-card':     'rgba(255,255,255,0.80)',
      '--bg-input':    'rgba(255,255,255,0.92)',
      '--bg-hover':    'rgba(100,116,139,0.08)',
      '--bg-menu':     'rgba(248,250,252,0.99)',
      '--border':      'rgba(0,0,0,0.09)',
      '--border-input':'rgba(0,0,0,0.15)',
      '--text-primary':   '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted':     '#64748b',
    },
  },
];

const PRESET_VAR_KEYS = [
  '--bg-body','--bg-primary','--bg-topbar','--bg-sidebar','--bg-card',
  '--bg-input','--bg-hover','--bg-menu','--border','--border-input',
  '--text-primary','--text-secondary','--text-muted',
];

function applyThemePreset(preset, setThemeFn) {
  const root = document.documentElement;
  if (!preset || preset.id === 'default' || !preset.vars) {
    PRESET_VAR_KEYS.forEach(k => root.style.removeProperty(k));
    return;
  }
  PRESET_VAR_KEYS.forEach(k => root.style.removeProperty(k));
  Object.entries(preset.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Topbar shares the primary surface's tint — without this it stays stuck
  // on the default theme's background since no preset sets it explicitly.
  if (preset.vars['--bg-primary'] && !preset.vars['--bg-topbar']) {
    root.style.setProperty('--bg-topbar', preset.vars['--bg-primary']);
  }
  // Light presets force light theme, dark presets force dark theme
  if (setThemeFn) setThemeFn(preset.dark === false ? 'light' : 'dark');
}

// Bubble shape presets — keyed by id, applied as [data-bubble-style] on <html>
const BUBBLE_STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'telegram-tail', label: 'Telegram tail' },
];

export { ACCENT_PRESETS, THEME_ACCENTS, THEME_DEFAULT_ACCENT, THEME_PRESETS, BUBBLE_STYLES };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('omni_theme') || 'dark');
  const [accentId, setAccentId] = useState(() => localStorage.getItem('omni_accent_id') || 'blue-violet');
  const [themePresetId, setThemePresetId] = useState(() => localStorage.getItem('omni_theme_preset') || 'default');
  const [bubbleStyleId, setBubbleStyleId] = useState(() => localStorage.getItem('omni_bubble_style') || 'classic');

  // Apply bubble style
  useEffect(() => {
    document.documentElement.setAttribute('data-bubble-style', bubbleStyleId);
    localStorage.setItem('omni_bubble_style', bubbleStyleId);
  }, [bubbleStyleId]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('omni_theme', theme);
  }, [theme]);

  // Apply accent whenever it changes
  useEffect(() => {
    const themeAccents = THEME_ACCENTS[themePresetId] || THEME_ACCENTS['default'];
    const preset = themeAccents.find(p => p.id === accentId) || themeAccents[0];
    if (!preset) return;
    applyAccent(preset.from, preset.to, preset.accent);
    localStorage.setItem('omni_accent_id', accentId);
  }, [accentId, themePresetId]);

  // Sync from other tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'omni_theme'        && e.newValue) setTheme(e.newValue);
      if (e.key === 'omni_accent_id'    && e.newValue) setAccentId(e.newValue);
      if (e.key === 'omni_bubble_style' && e.newValue) setBubbleStyleId(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Apply theme preset (background tint + auto light/dark switch)
  // Also reset accent to the new theme's default
  useEffect(() => {
    const preset = THEME_PRESETS.find(p => p.id === themePresetId) || THEME_PRESETS[0];
    applyThemePreset(preset, setTheme);
    localStorage.setItem('omni_theme_preset', themePresetId);
    // Switch accent to this theme's default
    const defaultAccentId = THEME_DEFAULT_ACCENT[themePresetId] || 'blue-violet';
    setAccentId(defaultAccentId);
  }, [themePresetId]);

  // When theme is light but the active preset is a dark one (or default),
  // clear any inline CSS vars it wrote so [data-theme="light"] stylesheet rules win
  useEffect(() => {
    if (theme === 'light') {
      const currentPreset = THEME_PRESETS.find(p => p.id === themePresetId);
      if (!currentPreset || currentPreset.dark !== false) {
        const root = document.documentElement;
        PRESET_VAR_KEYS.forEach(k => root.style.removeProperty(k));
      }
    }
  }, [theme, themePresetId]);

  const toggleTheme = () => setTheme(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    if (next === 'light') {
      const currentPreset = THEME_PRESETS.find(p => p.id === themePresetId);
      if (!currentPreset || currentPreset.dark !== false) {
        const root = document.documentElement;
        PRESET_VAR_KEYS.forEach(k => root.style.removeProperty(k));
      }
    }
    return next;
  });

  const setAccent = (id) => {
    setAccentId(id);
    const themeAccents = THEME_ACCENTS[themePresetId] || THEME_ACCENTS['default'];
    const preset = themeAccents.find(p => p.id === id);
    if (preset) applyAccent(preset.from, preset.to, preset.accent);
  };

  const setThemePreset = (id) => setThemePresetId(id);
  const setBubbleStyle = (id) => setBubbleStyleId(id);

  // Accents available for the current theme
  const currentAccents = THEME_ACCENTS[themePresetId] || THEME_ACCENTS['default'];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentId, setAccent, ACCENT_PRESETS, currentAccents, THEME_ACCENTS, themePresetId, setThemePreset, THEME_PRESETS, bubbleStyleId, setBubbleStyle, BUBBLE_STYLES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);