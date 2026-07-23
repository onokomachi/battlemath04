
import React, { useEffect, useRef } from 'react';

/**
 * GravityBackground — 省電力版
 *
 * 改善: visibilitychange + reduced-motion対応
 * - タブ非表示時はアニメーション完全停止（バッテリー節約）
 * - prefers-reduced-motion設定時は静的グリッド描画のみ
 * - requestAnimationFrame IDを保持して確実にキャンセル
 */
const GravityBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // prefers-reduced-motion チェック
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const gridSize = 60;
    const points: { x: number; y: number; ox: number; oy: number }[] = [];

    // Pre-calculate rows and cols to match point generation exactly
    let cols = Math.ceil((width + gridSize * 2) / gridSize) + 1;
    let rows = Math.ceil((height + gridSize * 2) / gridSize) + 1;

    const initPoints = () => {
      points.length = 0;
      cols = Math.ceil((width + gridSize * 2) / gridSize) + 1;
      rows = Math.ceil((height + gridSize * 2) / gridSize) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * gridSize - gridSize;
          const y = r * gridSize - gridSize;
          points.push({ x, y, ox: x, oy: y });
        }
      }
    };

    initPoints();

    let time = 0;
    let mouse = { x: width / 2, y: height / 2, active: false };
    let animFrameId: number | null = null;
    let isPaused = false;

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initPoints();
    };

    // 省電力: タブ非表示時にアニメーション停止
    const handleVisibility = () => {
      if (document.hidden) {
        isPaused = true;
        if (animFrameId !== null) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
      } else {
        isPaused = false;
        if (animFrameId === null) {
          animFrameId = requestAnimationFrame(animate);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    // 静的グリッド描画（reduced-motion用 or 一時停止フレーム用）
    const drawStaticGrid = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const p = points[idx];
          if (!p) continue;
          if (c < cols - 1) {
            const nextP = points[idx + 1];
            if (nextP) { ctx.moveTo(p.ox, p.oy); ctx.lineTo(nextP.ox, nextP.oy); }
          }
          if (r < rows - 1) {
            const nextP = points[idx + cols];
            if (nextP) { ctx.moveTo(p.ox, p.oy); ctx.lineTo(nextP.ox, nextP.oy); }
          }
        }
      }
      ctx.stroke();
    };

    if (prefersReducedMotion) {
      drawStaticGrid();
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    const animate = () => {
      if (isPaused) return;

      time += 0.01;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // 対角線上で同期して動く2つの重力源（ウェル）
      const offsetX = Math.cos(time * 0.4) * (width * 0.25);
      const offsetY = Math.sin(time * 0.6) * (height * 0.25);

      const w1 = { x: width / 2 + offsetX, y: height / 2 + offsetY };
      const w2 = { x: width / 2 - offsetX, y: height / 2 - offsetY };

      points.forEach((p) => {
        // 重力源1の影響
        const dx1 = p.ox - w1.x;
        const dy1 = p.oy - w1.y;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const force1 = Math.max(0, (500 - dist1) / 500);
        const strength1 = 120 * force1;
        const angle1 = Math.atan2(dy1, dx1);

        // 重力源2の影響（同じ強さ）
        const dx2 = p.ox - w2.x;
        const dy2 = p.oy - w2.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const force2 = Math.max(0, (500 - dist2) / 500);
        const strength2 = 120 * force2;
        const angle2 = Math.atan2(dy2, dx2);

        // 干渉効果：各重力源からの変位ベクトルを合算
        p.x = p.ox + Math.cos(angle1) * strength1 + Math.cos(angle2) * strength2;
        p.y = p.oy + Math.sin(angle1) * strength1 + Math.sin(angle2) * strength2;

        // 微細な波のゆらぎ
        p.x += Math.cos(time + p.oy * 0.005) * 8;
        p.y += Math.sin(time + p.ox * 0.005) * 8;

        // マウスの影響
        if (mouse.active) {
          const mdx = p.ox - mouse.x;
          const mdy = p.oy - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 400) {
            const mforce = (400 - mdist) / 400;
            const mstrength = 60 * mforce;
            const mangle = Math.atan2(mdy, mdx);
            p.x += Math.cos(mangle) * mstrength;
            p.y += Math.sin(mangle) * mstrength;
          }
        }
      });

      // グリッドの描画
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 1.2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const p = points[idx];
          if (!p) continue;

          if (c < cols - 1) {
            const nextP = points[idx + 1];
            if (nextP) {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(nextP.x, nextP.y);
            }
          }
          if (r < rows - 1) {
            const nextP = points[idx + cols];
            if (nextP) {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(nextP.x, nextP.y);
            }
          }
        }
      }
      ctx.stroke();

      // 交差点の描画
      ctx.fillStyle = 'rgba(248, 113, 113, 0.65)';
      points.forEach((p, i) => {
        if (i % 2 === 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: '#000' }}
    />
  );
};

export default GravityBackground;
