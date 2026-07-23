/**
 * BadgeNotification.tsx - バッジ獲得トースト通知
 * エビデンスB: 自己決定理論 × 有能感フィードバック（Deci & Ryan 1985）
 * 4秒後に自動消去
 */
import React, { useEffect } from 'react';
import type { BadgeDef } from '../types';

interface BadgeNotificationProps {
  badge: BadgeDef;
  onDismiss: () => void;
}

const BadgeNotification: React.FC<BadgeNotificationProps> = ({ badge, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-math-fade-in pointer-events-none">
      <div className="bg-amber-950/95 border-2 border-amber-400/70 rounded-2xl px-6 py-4 shadow-[0_0_40px_rgba(251,191,36,0.3)] flex items-center gap-4 min-w-[18rem]">
        <div className="text-4xl">{badge.icon}</div>
        <div>
          <div className="text-[10px] text-amber-400 font-black tracking-widest uppercase mb-0.5">
            BADGE UNLOCKED
          </div>
          <div className="text-white font-bold text-lg leading-tight">{badge.title}</div>
          <div className="text-amber-300/70 text-xs mt-0.5">{badge.description}</div>
        </div>
        <div className="ml-2 text-amber-600 text-sm font-mono">+100 MP</div>
      </div>
    </div>
  );
};

export default BadgeNotification;
