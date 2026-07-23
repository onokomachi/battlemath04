import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { ProofProblemData, ProblemViewRef } from '../types';

interface ProofProblemViewProps {
  data: ProofProblemData;
  onAnswerChange: (answer: string) => void;
  isSubmitted: boolean;
}

const ProofProblemView = forwardRef<ProblemViewRef, ProofProblemViewProps>(({ data, onAnswerChange, isSubmitted }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    handleKeyClick: (key: string) => {
      // Proof view does not use keypad, but handle it gracefully.
    }
  }));

  return (
    <div className="w-full text-left font-['Lato']">
      <div className="bg-black/50 p-4 rounded-md border border-gray-800">
        <h3 className="font-bold text-purple-400 text-lg mb-2 font-['Playfair_Display']">仮定</h3>
        <p className="text-white text-base font-mono">{data.assumption}</p>
        <h3 className="font-bold text-purple-400 text-lg mt-4 mb-2 font-['Playfair_Display']">結論</h3>
        <p className="text-white text-base font-mono">{data.conclusion}</p>
        {(data as any).svg && (
          <div className="svg-container mt-4 w-full max-w-[200px] mx-auto" dangerouslySetInnerHTML={{ __html: (data as any).svg }} />
        )}
        {(data as any).imageUrl && !(data as any).svg && (
          <div className="mt-4 flex justify-center">
            <img src={(data as any).imageUrl} alt="問題図" className="max-w-full max-h-48 object-contain rounded-md bg-white p-1" />
          </div>
        )}
      </div>

      <textarea
        ref={textareaRef}
        onChange={(e) => onAnswerChange(e.target.value)}
        disabled={isSubmitted}
        placeholder="ここに証明を記述してください..."
        className="w-full h-48 mt-4 bg-gray-900 border border-gray-700 rounded-md p-4 text-base text-white focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow font-['Lato']"
      />
    </div>
  );
});

export default ProofProblemView;