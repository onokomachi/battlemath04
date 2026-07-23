import React from 'react';

/**
 * BattleMath:04「code:CAT-WARS」の基調となる、青と赤が絶えず入れかわる動的グラデーション背景。
 * - 2枚のアニメーションするグラデーション層（色相と位置がゆっくり循環）＋走査線のグリッチで
 *   「サイバー／対戦」感を出す。
 * - CSS アニメーションのみで軽量（canvas 不使用）。既存の BackgroundFX(パーティクル)とも共存する。
 * - prefers-reduced-motion の環境では動きを止める。
 */
const CyberGradientBG: React.FC = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
    <style>{`
      @keyframes cw-shift {
        0%   { transform: translate3d(-8%, -6%, 0) scale(1.25) rotate(0deg); }
        50%  { transform: translate3d(8%, 6%, 0) scale(1.4) rotate(8deg); }
        100% { transform: translate3d(-8%, -6%, 0) scale(1.25) rotate(0deg); }
      }
      @keyframes cw-hue {
        0%   { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
      @keyframes cw-fade {
        0%, 100% { opacity: 0.85; }
        50%      { opacity: 0.5; }
      }
      @keyframes cw-scan {
        0%   { background-position: 0 0; }
        100% { background-position: 0 100vh; }
      }
      .cw-layer { position: absolute; inset: -25%; will-change: transform, opacity; }
      .cw-a {
        background:
          radial-gradient(closest-side at 28% 32%, rgba(37,99,235,0.85), transparent 70%),
          radial-gradient(closest-side at 74% 68%, rgba(239,68,68,0.85), transparent 70%);
        animation: cw-shift 18s ease-in-out infinite, cw-hue 24s linear infinite;
        mix-blend-mode: screen;
      }
      .cw-b {
        background:
          radial-gradient(closest-side at 70% 26%, rgba(56,189,248,0.7), transparent 68%),
          radial-gradient(closest-side at 30% 78%, rgba(220,38,38,0.75), transparent 68%);
        animation: cw-shift 26s ease-in-out infinite reverse, cw-fade 12s ease-in-out infinite;
        mix-blend-mode: screen;
      }
      .cw-scan {
        position: absolute; inset: 0;
        background: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px);
        animation: cw-scan 8s linear infinite;
        opacity: 0.35;
      }
      .cw-vignette {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at center, transparent 40%, rgba(2,4,12,0.7) 100%);
      }
      @media (prefers-reduced-motion: reduce) {
        .cw-a, .cw-b, .cw-scan { animation: none !important; }
      }
    `}</style>
    <div style={{ position: 'absolute', inset: 0, background: '#03040c' }} />
    <div className="cw-layer cw-a" />
    <div className="cw-layer cw-b" />
    <div className="cw-scan" />
    <div className="cw-vignette" />
  </div>
);

export default CyberGradientBG;
