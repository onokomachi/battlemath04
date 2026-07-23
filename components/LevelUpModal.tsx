import React from 'react';
import type { ProblemCard } from '../types';
import Card from './Card';

interface LevelUpModalProps {
  oldLevel: number;
  newLevel: number;
  mpReward: number;
  newCard: ProblemCard | null;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ oldLevel, newLevel, mpReward, newCard, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md animate-math-fade-in p-4">
      <div className="bg-gray-800 border-2 border-purple-400 rounded-lg p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-6 w-full max-w-lg text-white">
        <h2 className="text-4xl sm:text-5xl font-bold text-purple-300 animate-glow-purple font-['Playfair_Display']">LEVEL UP!</h2>
        <div className="text-5xl sm:text-6xl font-black flex items-center gap-4">
          <span className="text-gray-400">{oldLevel}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className="text-purple-300">{newLevel}</span>
        </div>
        
        <div className="w-full bg-gray-900/50 rounded-lg p-4 mt-2 border border-gray-700">
            <h3 className="text-xl font-bold text-center text-purple-400 mb-3 font-['Playfair_Display']">獲得報酬</h3>
            <div className="flex flex-col items-center gap-4">
                <p className="text-2xl font-bold text-white font-mono bg-black/30 px-4 py-2 rounded-md">
                    + {mpReward} MP
                </p>
                {newCard ? (
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-purple-300">新しいカードを獲得！</p>
                        <div className="transform scale-75">
                            <Card card={newCard} />
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-400">（全カード入手済みのため、追加MPボーナスが加算されました）</p>
                )}
            </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 bg-purple-600 text-white font-bold py-3 px-8 rounded-lg text-xl hover:bg-purple-500 transition-transform transform hover:scale-105"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default LevelUpModal;
