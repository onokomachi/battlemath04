import React, { forwardRef } from 'react';
import { IntersectionGuidedEquationData, ProblemViewRef } from '../types';
import GraphProblemView from './GraphProblemView';
import GuidedEquationProblemView from './GuidedEquationProblemView';

interface IntersectionGuidedEquationViewProps {
  data: IntersectionGuidedEquationData;
  isSubmitted: boolean;
  submittedAnswer: string;
  correctAnswer: string;
  onAnswerChange: (answer: string) => void;
}

const IntersectionGuidedEquationView = forwardRef<ProblemViewRef, IntersectionGuidedEquationViewProps>(({
  data,
  ...props
}, ref) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 w-full items-stretch">
      <div className="md:w-1/2 flex items-center justify-center aspect-square">
        <GraphProblemView lines={data.graphLines} polygon={undefined} />
      </div>
      <div className="md:w-1/2 flex items-center">
        <GuidedEquationProblemView
          ref={ref}
          data={data.guidedEquation}
          {...props}
        />
      </div>
    </div>
  );
});

export default IntersectionGuidedEquationView;
