/**
 * NewYearPrompt.tsx — 新年度プロフィール更新プロンプト
 *
 * 年度が変わった際に組・番号の更新を促す。
 * 本アプリは4年生「分数」専用のため学年は常に TARGET_GRADE(4) に固定し、
 * 進級・卒業の分岐は行わない(新しい年度の4年生が使う想定)。
 * - スキップ: 3日後に再表示
 */
import React, { useState } from 'react';
import type { StudentProfile } from '../types';
import { TARGET_GRADE } from '../constants';

interface NewYearPromptProps {
  profile: StudentProfile;
  currentSchoolYear: number;
  onConfirm: (updated: StudentProfile) => void;
  onSkip: () => void;
}

const NewYearPrompt: React.FC<NewYearPromptProps> = ({
  profile,
  currentSchoolYear,
  onConfirm,
  onSkip,
}) => {
  const [classNum, setClassNum] = useState(profile.classNum);
  const [number, setNumber] = useState(profile.number);

  const handleConfirm = () => {
    onConfirm({
      ...profile,
      grade: TARGET_GRADE,
      classNum,
      number,
      schoolYear: currentSchoolYear,
      displayLabel: `${TARGET_GRADE}年${classNum}組${number}番`,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-red-500/40 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.15)] max-w-md w-full p-6 text-white animate-math-fade-in">
        <h2 className="text-2xl font-bold text-red-300 text-center mb-4">
          新年度が始まりました！
        </h2>

        <div className="space-y-4">
            <p className="text-gray-300 text-center">
              今年の <span className="text-red-400 font-bold">組と出席番号</span> をえらんでね
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">組</label>
                <select
                  value={classNum}
                  onChange={e => setClassNum(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-red-400 focus:outline-none"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}組</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">出席番号</label>
                <select
                  value={number}
                  onChange={e => setNumber(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-red-400 focus:outline-none"
                >
                  {Array.from({ length: 45 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}番</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-500 hover:to-blue-500 text-white font-bold text-lg transition-all"
            >
              更新する
            </button>
          </div>

        <button
          onClick={onSkip}
          className="w-full mt-3 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          後で
        </button>
      </div>
    </div>
  );
};

export default NewYearPrompt;
