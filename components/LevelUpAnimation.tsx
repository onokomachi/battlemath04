import React, { useState, useEffect } from 'react';
// FIX: Changed CardData to ProblemCard as CardData is deprecated.
import type { ProblemCard } from '../types';
import Card from './Card';

interface LevelUpAnimationProps {
  fromCard: ProblemCard;
  toCard: ProblemCard;
  onAnimationComplete: () => void;
}

const LevelUpAnimation: React.FC<LevelUpAnimationProps> = ({ fromCard, toCard, onAnimationComplete }) => {
  const [animationStep, setAnimationStep] = useState('start'); // start -> glowing -> flash -> reveal -> end

  useEffect(() => {
    const sequence = async () => {
      // 1. Initial delay
      await new Promise(resolve => setTimeout(resolve, 100));
      setAnimationStep('glowing');

      // 2. Glow duration
      await new Promise(resolve => setTimeout(resolve, 2000));
      setAnimationStep('flash');

      // 3. Flash and reveal
      await new Promise(resolve => setTimeout(resolve, 500));
      setAnimationStep('reveal');

      // 4. Reveal duration
      await new Promise(resolve => setTimeout(resolve, 2500));
      setAnimationStep('end');

      // 5. Cleanup and callback
      await new Promise(resolve => setTimeout(resolve, 500));
      onAnimationComplete();
    };
    sequence();
  }, [onAnimationComplete]);

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md">
      {/* Flash Effect */}
      {animationStep === 'flash' && (
        <div className="absolute inset-0 bg-white animate-level-up-flash"></div>
      )}

      {/* Glowing Card (Before) */}
      {animationStep === 'glowing' && (
        <div className="animate-level-up-glow">
          <Card card={fromCard} />
        </div>
      )}

      {/* Revealed Card (After) */}
      {animationStep === 'reveal' && (
        <div className="animate-level-up-reveal">
          <Card card={toCard} />
        </div>
      )}
    </div>
  );
};

export default LevelUpAnimation;