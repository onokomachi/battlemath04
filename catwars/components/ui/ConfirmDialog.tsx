import React from 'react';

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  accent?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 共通の確認モーダル。希少な通貨（🌟スーパースター）消費など、誤操作を防ぎたい操作に使う。 */
export const ConfirmDialog: React.FC<Props> = ({
  open, title, message, confirmLabel = 'はい', cancelLabel = 'やめる',
  accent = '#facc15', onConfirm, onCancel,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80"
      onClick={onCancel} style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
      <div
        className="w-full max-w-xs rounded-2xl p-5 text-center"
        style={{ background: 'linear-gradient(160deg,#0a0e1a,#161029)', border: `2px solid ${accent}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>{title}</h3>
        <div className="text-white/80 text-sm mb-5 leading-relaxed">{message}</div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{ background: `${accent}22`, border: `2px solid ${accent}`, color: accent }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
