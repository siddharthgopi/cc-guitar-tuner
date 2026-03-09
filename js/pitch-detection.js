import { NOTE_NAMES, A4_MIDI } from './tuning-data.js';
import { getA4Freq } from './settings.js';
import { getTemperamentOffset } from './temperament.js';

const GOOD_ENOUGH_CORRELATION = 0.9;
const RMS_THRESHOLD = 0.01;

export function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;

  // Check signal level
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < RMS_THRESHOLD) return null;

  // Normalized autocorrelation
  let bestCorrelation = -1;
  let bestOffset = -1;
  let foundGoodCorrelation = false;
  let lastCorrelation = 1;
  const correlations = new Float32Array(SIZE);

  for (let offset = 2; offset < SIZE; offset++) {
    let correlation = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < SIZE - offset; i++) {
      correlation += buffer[i] * buffer[i + offset];
      norm1 += buffer[i] * buffer[i];
      norm2 += buffer[i + offset] * buffer[i + offset];
    }

    const normFactor = Math.sqrt(norm1 * norm2);
    correlation = normFactor > 0 ? correlation / normFactor : 0;
    correlations[offset] = correlation;

    if (correlation > GOOD_ENOUGH_CORRELATION && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      break;
    }

    lastCorrelation = correlation;
  }

  if (bestCorrelation < GOOD_ENOUGH_CORRELATION) return null;

  // Parabolic interpolation for sub-sample precision
  let shift = 0;
  if (bestOffset > 0 && bestOffset < SIZE - 1) {
    const prev = correlations[bestOffset - 1];
    const curr = correlations[bestOffset];
    const next = correlations[bestOffset + 1];
    const denom = 2 * curr - next - prev;
    if (denom !== 0) {
      shift = (next - prev) / (2 * denom);
    }
  }

  const frequency = sampleRate / (bestOffset + shift);
  return frequencyToNote(frequency);
}

export function frequencyToNote(frequency) {
  const a4Freq = getA4Freq();

  // Step 1: Find nearest equal-temperament note
  const semitonesFromA4 = 12 * Math.log2(frequency / a4Freq);
  const roundedSemitones = Math.round(semitonesFromA4);
  const nearestMidi = A4_MIDI + roundedSemitones;

  const noteIndex = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];

  // Step 2: Compute temperament-adjusted target frequency
  const tempOffset = getTemperamentOffset(noteIndex);
  const equalTempFreq = a4Freq * Math.pow(2, roundedSemitones / 12);
  const adjustedTargetFreq = equalTempFreq * Math.pow(2, tempOffset / 1200);

  // Step 3: Cents deviation from temperament-adjusted target
  const cents = Math.round(1200 * Math.log2(frequency / adjustedTargetFreq));

  return {
    frequency: Math.round(frequency * 100) / 100,
    noteName,
    octave,
    noteIndex,
    midi: nearestMidi,
    cents,
    confidence: 0,
  };
}
