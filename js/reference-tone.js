import { getAudioContext } from './audio.js';
import { getA4Freq } from './settings.js';

let currentSource = null;
let currentGain = null;
let onEndCallback = null;
const FADE_TIME = 0.05;

// Buffer cache: Map<frequency, AudioBuffer>
const bufferCache = new Map();
const BUFFER_DURATION = 5; // seconds — long enough for low bass notes

/**
 * Generate a plucked-string sound using Karplus-Strong synthesis.
 * Returns an AudioBuffer containing realistic guitar/bass tone.
 */
function generatePluckedBuffer(frequency, sampleRate) {
  const numSamples = Math.ceil(sampleRate * BUFFER_DURATION);
  const buffer = new AudioBuffer({
    length: numSamples,
    sampleRate,
    numberOfChannels: 1,
  });
  const data = buffer.getChannelData(0);

  // Total loop delay must equal exactPeriod = sampleRate / frequency.
  // Components: delay line (N samples) + averaging filter (0.5 samples) + allpass (d samples)
  // So: N + 0.5 + d = exactPeriod, where 0 <= d < 1
  const exactPeriod = sampleRate / frequency;
  const period = Math.floor(exactPeriod - 0.5);
  const d = exactPeriod - period - 0.5;

  // First-order allpass coefficient for fractional delay correction
  const allpassCoeff = (1 - d) / (1 + d);

  // Fill the first period with shaped noise burst
  // Use a mix of random noise with a slight low-pass to warm the initial attack
  for (let i = 0; i < period && i < numSamples; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.95;
  }

  // Pre-filter the noise burst for a warmer pluck (simple 2-sample average)
  for (let i = 1; i < period && i < numSamples; i++) {
    data[i] = 0.5 * data[i] + 0.5 * data[i - 1];
  }

  // Damping factor — lower frequencies get slightly less damping for longer sustain
  const baseDamping = 0.498;
  const damping = frequency < 100 ? 0.4995 : baseDamping;

  // Karplus-Strong loop with fractional delay allpass interpolation
  let allpassState = 0;
  for (let i = period + 1; i < numSamples; i++) {
    // Standard KS averaging filter
    const avg = damping * (data[i - period] + data[i - period - 1]);
    // Allpass filter for fractional delay correction
    const output = allpassCoeff * avg + allpassState;
    allpassState = avg - allpassCoeff * output;
    data[i] = output;
  }

  // Apply a gentle envelope to prevent abrupt cutoff at buffer end
  const fadeOutStart = numSamples - Math.ceil(sampleRate * 0.05);
  for (let i = fadeOutStart; i < numSamples; i++) {
    const t = (i - fadeOutStart) / (numSamples - fadeOutStart);
    data[i] *= 1 - t;
  }

  return buffer;
}

/**
 * Play a plucked-string reference tone at the given frequency.
 * Tone plays once with natural Karplus-Strong decay (no looping).
 */
export function playReferenceTone(frequency, onEnd) {
  stopReferenceTone();

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // Get or generate cached buffer
  const cacheKey = `${Math.round(frequency * 100)}_${getA4Freq()}`;
  let buffer = bufferCache.get(cacheKey);
  if (!buffer) {
    buffer = generatePluckedBuffer(frequency, ctx.sampleRate);
    bufferCache.set(cacheKey, buffer);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // No looping — let the natural pluck decay play out

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.45, ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();

  currentSource = source;
  currentGain = gainNode;
  onEndCallback = onEnd || null;

  source.onended = () => {
    source.disconnect();
    gainNode.disconnect();
    if (currentSource === source) {
      currentSource = null;
      currentGain = null;
    }
    if (onEndCallback) {
      const cb = onEndCallback;
      onEndCallback = null;
      cb();
    }
  };
}

/**
 * Stop the currently playing reference tone with a quick fade-out.
 */
export function stopReferenceTone() {
  if (currentSource) {
    try {
      const ctx = getAudioContext();
      currentGain.gain.cancelScheduledValues(ctx.currentTime);
      currentGain.gain.setValueAtTime(currentGain.gain.value, ctx.currentTime);
      currentGain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
      currentSource.stop(ctx.currentTime + FADE_TIME);
    } catch (e) {
      // Already stopped
    }
    currentSource = null;
    currentGain = null;
  }
}

/**
 * Clear the buffer cache (call when tuning changes if memory is a concern).
 */
export function clearToneCache() {
  bufferCache.clear();
}

/**
 * Play a short, pleasant chime to confirm the string is in tune.
 * Two harmonically related sine tones (fundamental + octave) with
 * a bell-like envelope — gentle enough to not compete with playing.
 */
export function playInTuneChime() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const duration = 0.45;
  const volume = 0.12;

  // Two tones: C6 (1047 Hz) and G6 (1568 Hz) — a perfect fifth, bright and pleasant
  const frequencies = [1047, 1568];

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Bell-like envelope: quick attack, natural decay
    const peakTime = 0.01;
    const toneVolume = i === 0 ? volume : volume * 0.6; // octave slightly quieter
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(toneVolume, now + peakTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });

  // Haptic feedback on mobile (subtle double-pulse)
  if (navigator.vibrate) {
    navigator.vibrate([30, 50, 30]);
  }
}
