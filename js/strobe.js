let canvas = null;
let ctx = null;
let animId = null;
let currentCents = 0;
let phase = 0;
let lastTimestamp = 0;
let cachedColors = null;
let isRunning = false;
let idleMode = false;

const NUM_RINGS = 3;
const SEGMENTS_PER_RING = [12, 24, 48];
const ROTATION_SPEED = 3.5; // radians per second per cent offset

export function initStrobe(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  phase = 0;
  currentCents = 0;
  cachedColors = null;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

export function updateStrobe(cents) {
  idleMode = false;
  currentCents = cents;
  if (!isRunning) startLoop();
}

export function startIdleStrobe() {
  idleMode = true;
  currentCents = 0;
  if (!isRunning) startLoop();
}

export function stopStrobeLoop() {
  // Switch back to idle demo when tuning stops
  if (canvas && ctx) {
    startIdleStrobe();
  } else {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }
}

export function destroyStrobe() {
  isRunning = false;
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  window.removeEventListener('resize', resizeCanvas);
  canvas = null;
  ctx = null;
  phase = 0;
  cachedColors = null;
}

function startLoop() {
  if (isRunning) return;
  isRunning = true;
  lastTimestamp = performance.now();
  animId = requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  cachedColors = null; // re-read on next frame
}

function getColors() {
  if (cachedColors) return cachedColors;
  if (!canvas) return { light: 'rgba(100,100,100,0.3)', dark: 'rgba(20,20,20,0.9)', inTune: '#00ff88', muted: '#888' };
  const style = getComputedStyle(canvas);
  cachedColors = {
    light: style.getPropertyValue('--color-strobe-light').trim() || 'rgba(100,100,100,0.3)',
    dark: style.getPropertyValue('--color-strobe-dark').trim() || 'rgba(20,20,20,0.9)',
    inTune: style.getPropertyValue('--color-gauge-in-tune').trim() || '#00ff88',
    muted: style.getPropertyValue('--color-text-secondary').trim() || '#888',
  };
  return cachedColors;
}

export function invalidateColorCache() {
  cachedColors = null;
}

function renderLoop(timestamp) {
  if (!canvas || !isRunning) return;

  const dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (idleMode) {
    // Gentle sine-wave oscillation to demo the strobe effect
    const drift = Math.sin(timestamp / 1200) * 6;
    phase += drift * ROTATION_SPEED * dt * (Math.PI / 180);
  } else {
    // Update phase: positive cents (sharp) = clockwise, negative (flat) = CCW
    phase += currentCents * ROTATION_SPEED * dt * (Math.PI / 180);
  }

  drawFrame();
  animId = requestAnimationFrame(renderLoop);
}

function drawFrame() {
  if (!canvas || !ctx) return;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2;
  const cy = h / 2;
  const maxRadius = Math.min(cx, cy) - 4;
  const colors = getColors();

  ctx.clearRect(0, 0, w, h);

  const ringWidth = maxRadius / (NUM_RINGS + 0.5);

  for (let ring = 0; ring < NUM_RINGS; ring++) {
    const innerR = ring * ringWidth + 8;
    const outerR = (ring + 1) * ringWidth;
    const segments = SEGMENTS_PER_RING[ring];
    const anglePerSegment = (2 * Math.PI) / segments;

    // Each ring rotates at a different rate for visual depth
    const ringPhase = phase * (ring + 1);

    for (let seg = 0; seg < segments; seg++) {
      const startAngle = ringPhase + seg * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;
      const isLight = seg % 2 === 0;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = isLight ? colors.light : colors.dark;
      ctx.fill();
    }
  }

  // Center dot
  const inTune = Math.abs(currentCents) <= 2;
  ctx.beginPath();
  ctx.arc(cx, cy, inTune ? 6 : 4, 0, Math.PI * 2);
  ctx.fillStyle = inTune ? colors.inTune : colors.muted;
  ctx.fill();

  // In-tune glow
  if (inTune) {
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = colors.inTune.replace(')', ', 0.2)').replace('rgb', 'rgba');
    ctx.fill();
  }
}
