import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { VerticalCalculationData, ProblemViewRef } from '../types';

interface VerticalCalculationProblemViewProps {
  data: VerticalCalculationData;
  isSubmitted: boolean;
  submittedAnswer: string;
  correctAnswer: string;
  onAnswerChange: (answer: string) => void;
}

const VerticalCalculationProblemView = forwardRef<ProblemViewRef, VerticalCalculationProblemViewProps>(({
  data,
  isSubmitted,
  submittedAnswer,
  correctAnswer,
  onAnswerChange,
}, ref) => {
  const { operator, lines } = data;
  
  const numInputs = correctAnswer.split(';').length;
  
  const [inputs, setInputs] = useState<string[]>(Array(numInputs).fill(''));
  const [focusedInput, setFocusedInput] = useState<number | null>(0);
  
  useEffect(() => {
    setInputs(Array(numInputs).fill(''));
    setFocusedInput(0);
  }, [data, numInputs]);
  
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

  return (
    <div className="flex items-start justify-center w-full font-['Lato']">
      <div className="text-4xl mr-4 mt-8 font-mono">{operator}</div>
      <div className="flex flex-col items-end font-mono">
        <span>{lines[0]}</span>
        <span>{lines[1]}</span>
        <hr className="w-full border-t-2 border-purple-400 my-2" />
        <div className="flex gap-2">
          {inputs.map((value, index) => {
            const isCorrect = isSubmitted && normalize(submittedAnswers[index]) === normalize(correctAnswers[index]);
            
            let ringColor = 'focus:ring-purple-400';
            if (isSubmitted) {
                ringColor = isCorrect ? 'ring-green-500' : 'ring-red-500';
            } else if (focusedInput === index) {
                ringColor = 'ring-purple-400';
            }

            return (
                <input
                    key={index}
                    type="text"
                    value={value}
                    onFocus={() => setFocusedInput(index)}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    disabled={isSubmitted}
                    className={`w-24 bg-gray-900 border border-gray-700 rounded-md p-2 text-xl text-center text-white ring-2 ring-transparent focus:outline-none transition-shadow ${ringColor}`}
                />
            );
           })}
        </div>
      </div>
    </div>
  );
});

export default VerticalCalculationProblemView;