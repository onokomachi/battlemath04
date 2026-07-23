import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { GuidedEquationData, ProblemViewRef } from '../types';

interface GuidedEquationProblemViewProps {
  data: GuidedEquationData;
  isSubmitted: boolean;
  submittedAnswer: string;
  correctAnswer: string;
  onAnswerChange: (answer: string) => void;
}

const GuidedEquationProblemView = forwardRef<ProblemViewRef, GuidedEquationProblemViewProps>(({
  data,
  isSubmitted,
  submittedAnswer,
  correctAnswer,
  onAnswerChange
}, ref) => {
  const totalInputs = data.steps.reduce((acc, step) => acc + step.parts.filter(p => p === null).length, 0);
  const [inputs, setInputs] = useState<string[]>(Array(totalInputs).fill(''));
  const [focusedInput, setFocusedInput] = useState<number | null>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setInputs(Array(totalInputs).fill(''));
    setFocusedInput(0);
    inputRefs.current = inputRefs.current.slice(0, totalInputs);
  }, [data, totalInputs]);

  useEffect(() => {
    inputRefs.current[focusedInput ?? 0]?.focus();
  }, [focusedInput]);

  useImperativeHandle(ref, () => ({
    handleKeyClick: (key: string) => {
      if (focusedInput === null) return;
      const newInputs = [...inputs];
      if (key === 'BACKSPACE') {
        newInputs[focusedInput] = newInputs[focusedInput].slice(0, -1);
      } else if (key === 'CLEAR') {
        newInputs[focusedInput] = '';
      } else {
        newInputs[focusedInput] += key;
      }
      setInputs(newInputs);
      onAnswerChange(newInputs.join(';'));
    }
  }));

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
    onAnswerChange(newInputs.join(';'));
  };

  const submittedAnswers = submittedAnswer.split(';');
  const correctAnswers = correctAnswer.split(';');
  const normalize = (str: string) => str ? str.trim().replace(/\s+/g, '') : '';
  let inputCounter = -1;

  return (
    <div className="w-full text-lg sm:text-xl p-4 sm:p-6 bg-black/30 text-white rounded-md font-['Lato'] animate-math-fade-in opacity-0" style={{'--tw-bg-opacity': '0.9'} as React.CSSProperties}>
      <div className="space-y-3">
        {data.question && (
            <p className="text-2xl mb-4 border-b-2 border-gray-700 pb-2 font-mono text-center">{data.question}</p>
        )}
        {data.initial_equations && (
            <div className="flex justify-around text-2xl mb-4 border-b-2 border-gray-700 pb-2 font-mono">
                <span>①: {data.initial_equations[0]}</span>
                <span>②: {data.initial_equations[1]}</span>
            </div>
        )}
        {data.steps.map((step, stepIndex) => (
          <div key={stepIndex} className="flex items-center flex-wrap font-mono">
            {step.parts.map((part, partIndex) => {
              if (part === null) {
                inputCounter++;
                const currentIndex = inputCounter;
                const isCorrect = isSubmitted && normalize(submittedAnswers[currentIndex]) === normalize(correctAnswers[currentIndex]);
                
                let ringColor = 'focus:ring-amber-400';
                 if (isSubmitted) {
                    ringColor = isCorrect ? 'ring-green-500 bg-green-900/50' : 'ring-red-500 bg-red-900/50';
                } else if (focusedInput === currentIndex) {
                    ringColor = 'ring-2 ring-blue-500';
                }

                return (
                  <input
                    key={partIndex}
                    ref={el => { inputRefs.current[currentIndex] = el; }}
                    type="text"
                    value={inputs[currentIndex]}
                    onFocus={() => setFocusedInput(currentIndex)}
                    onChange={(e) => handleInputChange(currentIndex, e.target.value)}
                    disabled={isSubmitted}
                    className={`w-24 sm:w-28 bg-gray-900 border border-gray-700 rounded-md p-1 text-center text-white focus:outline-none transition-all mx-1 ${ringColor}`}
                  />
                );
              }
              return <span key={partIndex} className="mx-1">{part}</span>;
            })}
          </div>
        ))}
        {data.final_answer_prompt && data.initial_equations && (
            <div className="mt-6 pt-4 border-t-2 border-dashed border-amber-400 flex items-center">
                <span className="mr-4 text-2xl text-amber-300 font-['Playfair_Display']">{data.final_answer_prompt}</span>
                <div className="flex items-center font-mono">
                    <span>x=</span>
                    <span className="font-bold text-xl mx-2 p-1 border-b-2 border-gray-500 min-w-[3rem] text-center">
                        {isSubmitted ? correctAnswers.slice(-2, -1)[0] : ''}
                    </span>
                    <span className="ml-4">y=</span>
                    <span className="font-bold text-xl mx-2 p-1 border-b-2 border-gray-500 min-w-[3rem] text-center">
                        {isSubmitted ? correctAnswers.slice(-1)[0] : ''}
                    </span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
});

export default GuidedEquationProblemView;
