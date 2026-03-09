import { getSettings } from './settings.js';

// Cent offsets from equal temperament for each note (C=0 through B=11),
// with C as the root key. Rotated at runtime for other key centers.

// Pythagorean: built from pure 3:2 fifths (701.955 cents)
// Circle of fifths: C-G-D-A-E-B-F#-C#-Ab-Eb-Bb-F
const PYTHAGOREAN_BASE = [
  0,       // C  (unison)
  -9.78,   // C# (from Db, diminished)
  +3.91,   // D
  -5.87,   // D# (Eb)
  +7.82,   // E
  -1.96,   // F
  -11.73,  // F# (Gb)
  +1.96,   // G
  -7.82,   // G# (Ab)
  +5.87,   // A  (adjusted to 0 offset when A is root)
  -3.91,   // A# (Bb)
  +9.78,   // B
];

// Just Intonation (major scale ratios):
// 1/1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8
// Converted to cents and subtracted from equal temperament
const JUST_BASE = [
  0,       // C  1/1
  +11.73,  // C# 16/15 (111.73 - 100)
  +3.91,   // D  9/8   (203.91 - 200)
  +15.64,  // D# 6/5   (315.64 - 300)
  -13.69,  // E  5/4   (386.31 - 400)
  -1.96,   // F  4/3   (498.04 - 500)
  -9.78,   // F# 45/32 (590.22 - 600)
  +1.96,   // G  3/2   (701.96 - 700)
  +13.69,  // G# 8/5   (813.69 - 800)
  -15.64,  // A  5/3   (884.36 - 900)
  +17.60,  // A# 9/5   (1017.60 - 1000)
  -11.73,  // B  15/8  (1088.27 - 1100)
];

// Quarter-comma meantone: fifths tempered to 5^(1/4) ratio (~696.58 cents)
const MEANTONE_BASE = [
  0,       // C
  +17.11,  // C#
  -6.84,   // D
  +10.26,  // D#
  -13.69,  // E
  +3.42,   // F
  +20.53,  // F#
  -3.42,   // G
  +13.69,  // G#
  -10.26,  // A
  +6.84,   // A#
  -17.11,  // B
];

// Werckmeister III: well-temperament (fixed offsets, not rotated by key)
const WERCKMEISTER3_OFFSETS = [
  0,       // C
  -9.78,   // C#
  -7.82,   // D
  -5.87,   // D#
  -9.78,   // E
  -1.96,   // F
  -11.73,  // F#
  -3.91,   // G
  -7.82,   // G#
  -5.87,   // A
  -3.91,   // A#
  -7.82,   // B
];

function rotateOffsets(baseOffsets, keyIndex) {
  // Rotate so that the key center note gets offset 0
  // and all other offsets are relative to that key
  const rotated = new Array(12);
  const keyOffset = baseOffsets[keyIndex];
  for (let i = 0; i < 12; i++) {
    rotated[i] = baseOffsets[(i + keyIndex) % 12] - keyOffset;
  }
  return rotated;
}

export const TEMPERAMENTS = {
  equal: {
    name: 'Equal',
    getOffsets: () => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  pythagorean: {
    name: 'Pythagorean',
    getOffsets: (keyIndex) => rotateOffsets(PYTHAGOREAN_BASE, keyIndex),
  },
  just: {
    name: 'Just Intonation',
    getOffsets: (keyIndex) => rotateOffsets(JUST_BASE, keyIndex),
  },
  meantone: {
    name: 'Meantone (1/4 comma)',
    getOffsets: (keyIndex) => rotateOffsets(MEANTONE_BASE, keyIndex),
  },
  werckmeister3: {
    name: 'Werckmeister III',
    // Well-temperament: fixed offsets from C, not rotated
    getOffsets: () => WERCKMEISTER3_OFFSETS,
  },
};

const NOTE_TO_INDEX = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

export function getTemperamentOffset(noteIndex) {
  const { temperament, temperamentKey } = getSettings();
  const temp = TEMPERAMENTS[temperament];
  if (!temp) return 0;
  const keyIndex = NOTE_TO_INDEX[temperamentKey] ?? 0;
  const offsets = temp.getOffsets(keyIndex);
  return offsets[noteIndex] || 0;
}

export function adjustFrequencyByCents(frequency, cents) {
  return frequency * Math.pow(2, cents / 1200);
}
