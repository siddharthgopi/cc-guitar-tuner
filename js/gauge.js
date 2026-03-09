import { getCentsThreshold } from './settings.js';

const CONFIG = {
  cx: 150,
  cy: 155,
  radius: 120,
  outerRadius: 128,
  startAngle: -135,
  endAngle: 135,
  trackWidth: 14,
  zoneWidth: 12,
  needleLength: 90,
  needleBaseWidth: 8,
};

const AA = { 'shape-rendering': 'geometricPrecision' };

// Spring physics parameters
const SPRING = {
  stiffness: 180,
  damping: 12,
  mass: 1,
  restThreshold: 0.1,
  velocityThreshold: 0.5,
};

// Ghost needle (glow trail) config
const GHOST_COUNT = 4;
const GHOST_OPACITIES = [0.15, 0.10, 0.06, 0.03];
const GHOST_FRAME_OFFSETS = [3, 6, 9, 12];
const ANGLE_HISTORY_SIZE = 16;

let needle = null;
let flatZone = null;
let inTuneZone = null;
let sharpZone = null;
let glowCircle = null;
let centerDotOuter = null;
let ghostNeedles = [];
let angleHistory = [];
let historyIndex = 0;

// Spring physics state
const spring = {
  current: 0,
  velocity: 0,
  target: 0,
  animating: false,
  animId: null,
  lastTime: 0,
};

let prefersReducedMotion = false;

function checkReducedMotion() {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  prefersReducedMotion = mql.matches;
  mql.addEventListener('change', (e) => { prefersReducedMotion = e.matches; });
}

export function initGauge(svgElement) {
  const { cx, cy, radius, outerRadius, startAngle, endAngle, trackWidth, zoneWidth, needleLength, needleBaseWidth } = CONFIG;
  const range = endAngle - startAngle;

  svgElement.innerHTML = '';
  checkReducedMotion();

  // Reset spring state
  spring.current = 0;
  spring.velocity = 0;
  spring.target = 0;
  spring.animating = false;
  if (spring.animId) cancelAnimationFrame(spring.animId);
  spring.animId = null;

  // Reset ghost state
  ghostNeedles = [];
  angleHistory = new Array(ANGLE_HISTORY_SIZE).fill(0);
  historyIndex = 0;

  // --- Defs: filters & gradients ---
  const defs = createEl('defs', {});

  // Glow filter for zone arcs (tightened region)
  const glowFilter = createEl('filter', { id: 'glow', x: '-25%', y: '-25%', width: '150%', height: '150%' });
  const blur = createEl('feGaussianBlur', { stdDeviation: '4', result: 'coloredBlur' });
  const merge = createEl('feMerge', {});
  merge.appendChild(createEl('feMergeNode', { in: 'coloredBlur' }));
  merge.appendChild(createEl('feMergeNode', { in: 'SourceGraphic' }));
  glowFilter.appendChild(blur);
  glowFilter.appendChild(merge);
  defs.appendChild(glowFilter);

  // Needle shadow filter (tightened region)
  const needleShadow = createEl('filter', { id: 'needle-shadow', x: '-25%', y: '-25%', width: '150%', height: '150%' });
  needleShadow.appendChild(createEl('feDropShadow', { dx: '0', dy: '1', stdDeviation: '2', 'flood-color': 'rgba(0,0,0,0.5)', 'flood-opacity': '0.5' }));
  defs.appendChild(needleShadow);

  // Ghost needle blur filter
  const ghostBlur = createEl('filter', { id: 'ghost-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  ghostBlur.appendChild(createEl('feGaussianBlur', { stdDeviation: '2', in: 'SourceGraphic' }));
  defs.appendChild(ghostBlur);

  // Zone arc gradients (fade from translucent at edges to opaque at center)
  const gradients = [
    { id: 'grad-flat', color: 'var(--color-gauge-flat)' },
    { id: 'grad-intune', color: 'var(--color-gauge-in-tune)' },
    { id: 'grad-sharp', color: 'var(--color-gauge-sharp)' },
  ];
  gradients.forEach(({ id, color }) => {
    const grad = createEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: cx - radius, y1: '0', x2: cx + radius, y2: '0' });
    grad.appendChild(createEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.5' }));
    grad.appendChild(createEl('stop', { offset: '50%', 'stop-color': color, 'stop-opacity': '1' }));
    grad.appendChild(createEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0.5' }));
    defs.appendChild(grad);
  });

  svgElement.appendChild(defs);

  // --- Outer decorative ring ---
  svgElement.appendChild(createPath(
    arcPath(cx, cy, outerRadius, startAngle, endAngle),
    { stroke: 'var(--color-border)', 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round', opacity: '0.5', ...AA }
  ));

  // --- Background track ---
  svgElement.appendChild(createPath(
    arcPath(cx, cy, radius, startAngle, endAngle),
    { stroke: 'var(--color-gauge-track)', 'stroke-width': trackWidth, fill: 'none', 'stroke-linecap': 'round', ...AA }
  ));

  // --- Zone arcs with glow & gradient strokes ---
  // All zones match trackWidth so they fully cover the background track.
  // Zones are contiguous (no angular gaps) for a seamless arc.

  // Flat zone (left)
  flatZone = createPath(
    arcPath(cx, cy, radius, startAngle, startAngle + range * 0.35),
    { stroke: 'url(#grad-flat)', 'stroke-width': trackWidth, fill: 'none', 'stroke-linecap': 'butt', opacity: '0.35', ...AA }
  );
  svgElement.appendChild(flatZone);

  // In-tune zone (center)
  inTuneZone = createPath(
    arcPath(cx, cy, radius, startAngle + range * 0.35, startAngle + range * 0.65),
    { stroke: 'url(#grad-intune)', 'stroke-width': trackWidth, fill: 'none', 'stroke-linecap': 'butt', opacity: '0.35', ...AA }
  );
  svgElement.appendChild(inTuneZone);

  // Sharp zone (right)
  sharpZone = createPath(
    arcPath(cx, cy, radius, startAngle + range * 0.65, endAngle),
    { stroke: 'url(#grad-sharp)', 'stroke-width': trackWidth, fill: 'none', 'stroke-linecap': 'butt', opacity: '0.35', ...AA }
  );
  svgElement.appendChild(sharpZone);

  // --- Fine tick marks every 10 cents ---
  for (let cents = -50; cents <= 50; cents += 10) {
    const angle = (cents / 50) * (range / 2);
    const angleDeg = angle - 90;
    const angleRad = angleDeg * Math.PI / 180;
    const isMajor = cents % 25 === 0;
    const isCenter = cents === 0;

    const innerR = isCenter ? radius - 24 : isMajor ? radius - 20 : radius - 16;
    const outerR = radius - 8;

    svgElement.appendChild(createEl('line', {
      x1: cx + innerR * Math.cos(angleRad),
      y1: cy + innerR * Math.sin(angleRad),
      x2: cx + outerR * Math.cos(angleRad),
      y2: cy + outerR * Math.sin(angleRad),
      stroke: isCenter ? 'var(--color-gauge-in-tune)' : 'var(--color-text-secondary)',
      'stroke-width': isCenter ? 3 : isMajor ? 2 : 1,
      'stroke-linecap': 'round',
      opacity: isCenter ? '0.9' : isMajor ? '0.5' : '0.25',
      'vector-effect': 'non-scaling-stroke',
      ...AA,
    }));
  }

  // --- Labels at -50, 0, +50 ---
  const labelPositions = [
    { cents: -50, text: '-50' },
    { cents: 0, text: '0' },
    { cents: 50, text: '+50' },
  ];
  labelPositions.forEach(({ cents, text }) => {
    const angle = (cents / 50) * (range / 2);
    const angleDeg = angle - 90;
    const angleRad = angleDeg * Math.PI / 180;
    const labelR = radius - 32;

    svgElement.appendChild(createEl('text', {
      x: cx + labelR * Math.cos(angleRad),
      y: cy + labelR * Math.sin(angleRad),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': '9',
      'font-family': 'var(--font-primary)',
      fill: 'var(--color-text-secondary)',
      opacity: '0.5',
      'text-rendering': 'optimizeLegibility',
    })).textContent = text;
  });

  // --- Tapered needle (path with rounded tip) ---
  const needleTipY = cy - needleLength;
  const halfBase = needleBaseWidth / 2;
  const tipR = 1.5; // rounded tip radius
  const needlePath = `M ${cx - halfBase} ${cy + 4} L ${cx - tipR} ${needleTipY + tipR} Q ${cx} ${needleTipY - 0.5} ${cx + tipR} ${needleTipY + tipR} L ${cx + halfBase} ${cy + 4} Z`;

  // --- Ghost needles (glow trail, rendered behind main needle) ---
  for (let i = GHOST_COUNT - 1; i >= 0; i--) {
    const ghost = createEl('path', {
      d: needlePath,
      fill: 'var(--color-accent)',
      opacity: '0',
      filter: 'url(#ghost-blur)',
      class: 'ghost-needle',
      ...AA,
    });
    ghost.style.transformOrigin = `${cx}px ${cy}px`;
    svgElement.appendChild(ghost);
    ghostNeedles.unshift(ghost);
  }

  needle = createEl('path', {
    d: needlePath,
    fill: 'var(--color-gauge-needle)',
    class: 'gauge-needle',
    filter: 'url(#needle-shadow)',
    ...AA,
  });
  needle.style.transformOrigin = `${cx}px ${cy}px`;
  svgElement.appendChild(needle);

  // --- Center assembly ---
  // Outer ring
  centerDotOuter = createEl('circle', {
    cx, cy, r: 10,
    fill: 'none',
    stroke: 'var(--color-gauge-needle)',
    'stroke-width': 2,
    opacity: '0.4',
    ...AA,
  });
  svgElement.appendChild(centerDotOuter);

  // Center filled dot
  svgElement.appendChild(createEl('circle', {
    cx, cy, r: 7,
    fill: 'var(--color-bg-card)',
    stroke: 'var(--color-gauge-needle)',
    'stroke-width': 2,
    ...AA,
  }));

  // Inner accent dot
  glowCircle = createEl('circle', {
    cx, cy, r: 3.5,
    fill: 'var(--color-accent)',
    opacity: '0.8',
    class: 'gauge-center-glow',
    ...AA,
  });
  svgElement.appendChild(glowCircle);
}

export function updateGauge(cents) {
  if (!needle) return;

  const clampedCents = Math.max(-50, Math.min(50, cents));
  const { startAngle, endAngle } = CONFIG;
  const range = endAngle - startAngle;
  const angle = (clampedCents / 50) * (range / 2);

  // Set spring target (needle animates via spring physics)
  spring.target = angle;

  // Zone brightness updates are instant (not spring-animated)
  const absCents = Math.abs(clampedCents);
  if (flatZone && inTuneZone && sharpZone) {
    const inTuneProximity = 1 - absCents / 50;
    const flatProximity = clampedCents < -5 ? absCents / 50 : 0;
    const sharpProximity = clampedCents > 5 ? absCents / 50 : 0;

    flatZone.setAttribute('opacity', (0.35 + flatProximity * 0.65).toFixed(2));
    inTuneZone.setAttribute('opacity', (0.35 + inTuneProximity * 0.65).toFixed(2));
    sharpZone.setAttribute('opacity', (0.35 + sharpProximity * 0.65).toFixed(2));
  }

  // Pulse center dot when in tune
  if (glowCircle) {
    const isInTune = Math.abs(clampedCents) <= getCentsThreshold();
    glowCircle.setAttribute('r', isInTune ? '5' : '3.5');
    glowCircle.setAttribute('opacity', isInTune ? '1' : '0.8');
    glowCircle.classList.toggle('gauge-glow-pulse', isInTune);
  }

  // Start spring animation or snap for reduced motion
  if (prefersReducedMotion) {
    spring.current = angle;
    spring.velocity = 0;
    applyNeedleAngle(angle);
    ghostNeedles.forEach(g => g.setAttribute('opacity', '0'));
  } else if (!spring.animating) {
    startSpringLoop();
  }
}

// --- Spring physics animation ---

function startSpringLoop() {
  spring.animating = true;
  spring.lastTime = performance.now();
  spring.animId = requestAnimationFrame(springTick);
}

function springTick(timestamp) {
  if (!spring.animating) return;

  const dt = Math.min((timestamp - spring.lastTime) / 1000, 0.033);
  spring.lastTime = timestamp;

  // Damped harmonic oscillator: F = -k*(x-target) - c*v
  const displacement = spring.current - spring.target;
  const springForce = -SPRING.stiffness * displacement;
  const dampingForce = -SPRING.damping * spring.velocity;
  const acceleration = (springForce + dampingForce) / SPRING.mass;

  spring.velocity += acceleration * dt;
  spring.current += spring.velocity * dt;

  applyNeedleAngle(spring.current);

  // Record angle in history for ghost trails
  angleHistory[historyIndex % ANGLE_HISTORY_SIZE] = spring.current;
  historyIndex++;
  updateGhostNeedles();

  // Check if settled
  const isSettled = Math.abs(displacement) < SPRING.restThreshold
                 && Math.abs(spring.velocity) < SPRING.velocityThreshold;

  if (isSettled) {
    spring.current = spring.target;
    spring.velocity = 0;
    spring.animating = false;
    applyNeedleAngle(spring.target);
    ghostNeedles.forEach(g => g.setAttribute('opacity', '0'));
    return;
  }

  spring.animId = requestAnimationFrame(springTick);
}

function applyNeedleAngle(angle) {
  if (!needle) return;
  needle.style.transform = `rotate(${angle}deg)`;
}

// --- Ghost needle (glow trail) updates ---

function updateGhostNeedles() {
  if (ghostNeedles.length === 0) return;

  for (let i = 0; i < GHOST_COUNT; i++) {
    const frameBack = GHOST_FRAME_OFFSETS[i];
    const historicalIdx = ((historyIndex - 1 - frameBack) % ANGLE_HISTORY_SIZE + ANGLE_HISTORY_SIZE) % ANGLE_HISTORY_SIZE;
    const historicalAngle = angleHistory[historicalIdx];

    const angularDist = Math.abs(spring.current - historicalAngle);
    const effectiveOpacity = angularDist > 0.5 ? GHOST_OPACITIES[i] : 0;

    ghostNeedles[i].setAttribute('opacity', effectiveOpacity.toFixed(3));
    ghostNeedles[i].style.transform = `rotate(${historicalAngle}deg)`;
  }
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const startRad = (startDeg - 90) * Math.PI / 180;
  const endRad = (endDeg - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function createPath(d, attrs) {
  return createEl('path', { d, ...attrs });
}

function createEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}
