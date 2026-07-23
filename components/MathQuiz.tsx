import React, { useState, useEffect } from 'react';
// FIX: Changed CardData to ProblemCard as CardData is deprecated.
import type { ProblemCard } from '../types';
import Card from './Card';

interface MathQuizProps {
  card: ProblemCard;
  onSolve: (success: boolean) => void;
}

const generateProblem = () => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const correctAnswer = a + b;
  const answers = new Set<number>([correctAnswer]);
  while (answers.size < 4) {
    const wrongAnswer = correctAnswer + (Math.floor(Math.random() * 8) - 4);
    if (wrongAnswer !== correctAnswer && wrongAnswer > 0) {
      answers.add(wrongAnswer);
    }
  }
  return {
    question: `${a} + ${b} = ?`,
    correctAnswer,
    choices: Array.from(answers).sort(() => Math.random() - 0.5),
  };
};

const MathQuiz: React.FC<MathQuizProps> = ({ card, onSolve }) => {
  const [problem] = useState(generateProblem());
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    if (isAnswered) return;

    if (timeLeft <= 0) {
      setIsAnswered(true);
      setTimeout(() => onSolve(false), 1500);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onSolve, isAnswered]);

  const handleAnswerClick = (choice: number) => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedAnswer(choice);
    const isCorrect = choice === problem.correctAnswer;
    setTimeout(() => onSolve(isCorrect), 1500);
  };
  
  const getButtonClass = (choice: number) => {
    if (!isAnswered) {
      return 'bg-gray-700 hover:bg-amber-500 hover:text-gray-900';
    }
    if (choice === problem.correctAnswer) {
      return 'bg-green-500 animate-glow-green';
    }
    if (choice === selectedAnswer && choice !== problem.correctAnswer) {
      return 'bg-red-500 animate-glow-red';
    }
    return 'bg-gray-800 opacity-50';
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-amber-400 rounded-lg p-8 shadow-2xl flex flex-col items-center gap-6 w-full max-w-2xl animate-level-up-reveal">
        <h2 className="text-3xl font-bold text-amber-300">BATTLE-MATH!</h2>
        <p className="text-lg text-white">問題に正解してカードを強化しよう！</p>
        
        <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
           <div 
             className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000 linear" 
             style={{ width: `${(timeLeft / 10) * 100}%`}}
           ></div>
        </div>
        
        <div className="flex items-center justify-center gap-8">
            <div className="transform scale-75">
                <Card card={card} />
            </div>
            <div className="text-5xl font-bold text-white p-4">
                {problem.question}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
            {problem.choices.map((choice) => (
                <button
                    key={choice}
                    onClick={() => handleAnswerClick(choice)}
                    disabled={isAnswered}
                    className={`p-4 rounded-lg text-white text-2xl font-bold transition-all duration-300 ${getButtonClass(choice)}`}
                >
                    {choice}
                </button>
            ))}
        </div>
        
        {isAnswered && (
             <div className="text-4xl font-extrabold mt-4 animate-level-up-reveal">
                 {selectedAnswer === problem.correctAnswer ? (
                     <span className="text-green-400">正解！</span>
                 ) : (
                     <span className="text-red-400">不正解...</span>
                 )}
             </div>
        )}
      </div>
    </div>
  );
};

export default MathQuiz;