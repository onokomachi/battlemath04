let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.3) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(gainVal, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch (_) { /* audio not available */ }
}

function chord(freqs: number[], duration: number, gainVal = 0.2) {
  freqs.forEach((f) => tone(f, duration, 'sine', gainVal));
}

export const sfx = {
  correct() {
    tone(523, 0.1, 'sine', 0.3);
    setTimeout(() => tone(659, 0.1, 'sine', 0.3), 80);
    setTimeout(() => tone(784, 0.2, 'sine', 0.3), 160);
  },
  incorrect() {
    tone(220, 0.15, 'sawtooth', 0.2);
    setTimeout(() => tone(196, 0.2, 'sawtooth', 0.15), 100);
  },
  combo() {
    chord([523, 659, 784], 0.1, 0.2);
    setTimeout(() => chord([659, 784, 988], 0.15, 0.25), 120);
    setTimeout(() => chord([784, 988, 1047], 0.3, 0.3), 260);
  },
  badge() {
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => {
      setTimeout(() => tone(f, 0.12, 'sine', 0.25), i * 60);
    });
  },
  tap() {
    tone(800, 0.05, 'square', 0.08);
  },
  battleWin() {
    const notes = [523, 659, 784, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sine', 0.3), i * 100));
  },
  battleLose() {
    tone(330, 0.3, 'sawtooth', 0.2);
    setTimeout(() => tone(294, 0.3, 'sawtooth', 0.15), 250);
    setTimeout(() => tone(262, 0.5, 'sawtooth', 0.15), 500);
  },
  deploy() {
    tone(440, 0.08, 'square', 0.15);
    setTimeout(() => tone(550, 0.08, 'square', 0.1), 60);
  },
};
