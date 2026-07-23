import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { StudentProfile } from '../types';
import { getCurrentSchoolYear, SCHOOL_NAME, TARGET_GRADE } from '../constants';

interface LoginScreenProps {
  currentUser: User | null;
  onLogin: () => void;
  onGuestPlay: () => void;
  onLogout: () => void;
  onOpenGameMaster?: () => void;
  mathPoints: number;
  playerLevel: number;
  studentProfile: StudentProfile | null;
  onStudentProfileSet: (profile: StudentProfile) => void;
}

// 自校のみの簡易ログイン: 学校選択は行わず、組と出席番号だけを選ぶ。
// 学校名は環境変数 VITE_SCHOOL_NAME(constants.SCHOOL_NAME)、学年は4で固定。
const CLASSES = Array.from({ length: 10 }, (_, i) => i + 1);
const NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);

const LoginScreen: React.FC<LoginScreenProps> = ({
  currentUser,
  onLogin,
  onGuestPlay,
  onLogout,
  onOpenGameMaster,
  mathPoints,
  playerLevel,
  studentProfile,
  onStudentProfileSet,
}) => {
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [selectedClass, setSelectedClass] = useState<number>(studentProfile?.classNum || 1);
  const [selectedNumber, setSelectedNumber] = useState<number>(studentProfile?.number || 1);

  useEffect(() => {
    if (currentUser && !studentProfile) {
      setShowProfileSetup(true);
    }
  }, [currentUser, studentProfile]);

  const handleProfileSubmit = () => {
    const profile: StudentProfile = {
      school: SCHOOL_NAME,
      grade: TARGET_GRADE,
      classNum: selectedClass,
      number: selectedNumber,
      displayLabel: `${TARGET_GRADE}年${selectedClass}組${selectedNumber}番`,
      schoolYear: getCurrentSchoolYear(),
    };
    onStudentProfileSet(profile);
    setShowProfileSetup(false);
  };

  // 組・出席番号の選択UI(小4児童向けの簡易プロファイル)
  if (currentUser && (showProfileSetup || !studentProfile)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-start sm:justify-center p-4 pt-8 sm:pt-4 text-white relative overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-transparent to-transparent pointer-events-none" />

        <div className="text-center mb-6 relative">
          <h1 className="text-3xl md:text-5xl font-black text-hologram mb-2 tracking-[0.1em]">
            じぶんの ばんごう
          </h1>
          <p className="text-xs text-red-400 tracking-[0.2em]">
            {SCHOOL_NAME} {TARGET_GRADE}年 — 組と 出席番号を えらんでね
          </p>
        </div>

        <div className="w-full max-w-lg hud-panel rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
          {/* 組 */}
          <div>
            <label className="block text-xs text-red-400 tracking-widest font-bold mb-3">
              なんくみ?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CLASSES.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`py-3 rounded-lg text-lg font-bold transition-all ${
                    selectedClass === c
                      ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(0,200,255,0.3)] scale-105'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-red-600 hover:text-white'
                  }`}
                >
                  {c}組
                </button>
              ))}
            </div>
          </div>

          {/* 出席番号 */}
          <div>
            <label className="block text-xs text-red-400 tracking-widest font-bold mb-3">
              しゅっせきばんごうは?
            </label>
            <div className="grid grid-cols-9 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {NUMBERS.map(n => (
                <button
                  key={n}
                  onClick={() => setSelectedNumber(n)}
                  className={`py-2 rounded text-sm font-bold transition-all ${
                    selectedNumber === n
                      ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(0,200,255,0.3)]'
                      : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-red-600 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* プレビュー＆確定 */}
          <div className="pt-4 border-t border-gray-700">
            <div className="text-center mb-4">
              <p className="text-xs text-gray-500 mb-1">えらんでいるのは</p>
              <p className="text-xl font-bold text-red-300 tracking-widest">
                {TARGET_GRADE}年{selectedClass}組{selectedNumber}番
              </p>
            </div>
            <button
              onClick={handleProfileSubmit}
              className="w-full btn-tactical py-4 rounded-xl text-xl tracking-[0.3em] font-bold"
            >
              けってい
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-start sm:justify-center p-4 pt-8 sm:pt-4 text-white relative overflow-y-auto">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Title */}
      <div className="text-center mb-8 sm:mb-16 relative">
        <div className="absolute -inset-20 bg-red-600/15 blur-[120px] rounded-full animate-pulse" />
        <h1 className="text-5xl md:text-8xl font-black text-hologram mb-2 tracking-[0.02em] pr-[0.1em]">
          BattleMath:04
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
          style={{
            background: 'linear-gradient(90deg, rgba(37,99,235,0.18), rgba(239,68,68,0.18))',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 0 24px rgba(37,99,235,0.35), 0 0 24px rgba(239,68,68,0.25)',
          }}>
          <span className="text-lg">🐱</span>
          <span className="font-black tracking-[0.35em] text-base sm:text-xl"
            style={{
              fontFamily: 'Orbitron, monospace',
              background: 'linear-gradient(90deg,#60a5fa,#e2e8f0,#f87171)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
            code:CAT-WARS
          </span>
        </div>
        <div className="flex items-center justify-center gap-6 mb-2">
          <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
          <p className="text-xs md:text-sm text-blue-200 font-bold tracking-[0.3em] opacity-80">
            算数をきわめ ネコ軍団で せかいを制せ
          </p>
          <div className="h-[1px] w-20 bg-gradient-to-l from-transparent via-blue-400 to-transparent" />
        </div>
      </div>

      {/* Auth Panel */}
      <div className="w-full max-w-md hud-panel rounded-2xl p-8 shadow-2xl">
        {currentUser ? (
          /* Logged in */
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              {currentUser.photoURL && (
                <img
                  src={currentUser.photoURL}
                  alt="avatar"
                  className="w-16 h-16 rounded-full border-2 border-red-500 shadow-[0_0_12px_#ef4444]"
                />
              )}
              <div>
                <p className="text-xs text-red-400 tracking-wide font-bold">
                  ログイン中
                </p>
                <p className="text-xl font-bold text-white">{currentUser.displayName}</p>
                <p className="text-xs text-gray-400">{currentUser.email}</p>
                {studentProfile && (
                  <p className="text-xs text-amber-400 mt-1">
                    {studentProfile.displayLabel}
                    <button
                      onClick={() => {
                        if (studentProfile) {
                          setSelectedClass(studentProfile.classNum);
                          setSelectedNumber(studentProfile.number);
                        }
                        setShowProfileSetup(true);
                      }}
                      className="ml-2 text-gray-500 hover:text-red-400 transition-colors"
                      title="変更"
                    >
                      [変更]
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-6 text-center">
              <div className="hud-panel rounded-lg px-4 py-2">
                <p className="text-xs text-red-400 font-bold">レベル</p>
                <p className="text-2xl font-bold text-white">{playerLevel}</p>
              </div>
              <div className="hud-panel rounded-lg px-4 py-2">
                <p className="text-xs text-red-400 font-bold">ポイント</p>
                <p className="text-2xl font-bold text-amber-400">{mathPoints.toLocaleString()}</p>
              </div>
            </div>

            <button
              onClick={onGuestPlay}
              className="w-full btn-tactical py-4 rounded-xl text-xl tracking-[0.3em] font-bold"
            >
              ゲームスタート
            </button>

            <div className="flex gap-4 w-full">
              {onOpenGameMaster && (
                <button
                  onClick={onOpenGameMaster}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-red-400 border border-red-800 hover:bg-red-900/30 transition-colors tracking-widest"
                >
                  管理者
                </button>
              )}
              <button
                onClick={onLogout}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        ) : (
          /* Not logged in */
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-300 mb-1">ログインすると きろくが のこるよ</p>
              <p className="text-xs text-gray-500">学校の Googleアカウントで ログインしよう</p>
            </div>

            <button
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-bold py-3 px-6 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              {/* Google Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Googleでログイン
            </button>

            <div className="relative w-full flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-gray-700" />
              <span className="text-xs text-gray-500">または</span>
              <div className="flex-1 h-[1px] bg-gray-700" />
            </div>

            <button
              onClick={onGuestPlay}
              className="w-full btn-tactical py-3 rounded-xl text-sm font-bold tracking-[0.3em] opacity-80 hover:opacity-100"
            >
              おためしプレイ（きろくは のこりません）
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 flex flex-col items-center gap-2">
        <div className="w-1 h-1 bg-red-400 rounded-full animate-ping" />
      </div>
    </div>
  );
};

export default LoginScreen;
