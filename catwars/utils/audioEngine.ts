// CAT-WARS サウンドエンジン。
// 合成音(WebAudio Oscillator)に加えて、Kenney.nl の CC0 効果音(MP3化ずみ)を再生する。
// MP3を使うのは Safari/iPadOS で Ogg Vorbis の再生が不安定なため(学校のiPad利用を想定)。
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

const SFX_BASE = '/assets/sfx';

/** CC0効果音(Kenney.nl)を再生。連打しても被って鳴らせるよう毎回新しい要素で再生する。 */
function playSample(name: string, volume = 0.5) {
  try {
    const audio = new Audio(`${SFX_BASE}/${name}.mp3`);
    audio.volume = volume;
    audio.play().catch(() => { /* ユーザー操作前の自動再生ブロックは無視 */ });
  } catch (_) { /* audio not available */ }
}

/** 高頻度に鳴りうる効果音(攻撃ヒット等)の連打防止スロットル */
const lastPlayed: Record<string, number> = {};
function playThrottled(name: string, volume: number, minIntervalMs: number) {
  const now = Date.now();
  if (now - (lastPlayed[name] ?? 0) < minIntervalMs) return;
  lastPlayed[name] = now;
  playSample(name, volume);
}

export const sfx = {
  correct() {
    playSample('correct', 0.35);
    tone(523, 0.1, 'sine', 0.3);
    setTimeout(() => tone(659, 0.1, 'sine', 0.3), 80);
    setTimeout(() => tone(784, 0.2, 'sine', 0.3), 160);
  },
  incorrect() {
    playSample('incorrect', 0.35);
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
    playSample('tap', 0.4);
  },
  /** メニュー/タブ切り替えなどのナビゲーション操作音 */
  select() {
    playSample('select', 0.4);
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
  /** ネコの出撃（フォースフィールド越しに戦場へワープするイメージ） */
  deploy() {
    playSample('deploy', 0.45);
  },
  /** 攻撃ヒット（頻発するため連打防止スロットルつき） */
  hit() {
    playThrottled('hit', 0.22, 90);
  },
  /** 防衛施設(大砲・テスラ)の自動迎撃射撃音 */
  laserShot() {
    playThrottled('laser', 0.3, 200);
  },
  /** 建物・壁の破壊 */
  explosion() {
    playSample('explosion', 0.5);
  },
};
