import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { SimultaneousEquationData, ProblemViewRef } from '../types';

interface SimultaneousEquationProblemViewProps {
  data: SimultaneousEquationData;
  onAnswerChange: (answer: string) => void;
  isSubmitted: boolean;
}

const formatEquation = (eq: { a: number, b: number, c: number }): string => {
  let str = '';

  // x term
  if (eq.a !== 0) {
    if (eq.a === 1) str += 'x';
    else if (eq.a === -1) str += '-x';
    else str += `${eq.a}x`;
  }

  // y term
  if (eq.b !== 0) {
    // Determine sign/separator
    if (eq.b > 0) {
      if (str.length > 0) str += ' + '; // Add '+' only if it's not the first term
    } else { // b is negative
      if (str.length > 0) str += ' - '; // Add separator
      else str += '-'; // It's the first term, just add the sign
    }
    
    // Determine coefficient/variable
    const absB = Math.abs(eq.b);
    if (absB === 1) str += 'y';
    else str += `${absB}y`;
  }

  if (str.length === 0) {
    str = '0'; // Handle case where a=0 and b=0
  }

  str += ` = ${eq.c}`;
  return str;
};

const SimultaneousEquationProblemView = forwardRef<ProblemViewRef, SimultaneousEquationProblemViewProps>(({ data, onAnswerChange, isSubmitted }, ref) => {
  const [answers, setAnswers] = useState({ x: '', y: '' });
  const [focusedInput, setFocusedInput] = useState<'x' | 'y'>('x');
  const xInputRef = useRef<HTMLInputElement>(null);
  const yInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAnswers({ x: '', y: '' });
    setFocusedInput('x');
    setTimeout(() => xInputRef.current?.focus(), 100);
  }, [data]);

  useEffect(() => {
    onAnswerChange(`x=${answers.x},y=${answers.y}`);
  }, [answers, onAnswerChange]);
  
  useImperativeHandle(ref, () => ({
    handleKeyClick: (key: string) => {
      const target = focusedInput;
      const currentVal = answers[target];
      let newVal = currentVal;
      
      if (key === 'BACKSPACE') {
        newVal = currentVal.slice(0, -1);
      } else if (key === 'CLEAR') {
        newVal = '';
      } else if (key === '-') {
        if (currentVal.length === 0) {
          newVal = '-';
        }
      } else if (/^[0-9]$/.test(key)) {
        newVal += key;
      }

      if (newVal !== currentVal) {
        setAnswers(s => ({ ...s, [target]: newVal }));
      }
    }
  }));

  const eq1String = formatEquation(data.eq1);
  const eq2String = formatEquation(data.eq2);

  return (
    <div className="w-full text-center font-['Lato']">
      <div 
        className="text-3xl sm:text-4xl leading-relaxed mb-6 animate-math-fade-in opacity-0 font-mono"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex flex-col items-start text-left mx-auto max-w-max gap-2">
          <p>
            <span className="inline-block w-8 text-center text-2xl text-gray-400 font-sans">①</span>
            {eq1String}
          </p>
          <p>
            <span className="inline-block w-8 text-center text-2xl text-gray-400 font-sans">②</span>
            {eq2String}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <div className="flex items-center gap-2">
          <label htmlFor="x-answer" className="text-2xl sm:text-3xl font-mono text-purple-400">x =</label>
          <input
            ref={xInputRef}
            id="x-answer"
            type="text"
            inputMode="decimal"
            value={answers.x}
            onFocus={() => setFocusedInput('x')}
            onChange={(e) => setAnswers(s => ({ ...s, x: e.target.value }))}
            disabled={isSubmitted}
            className={`w-24 sm:w-32 bg-gray-900 border-2 rounded-md p-2 text-2xl sm:text-3xl text-center text-white focus:outline-none transition-all ${focusedInput === 'x' && !isSubmitted ? 'border-purple-400' : 'border-gray-700'}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="y-answer" className="text-2xl sm:text-3xl font-mono text-purple-400">y =</label>
          <input
            ref={yInputRef}
            id="y-answer"
            type="text"
            inputMode="decimal"
            value={answers.y}
            onFocus={() => setFocusedInput('y')}
            onChange={(e) => setAnswers(s => ({ ...s, y: e.target.value }))}
            disabled={isSubmitted}
            className={`w-24 sm:w-32 bg-gray-900 border-2 rounded-md p-2 text-2xl sm:text-3xl text-center text-white focus:outline-none transition-all ${focusedInput === 'y' && !isSubmitted ? 'border-purple-400' : 'border-gray-700'}`}
          />
        </div>
      </div>
    </div>
  );
});

export default SimultaneousEquationProblemView;