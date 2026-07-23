import React, { useState } from 'react';

interface AdminPasswordModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * 管理画面(ゲームマスター)に入る前の簡易パスワードゲート。
 * 実効的な保護は ADMIN_EMAILS(Googleログイン) + firestore.rules の isAdmin() が担っており、
 * これは「同じ端末を他の人が触ってしまう」ようなうっかり事故を防ぐための追加の一手間。
 */
const ADMIN_PANEL_PASSWORD = '444325';

const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({ onSuccess, onCancel }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (input === ADMIN_PANEL_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
      setInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
      <div className="hud-panel rounded-2xl p-8 max-w-sm w-full shadow-2xl border-red-400/40 animate-math-fade-in relative">
        <div className="corner-accent lt border-red-400"></div>
        <div className="corner-accent rb border-red-400"></div>
        <h3 className="text-red-400 text-xl font-bold mb-4 text-center">🔒 管理画面パスワード</h3>
        <input
          type="password"
          inputMode="numeric"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          autoFocus
          className="w-full bg-slate-950/60 border-2 border-red-500/30 rounded-xl p-3 text-center text-2xl font-mono text-white tracking-[0.3em] outline-none focus:border-red-400"
          placeholder="••••••"
        />
        {error && <p className="text-red-400 text-xs font-bold text-center mt-2">パスワードが違います</p>}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 btn-tactical py-3 rounded-lg font-bold text-white/60 border-white/10"
          >
            もどる
          </button>
          <button
            onClick={handleSubmit}
            disabled={!input}
            className="flex-1 btn-tactical py-3 rounded-lg font-bold text-red-400 border-red-400/40 disabled:opacity-30"
          >
            決定
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPasswordModal;
