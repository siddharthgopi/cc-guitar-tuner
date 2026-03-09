import { detectPitch } from './pitch-detection.js';

let audioContext = null;
let analyser = null;
let mediaStream = null;
let source = null;
let isListening = false;
let animationFrameId = null;
let pitchCallback = null;

const FFT_SIZE = 4096;

export function setOnPitchDetected(callback) {
  pitchCallback = callback;
}

export async function startListening() {
  if (isListening) return;

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
  });

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  source = audioContext.createMediaStreamSource(mediaStream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;

  source.connect(analyser);

  isListening = true;
  startDetectionLoop();
}

export function stopListening() {
  isListening = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (source) {
    source.disconnect();
    source = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

function startDetectionLoop() {
  const buffer = new Float32Array(analyser.fftSize);

  function loop() {
    if (!isListening) return;
    analyser.getFloatTimeDomainData(buffer);
    const result = detectPitch(buffer, audioContext.sampleRate);
    if (pitchCallback) pitchCallback(result);
    animationFrameId = requestAnimationFrame(loop);
  }
  loop();
}

export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}
