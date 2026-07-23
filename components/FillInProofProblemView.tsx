import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { FillInProofProblemData, ProblemViewRef } from '../types';

interface FillInProofProblemViewProps {
  data: FillInProofProblemData;
  isSubmitted: boolean;
  submittedAnswer: string;
  correctAnswer: string;
  onAnswerChange: (answer: string) => void;
}

const FillInProofProblemView = forwardRef<ProblemViewRef | null, FillInProofProblemViewProps>(({
  data,
  isSubmitted,
  submittedAnswer,
  correctAnswer,
  onAnswerChange
}, ref) => {
  const totalInputs = data.steps.reduce((acc, step) => {
      return acc + step.parts.filter(p => p === null || (typeof p === 'object' && p !== null && 'options' in p)).length;
  }, 0);
  
  const [inputs, setInputs] = useState<string[]>(Array(totalInputs).fill(''));
  const [focusedInput, setFocusedInput] = useState<number | null>(0);
  const inputRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([]);

  useEffect(() => {
    const initialInputs = Array(totalInputs).fill('');
    let counter = 0;
    data.steps.forEach(step => {
      step.parts.forEach(part => {
        if (typeof part === 'object' && part !== null && 'options' in part) {
          initialInputs[counter] = part.options[0]; // Default to first option
        }
        if (part === null || (typeof part === 'object' && part !== null && 'options' in part)) {
          counter++;
        }
      });
    });
    setInputs(initialInputs);
    setFocusedInput(0);
    onAnswerChange(initialInputs.join(';'));
    inputRefs.current = inputRefs.current.slice(0, totalInputs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, totalInputs]);

  useEffect(() => {
    if(typeof focusedInput === 'number') {
        inputRefs.current[focusedInput]?.focus();
    }
  }, [focusedInput]);

  useImperativeHandle(ref, () => ({
    handleKeyClick: (key: string) => {
      if (typeof focusedInput !== 'number') return;
      
      const targetElement = inputRefs.current[focusedInput];
      if (targetElement && targetElement.tagName === 'SELECT') {
          // Don't handle keypad for dropdowns
          return;
      }

      const newInputs = [...inputs];
      const currentVal = newInputs[focusedInput];
      let newVal = currentVal;
      
      if (key === 'BACKSPACE') {
        newVal = currentVal.slice(0, -1);
      } else if (key === 'CLEAR') {
        newVal = '';
      } else {
        newVal += key;
      }
      
      if (newVal !== currentVal) {
        newInputs[focusedInput] = newVal;
        setInputs(newInputs);
        onAnswerChange(newInputs.join(';'));
      }
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
  const normalize = (str: string) => str ? str.trim().replace(/\s+/g, '').replace(/[（）]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toLowerCase() : '';
  let inputCounter = -1;

  return (
    <div className="w-full text-lg p-2 sm:p-4 bg-black/30 text-white rounded-md font-['Lato'] animate-math-fade-in opacity-0" style={{'--tw-bg-opacity': '0.9'} as React.CSSProperties}>
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-shrink-0 md:w-1/3">
                <p className="text-base text-center mb-2">{data.question}</p>
                {data.svg ? (
                    <div className="svg-container w-full max-w-[200px] mx-auto" dangerouslySetInnerHTML={{ __html: data.svg }} />
                ) : data.imageUrl ? (
                    <div className="my-2 w-full p-1 bg-black/20 rounded-lg flex justify-center items-center">
                        <img src={data.imageUrl} alt="問題図" className="max-w-full max-h-48 object-contain rounded-md bg-white p-1" />
                    </div>
                ) : null}
            </div>
            <div className="flex-grow space-y-2 text-sm sm:text-base md:text-lg">
                {data.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="flex items-center flex-wrap leading-relaxed">
                        {step.parts.map((part, partIndex) => {
                            if (typeof part === 'string') {
                                return <span key={`${stepIndex}-${partIndex}`} className="mx-1">{part}</span>;
                            }
                            
                            inputCounter++;
                            const currentIndex = inputCounter;
                            const isCorrect = isSubmitted && normalize(submittedAnswers[currentIndex]) === normalize(correctAnswers[currentIndex]);
                            
                            let ringColor = 'focus:ring-amber-400';
                            if (isSubmitted) {
                                ringColor = isCorrect ? 'ring-green-500 bg-green-900/50' : 'ring-red-500 bg-red-900/50';
                            } else if (focusedInput === currentIndex) {
                                ringColor = 'ring-2 ring-blue-500';
                            }

                            if (part !== null && typeof part === 'object' && 'options' in part) {
                                return (
                                    <select
                                        key={`${stepIndex}-${partIndex}`}
                                        ref={el => { inputRefs.current[currentIndex] = el; }}
                                        value={inputs[currentIndex]}
                                        onFocus={() => setFocusedInput(currentIndex)}
                                        onChange={(e) => handleInputChange(currentIndex, e.target.value)}
                                        disabled={isSubmitted}
                                        className={`bg-gray-900 border border-gray-700 rounded-md p-1 text-center text-white focus:outline-none transition-all mx-1 ${ringColor}`}
                                    >
                                        {part.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                );
                            }

                            return (
                            <input
                                key={`${stepIndex}-${partIndex}`}
                                ref={el => { inputRefs.current[currentIndex] = el; }}
                                type="text"
                                value={inputs[currentIndex]}
                                onFocus={() => setFocusedInput(currentIndex)}
                                onChange={(e) => handleInputChange(currentIndex, e.target.value)}
                                disabled={isSubmitted}
                                className={`w-24 sm:w-28 bg-gray-900 border border-gray-700 rounded-md p-1 text-center text-white focus:outline-none transition-all mx-1 font-mono ${ringColor}`}
                            />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
});

export default FillInProofProblemView;