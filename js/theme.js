const THEMES = [
  { id: 'retro2',  label: 'Studio',     icon: '★' },
  { id: 'retro',    label: 'Retro',      icon: '■' },
  { id: 'vanta3',  label: 'Studio V2',  icon: '◉' },
  { id: 'glass',   label: 'Glass',      icon: '◇' },
  { id: 'dark-neon', label: 'Neon',     icon: '◆' },
  { id: 'minimal', label: 'Clean',      icon: '○' },
];
const STORAGE_KEY = 'guitar-tuner-theme';

let currentIndex = 0;
let vantaEffect = null;

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const idx = THEMES.findIndex(t => t.id === saved);
  if (idx >= 0) currentIndex = idx;
  applyTheme();
}

export function getThemes() {
  return [...THEMES];
}

export function setThemeById(id) {
  const idx = THEMES.findIndex(t => t.id === id);
  if (idx >= 0) {
    currentIndex = idx;
    applyTheme();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return THEMES[currentIndex];
}

function applyTheme() {
  const themeId = THEMES[currentIndex].id;
  document.documentElement.setAttribute('data-theme', themeId);
  updateVanta(themeId);
}

// effect: 'CELLS' uses three.js, effect: 'TOPOLOGY' uses p5.js
const VANTA_CONFIGS = {
  vanta3: { effect: 'TOPOLOGY', scaleMobile: 1.00 },
};

let activeVantaTheme = null;

function updateVanta(themeId) {
  if (VANTA_CONFIGS[themeId]) {
    if (activeVantaTheme !== themeId) {
      destroyVanta();
      activeVantaTheme = themeId;
      initVanta();
    }
  } else {
    destroyVanta();
    activeVantaTheme = null;
  }
}

function initVanta() {
  if (vantaEffect) return;
  const el = document.getElementById('vanta-bg');
  if (!el) return;

  const config = VANTA_CONFIGS[activeVantaTheme];
  if (!config) return;
  const effectKey = config.effect; // 'CELLS' or 'TOPOLOGY'

  // Wait for VANTA + the specific effect to be available (defer-loaded scripts)
  if (typeof VANTA === 'undefined' || !VANTA[effectKey]) {
    const check = setInterval(() => {
      if (typeof VANTA !== 'undefined' && VANTA[effectKey]) {
        clearInterval(check);
        createVantaEffect(el);
      }
    }, 100);
    setTimeout(() => clearInterval(check), 10000);
  } else {
    createVantaEffect(el);
  }
}

function createVantaEffect(el) {
  if (vantaEffect) return;
  const config = VANTA_CONFIGS[activeVantaTheme];
  if (!config) return;
  const { effect, ...params } = config;
  try {
    vantaEffect = VANTA[effect]({
      el,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.00,
      minWidth: 200.00,
      scale: 1.00,
      ...params,
    });
  } catch (e) {
    // Vanta failed to init (e.g. WebGL not supported) — silently continue
  }
}

function destroyVanta() {
  if (vantaEffect) {
    vantaEffect.destroy();
    vantaEffect = null;
  }
}

export function getCurrentTheme() {
  return THEMES[currentIndex];
}
