import React, { useEffect, useRef } from 'react';
import type { BackgroundId } from '../utils/backgroundUnlock';

/**
 * バッジ獲得率で解放される「特別な背景」のキャンバス描画。
 * wari-hissann3 の AuroraRain / SakuraRain / InfernoRain / TenkuuRain / MatrixRain を
 * 1つの軽量パーティクルシステムに統合して移植した(マトリックスのみ専用の文字落下ループ)。
 * requestAnimationFrame は1本のみ・パーティクル数は控えめにして
 * GIGA端末でも負荷を抑える。
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  alpha: number;
  spin: number;
  angle: number;
  /** cosmos: 星か星雲かの見た目の種類 */
  kind?: 'star' | 'cloud';
}

const COUNTS: Record<Exclude<BackgroundId, 'default' | 'matrix'>, number> = {
  aurora: 40,
  sakura: 45,
  inferno: 55,
  tenkuu: 70,
  cosmos: 90,
};

const MATRIX_GLYPHS = 'アカサタナハマヤラワ0123456789ｱｲｳｴｵｶｷｸ.+-=×÷'.split('');

const BackgroundFX: React.FC<{ background: BackgroundId }> = ({ background }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (background === 'default') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;

    // ============ マトリックス: デジタルレイン(専用の描画ループ) ============
    if (background === 'matrix') {
      const fontSize = 18;
      let columns = 0;
      let drops: number[] = [];

      const resizeMatrix = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        columns = Math.floor(canvas.width / fontSize);
        drops = Array.from({ length: columns }, () => Math.floor((Math.random() * canvas.height) / fontSize));
      };
      resizeMatrix();
      window.addEventListener('resize', resizeMatrix);

      let last = 0;
      const interval = 45;

      const drawMatrix = (t: number) => {
        if (!running) return;
        raf = requestAnimationFrame(drawMatrix);
        if (t - last < interval) return;
        last = t;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
        for (let i = 0; i < drops.length; i++) {
          const ch = MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)];
          const x = i * fontSize;
          const y = drops[i] * fontSize;
          ctx.fillStyle = Math.random() > 0.975 ? 'rgba(120, 255, 140, 0.85)' : 'rgba(0, 220, 60, 0.5)';
          ctx.fillText(ch, x, y);
          if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      };
      raf = requestAnimationFrame(drawMatrix);

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resizeMatrix);
      };
    }

    // ============ それ以外: 軽量パーティクルシステム ============
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    const spawn = (initial: boolean): Particle => {
      switch (background) {
        case 'sakura':
          return {
            x: Math.random() * W(),
            y: initial ? Math.random() * H() : -20 * dpr,
            vx: (Math.random() - 0.3) * 0.6 * dpr,
            vy: (0.4 + Math.random() * 0.8) * dpr,
            size: (4 + Math.random() * 5) * dpr,
            hue: 330 + Math.random() * 20,
            alpha: 0.5 + Math.random() * 0.4,
            spin: (Math.random() - 0.5) * 0.06,
            angle: Math.random() * Math.PI * 2,
          };
        case 'inferno':
          return {
            x: Math.random() * W(),
            y: initial ? Math.random() * H() : H() + 20 * dpr,
            vx: (Math.random() - 0.5) * 0.5 * dpr,
            vy: -(0.6 + Math.random() * 1.4) * dpr,
            size: (2 + Math.random() * 4) * dpr,
            hue: 10 + Math.random() * 35,
            alpha: 0.4 + Math.random() * 0.5,
            spin: 0,
            angle: 0,
          };
        case 'tenkuu':
          return {
            x: Math.random() * W(),
            y: Math.random() * H(),
            vx: (Math.random() - 0.5) * 0.15 * dpr,
            vy: (Math.random() - 0.5) * 0.15 * dpr,
            size: (1 + Math.random() * 2.5) * dpr,
            hue: 45 + Math.random() * 15,
            alpha: 0.3 + Math.random() * 0.7,
            spin: 0.02 + Math.random() * 0.03,
            angle: Math.random() * Math.PI * 2,
          };
        case 'cosmos': {
          // 宇宙神: 星雲(ゆっくり漂う大きな光の雲)と またたく星 を混ぜた、より壮大な宇宙演出
          const isCloud = Math.random() < 0.3;
          if (isCloud) {
            return {
              x: Math.random() * W(),
              y: Math.random() * H(),
              vx: (Math.random() - 0.5) * 0.1 * dpr,
              vy: (Math.random() - 0.5) * 0.1 * dpr,
              size: (80 + Math.random() * 140) * dpr,
              hue: Math.random() < 0.5 ? 260 + Math.random() * 60 : 190 + Math.random() * 40,
              alpha: 0.05 + Math.random() * 0.07,
              spin: 0,
              angle: 0,
              kind: 'cloud',
            };
          }
          return {
            x: Math.random() * W(),
            y: Math.random() * H(),
            vx: (Math.random() - 0.5) * 0.12 * dpr,
            vy: (Math.random() - 0.5) * 0.12 * dpr,
            size: (1 + Math.random() * 2.2) * dpr,
            hue: 190 + Math.random() * 140,
            alpha: 0.4 + Math.random() * 0.6,
            spin: 0.03 + Math.random() * 0.05,
            angle: Math.random() * Math.PI * 2,
            kind: 'star',
          };
        }
        case 'aurora':
        default:
          return {
            x: Math.random() * W(),
            y: initial ? Math.random() * H() : -10 * dpr,
            vx: Math.sin(Math.random() * Math.PI * 2) * 0.3 * dpr,
            vy: (0.3 + Math.random() * 0.6) * dpr,
            size: (60 + Math.random() * 120) * dpr,
            hue: 120 + Math.random() * 160,
            alpha: 0.05 + Math.random() * 0.08,
            spin: 0,
            angle: 0,
          };
      }
    };

    const particles: Particle[] = Array.from({ length: COUNTS[background] }, () => spawn(true));

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, W(), H());
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;

        const out =
          p.y > H() + 40 * dpr || p.y < -40 * dpr - (background === 'aurora' ? p.size : 0) ||
          p.x < -60 * dpr || p.x > W() + 60 * dpr;
        if (out) {
          particles[i] = spawn(false);
          continue;
        }

        ctx.save();
        if (background === 'aurora') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, `hsla(${p.hue}, 90%, 60%, ${p.alpha})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else if (background === 'sakura') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 82%, ${p.alpha})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (background === 'inferno') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 60%, ${p.alpha})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (background === 'cosmos') {
          if (p.kind === 'cloud') {
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            g.addColorStop(0, `hsla(${p.hue}, 85%, 65%, ${p.alpha})`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          } else {
            const tw = 0.5 + 0.5 * Math.sin(p.angle * 6);
            ctx.fillStyle = `hsla(${p.hue}, 95%, 80%, ${p.alpha * tw})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // tenkuu: またたく星
          const tw = 0.5 + 0.5 * Math.sin(p.angle * 6);
          ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${p.alpha * tw})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [background]);

  if (background === 'default') return null;

  const tint: Record<Exclude<BackgroundId, 'default'>, string> = {
    matrix: 'bg-black/10',
    aurora: 'bg-gradient-to-b from-emerald-950/40 via-transparent to-indigo-950/40',
    sakura: 'bg-gradient-to-b from-rose-950/30 via-transparent to-slate-950/30',
    inferno: 'bg-gradient-to-b from-red-950/50 via-transparent to-orange-950/40',
    tenkuu: 'bg-gradient-to-b from-sky-950/50 via-transparent to-amber-950/20',
    cosmos: 'bg-gradient-to-b from-indigo-950/50 via-transparent to-fuchsia-950/30',
  };

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 ${tint[background]}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default BackgroundFX;
