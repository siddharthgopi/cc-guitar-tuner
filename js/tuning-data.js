import { getA4Freq } from './settings.js';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const A4_MIDI = 69;

export function midiToFrequency(midi) {
  return getA4Freq() * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function noteNameToMidi(note, octave) {
  const noteIndex = NOTE_NAMES.indexOf(note);
  return (octave + 1) * 12 + noteIndex;
}

const FLAT_TO_SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

export function parseNoteString(noteStr) {
  const match = noteStr.match(/^([A-G][b#]?)(\d)$/);
  if (!match) throw new Error(`Invalid note: ${noteStr}`);
  const [, note, octStr] = match;
  const octave = parseInt(octStr);
  const normalized = FLAT_TO_SHARP[note] || note;
  const midi = noteNameToMidi(normalized, octave);
  return {
    note,
    displayName: noteStr,
    octave,
    midi,
    frequency: midiToFrequency(midi)
  };
}

export const INSTRUMENTS = {
  guitar: {
    name: 'Guitar',
    stringCount: 6,
    tunings: {
      standard:     { name: 'Standard',       notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      dropD:        { name: 'Drop D',         notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      halfStepDown: { name: 'Half Step Down', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
      fullStepDown: { name: 'Full Step Down', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
      dadgad:       { name: 'DADGAD',         notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
      openD:        { name: 'Open D',         notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
      openG:        { name: 'Open G',         notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
      openE:        { name: 'Open E',         notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] },
    }
  },
  bass: {
    name: 'Bass',
    stringCount: 5,
    tunings: {
      standard:     { name: 'Standard (5-str)', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
      standard4:    { name: 'Standard (4-str)', notes: ['E1', 'A1', 'D2', 'G2'] },
      dropD:        { name: 'Drop D',           notes: ['B0', 'D1', 'A1', 'D2', 'G2'] },
      halfStepDown: { name: 'Half Step Down',   notes: ['Bb0', 'Eb1', 'Ab1', 'Db2', 'Gb2'] },
    }
  }
};
