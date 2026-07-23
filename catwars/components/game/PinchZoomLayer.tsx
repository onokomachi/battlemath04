import React, { useRef, useState, useCallback } from 'react';

interface Props {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  /** 初期スケール（マップが画面に収まるよう調整したい時に使用） */
  initialScale?: number;
  className?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * 2本指スワイプでパン、ピンチでズームできるラッパー。
 * - 指1本のタップ/クリックはそのまま子要素へ伝わる（兵士配置などを邪魔しない）
 * - 2本指のときだけパン＆ズームを行う
 * - マウスホイールでもズーム可能（PC向け）
 */
export const PinchZoomLayer: React.FC<Props> = ({
  children,
  minScale = 0.5,
  maxScale = 3,
  initialScale = 1,
  className,
}) => {
  const [t, setT] = useState({ scale: initialScale, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastDist = useRef<number | null>(null);
  const lastMid = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size >= 2) {
        e.preventDefault();
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

        if (lastDist.current != null && lastMid.current) {
          const dScale = dist / lastDist.current;
          const dx = mid.x - lastMid.current.x;
          const dy = mid.y - lastMid.current.y;
          setT((prev) => ({
            scale: clamp(prev.scale * dScale, minScale, maxScale),
            x: prev.x + dx,
            y: prev.y + dy,
          }));
        }
        lastDist.current = dist;
        lastMid.current = mid;
      }
    },
    [minScale, maxScale]
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      lastDist.current = null;
      lastMid.current = null;
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        // 通常ホイールでもズーム（マップ操作向け）
      }
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setT((prev) => ({ ...prev, scale: clamp(prev.scale * factor, minScale, maxScale) }));
    },
    [minScale, maxScale]
  );

  const reset = () => setT({ scale: initialScale, x: 0, y: 0 });
  const zoomBy = (f: number) =>
    setT((prev) => ({ ...prev, scale: clamp(prev.scale * f, minScale, maxScale) }));

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onWheel={onWheel}
      style={{ touchAction: 'none' }}
    >
      <div
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          transformOrigin: 'center center',
          transition: 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 z-[80] flex flex-col gap-1.5 pointer-events-auto">
        <button
          onClick={() => zoomBy(1.25)}
          className="w-9 h-9 rounded-lg bg-black/70 border border-white/20 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-transform"
          aria-label="ズームイン"
        >
          ＋
        </button>
        <button
          onClick={() => zoomBy(0.8)}
          className="w-9 h-9 rounded-lg bg-black/70 border border-white/20 text-white text-lg font-bold flex items-center justify-center active:scale-90 transition-transform"
          aria-label="ズームアウト"
        >
          －
        </button>
        <button
          onClick={reset}
          className="w-9 h-9 rounded-lg bg-black/70 border border-white/20 text-white text-xs font-bold flex items-center justify-center active:scale-90 transition-transform"
          aria-label="リセット"
        >
          ⟳
        </button>
      </div>

      {/* Hint */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[80] pointer-events-none">
        <span className="text-[10px] text-white/40 bg-black/40 px-2 py-0.5 rounded-full whitespace-nowrap">
          ✌️ 2本指でうごかす・ひろげる
        </span>
      </div>
    </div>
  );
};
