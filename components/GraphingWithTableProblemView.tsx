
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { GraphingWithTableProblemData, ProblemViewRef } from '../types';
import { CheckCircleIcon } from './Icons';

interface GraphingWithTableProblemViewProps {
  data: GraphingWithTableProblemData;
  onAnswerChange: (answer: string) => void;
}

interface Point { x: number; y: number; }

const GraphingWithTableProblemView = forwardRef<ProblemViewRef | null, GraphingWithTableProblemViewProps>(({ data, onAnswerChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<'table' | 'graph'>('table');
  const [tableInputs, setTableInputs] = useState<string[]>(Array(data.table.length).fill(''));
  const [tableCorrect, setTableCorrect] = useState<boolean[]>(Array(data.table.length).fill(false));
  const [focusedInput, setFocusedInput] = useState<number | null>(0);
  const [graphPoints, setGraphPoints] = useState<Point[]>([]);

  const gridSize = 25;
  const numLines = 12;

  useEffect(() => {
    setStage('table');
    setTableInputs(Array(data.table.length).fill(''));
    setTableCorrect(Array(data.table.length).fill(false));
    setGraphPoints([]);
    setFocusedInput(0);
    onAnswerChange('');
  }, [data, onAnswerChange]);

  useEffect(() => {
    const allCorrect = tableCorrect.every(c => c);
    if (allCorrect && stage === 'table') {
      setTimeout(() => setStage('graph'), 500);
    }
  }, [tableCorrect, stage]);

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...tableInputs];
    newInputs[index] = value;
    setTableInputs(newInputs);

    const isCorrect = parseFloat(value) === data.table[index].y;
    const newCorrect = [...tableCorrect];
    newCorrect[index] = isCorrect;
    setTableCorrect(newCorrect);
  };
  
  useImperativeHandle(ref, () => ({
    handleKeyClick: (key: string) => {
      if (stage !== 'table' || focusedInput === null) return;
      const newInputs = [...tableInputs];
      let currentVal = newInputs[focusedInput];
      if (key === 'BACKSPACE') currentVal = currentVal.slice(0, -1);
      else if (key === 'CLEAR') currentVal = '';
      else if (key === '-' && currentVal.length === 0) currentVal = '-';
      else if (key === '.' && !currentVal.includes('.')) currentVal += '.';
      else if (!isNaN(parseInt(key))) currentVal += key;
      handleInputChange(focusedInput, currentVal);
    }
  }));
  
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;

    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    for (let i = -numLines; i <= numLines; i++) {
      ctx.beginPath(); ctx.moveTo(centerX + i * gridSize, 0); ctx.lineTo(centerX + i * gridSize, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, centerY + i * gridSize); ctx.lineTo(width, centerY + i * gridSize); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height); ctx.stroke();
  }, [gridSize, numLines]);

  const drawPointsAndLine = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    if (graphPoints.length === 2) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const p1 = graphPoints[0];
      const p2 = graphPoints[1];
      const m = (p2.y - p1.y) / (p2.x - p1.x);
      const b = p1.y - m * p1.x;
      const x1 = -numLines;
      const y1 = m * x1 + b;
      const x2 = numLines;
      const y2 = m * x2 + b;
      ctx.moveTo(centerX + x1 * gridSize, centerY - y1 * gridSize);
      ctx.lineTo(centerX + x2 * gridSize, centerY - y2 * gridSize);
      ctx.stroke();
    }

    ctx.fillStyle = '#f87171';
    graphPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(centerX + p.x * gridSize, centerY - p.y * gridSize, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [graphPoints, gridSize, numLines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    drawGrid(ctx, width, height);
    drawPointsAndLine(ctx, width, height);
  }, [drawGrid, drawPointsAndLine, graphPoints]);

  const calculateEquation = (p1: Point, p2: Point): string => {
    if (p1.x === p2.x) return `x=${p1.x}`;
    const m = (p2.y - p1.y) / (p2.x - p1.x);
    const b = p1.y - m * p1.x;
    
    const formatNum = (n: number) => {
        if (n === 0.5) return '1/2';
        if (n === -0.5) return '-1/2';
        return parseFloat(n.toFixed(2)).toString();
    };
    
    let equation = "y=";
    if (m !== 0) {
        if (m === 1) equation += "x";
        else if (m === -1) equation += "-x";
        else equation += `${formatNum(m)}x`;
    }
    if (b !== 0) {
        if (m !== 0) equation += b > 0 ? `+${formatNum(b)}` : `${formatNum(b)}`;
        else equation += formatNum(b);
    } else if (m === 0) equation += '0';
    return equation;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || stage !== 'graph') return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const gridX = Math.round((x - centerX) / gridSize);
    const gridY = Math.round((centerY - y) / gridSize);
    setGraphPoints(prev => {
        let updatedPoints = [...prev, { x: gridX, y: gridY }];
        if (updatedPoints.length > 2) updatedPoints = [updatedPoints[2]];
        if (updatedPoints.length === 2) onAnswerChange(calculateEquation(updatedPoints[0], updatedPoints[1]));
        return updatedPoints;
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full text-white">
      <div className="md:w-5/12 flex flex-col items-center">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-red-500/20 w-full">
            <p className="text-2xl font-mono mb-4 text-center text-red-300">{data.equation}</p>
            <table className="w-full border-collapse font-mono text-center">
            <thead><tr className="border-b-2 border-red-400"><th className="p-2 w-1/2 text-red-500">x</th><th className="p-2 w-1/2 text-red-500">y</th></tr></thead>
            <tbody>
                {data.table.map((row, index) => (
                <tr key={index} className="border-b border-white/5">
                    <td className="p-2 text-xl">{row.x}</td>
                    <td className="p-1 relative">
                    <input type="text" value={tableInputs[index]} onFocus={() => setFocusedInput(index)} onChange={(e) => handleInputChange(index, e.target.value)} disabled={stage !== 'table'} className={`w-full bg-black/40 border rounded-md p-2 text-xl text-center focus:outline-none transition-all ${tableCorrect[index] ? 'border-green-500 bg-green-500/5' : 'border-slate-700 focus:border-red-500'}`} />
                    {tableCorrect[index] && <CheckCircleIcon className="w-6 h-6 text-green-400 absolute right-2 top-1/2 -translate-y-1/2" />}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
      <div className="md:w-7/12 flex flex-col">
        <div className={`relative p-1 bg-red-500/20 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-opacity duration-500 ${stage === 'graph' ? 'opacity-100' : 'opacity-40'}`}>
            <canvas ref={canvasRef} onClick={handleCanvasClick} className={`w-full h-80 bg-black rounded-lg ${stage === 'graph' ? 'cursor-crosshair' : 'cursor-not-allowed'}`} />
            {stage !== 'graph' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-xs font-black tracking-widest text-red-700 animate-pulse">AWAITING_TABLE_DATA</div>
                </div>
            )}
        </div>
        <div className="mt-4 text-center">
            <p className="text-[10px] text-red-700 font-black uppercase tracking-[0.3em]">
                {stage === 'table' ? 'Step 1: Calculate coordinates' : 'Step 2: Plot points on grid'}
            </p>
        </div>
      </div>
    </div>
  );
});

export default GraphingWithTableProblemView;
