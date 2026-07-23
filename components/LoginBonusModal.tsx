import React from 'react';

interface LoginBonusModalProps {
  loginStreak: number;
  todayReward: number;
  alreadyClaimed: boolean;
  onClaim: () => void;
  onClose: () => void;
}

const STAMP_DAYS = 7;

const DAY_REWARDS: { day: number; mp: number; label: string; icon: string }[] = [
  { day: 1, mp: 100, label: '100 MP', icon: '🪙' },
  { day: 2, mp: 100, label: '100 MP', icon: '🪙' },
  { day: 3, mp: 150, label: '150 MP', icon: '🪙' },
  { day: 4, mp: 150, label: '150 MP', icon: '🪙' },
  { day: 5, mp: 200, label: '200 MP', icon: '💎' },
  { day: 6, mp: 200, label: '200 MP', icon: '💎' },
  { day: 7, mp: 500, label: '500 MP', icon: '👑' },
];

export const getLoginReward = (streak: number): number => {
  const dayIndex = ((streak - 1) % STAMP_DAYS);
  return DAY_REWARDS[dayIndex]?.mp ?? 100;
};

const LoginBonusModal: React.FC<LoginBonusModalProps> = ({
  loginStreak, todayReward, alreadyClaimed, onClaim, onClose,
}) => {
  const currentDayInCycle = ((loginStreak - 1) % STAMP_DAYS) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-math-fade-in">
      <div className="w-full max-w-md mx-4 bg-slate-950/95 border border-red-500/40 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900/40 via-blue-900/30 to-red-900/40 p-5 text-center border-b border-red-500/20">
          <h2 className="text-2xl font-black text-white tracking-wider">ログインボーナス</h2>
          <p className="text-xs text-red-400 mt-1 font-bold">
            {loginStreak}日目 — 毎日ログインして報酬をゲット!
          </p>
        </div>

        {/* Stamp Rally Grid */}
        <div className="p-5">
          <div className="grid grid-cols-7 gap-2 mb-6">
            {DAY_REWARDS.map((day, i) => {
              const dayNum = i + 1;
              const isCompleted = dayNum < currentDayInCycle;
              const isToday = dayNum === currentDayInCycle;
              const isFuture = dayNum > currentDayInCycle;

              return (
                <div
                  key={dayNum}
                  className={`
                    flex flex-col items-center justify-center rounded-xl p-2 border-2 transition-all duration-300 relative
                    ${isToday
                      ? alreadyClaimed
                        ? 'border-green-400/60 bg-green-900/20 shadow-[0_0_15px_rgba(74,222,128,0.2)]'
                        : 'border-red-400 bg-red-900/30 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse'
                      : isCompleted
                        ? 'border-green-600/40 bg-green-900/10'
                        : 'border-slate-700/40 bg-slate-900/30'
                    }
                  `}
                >
                  <span className="text-[10px] text-gray-500 font-bold mb-0.5">{dayNum}日</span>
                  <span className="text-lg">{isCompleted || (isToday && alreadyClaimed) ? '✅' : day.icon}</span>
                  <span className={`text-[9px] font-bold mt-0.5 ${isFuture ? 'text-gray-600' : 'text-red-400'}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Today's Reward */}
          {!alreadyClaimed ? (
            <div className="text-center">
              <p className="text-sm text-red-300 mb-3 font-bold">
                今日の報酬: <span className="text-amber-400 text-lg">{todayReward} MP</span>
              </p>
              <button
                onClick={onClaim}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-500 hover:to-blue-500 text-white font-black text-lg rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95"
              >
                受け取る
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-green-400 mb-3 font-bold">
                本日の報酬を受け取りました! (+{todayReward} MP)
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-900/20 transition-all"
              >
                閉じる
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 pb-4 text-center">
          <p className="text-[10px] text-gray-600">
            7日間連続で{DAY_REWARDS.reduce((s, d) => s + d.mp, 0)} MPゲット! 周期は繰り返されます
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginBonusModal;
