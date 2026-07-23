
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { GraphingProblemData, ProblemViewRef } from '../types';

interface GraphingProblemViewProps {
  data: GraphingProblemData;
  onAnswerChange: (answer: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const GraphingProblemView = forwardRef<ProblemViewRef | null, GraphingProblemViewProps>(({ data, onAnswerChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);

  const gridSize = 30;
  const numLines = 10;

  useImperativeHandle(ref, () => ({
      handleKeyClick: (key: string) => { /* Graphing view does not use keypad */ }
  }));
  
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'; // Visible but subtle grid
    ctx.lineWidth = 1;

    for (let i = -numLines; i <= numLines; i++) {
      // Vertical grid lines
      ctx.beginPath();
      ctx.moveTo(centerX + i * gridSize, 0);
      ctx.lineTo(centerX + i * gridSize, height);
      ctx.stroke();

      // Horizontal grid lines
      ctx.beginPath();
      ctx.moveTo(0, centerY + i * gridSize);
      ctx.lineTo(width, centerY + i * gridSize);
      ctx.stroke();
    }

    // Draw X and Y Axes (Thicker and Cyan for differentiation)
    ctx.strokeStyle = '#f87171'; // Accent Red
    ctx.lineWidth = 3;
    
    // X-Axis
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Y-Axis
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = "bold 12px 'JetBrains Mono'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = -numLines; i <= numLines; i++) {
        if (i !== 0 && i % 2 === 0) {
            ctx.fillText(String(i), centerX + i * gridSize, centerY + 18);
            ctx.fillText(String(-i), centerX - 18, centerY + i * gridSize);
        }
    }

  }, [gridSize, numLines]);

  const drawPointsAndLine = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    if (points.length === 2) {
        ctx.strokeStyle = '#ffffff'; // White line for current plot
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]); // Dashed line for previewing
        ctx.beginPath();
        const p1 = points[0];
        const p2 = points[1];
        
        if (p1.x === p2.x) { // Vertical line
            ctx.moveTo(centerX + p1.x * gridSize, 0);
            ctx.lineTo(centerX + p1.x * gridSize, height);
        } else {
            const m = (p2.y - p1.y) / (p2.x - p1.x);
            const b = p1.y - m * p1.x;
            const x1_canvas = -centerX / gridSize;
            const x2_canvas = centerX / gridSize;
            const y1_canvas = m * x1_canvas + b;
            const y2_canvas = m * x2_canvas + b;

            ctx.moveTo(0, centerY - y1_canvas * gridSize);
            ctx.lineTo(width, centerY - y2_canvas * gridSize);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
    }
      
    ctx.fillStyle = '#ffffff'; 
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f87171';
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(centerX + p.x * gridSize, centerY - p.y * gridSize, 6, 0, 2 * Math.PI);
        ctx.fill();
    });
    ctx.shadowBlur = 0; // Reset shadow

  }, [points, gridSize]);

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

  }, [points, drawGrid, drawPointsAndLine]);
  
  useEffect(() => {
      setPoints([]);
      onAnswerChange('');
  }, [data, onAnswerChange]);
  
  const calculateEquation = (p1: Point, p2: Point): string => {
    if (p1.x === p2.x) {
        return `x=${p1.x}`;
    }
    const m = (p2.y - p1.y) / (p2.x - p1.x);
    const b = p1.y - m * p1.x;
    
    let equation = "y=";
    if (m !== 0) {
        if (m === 1) equation += "x";
        else if (m === -1) equation += "-x";
        else equation += `${m.toLocaleString(undefined, { maximumFractionDigits: 2 })}x`;
    }
    
    if (b !== 0) {
        if (m !== 0) {
             equation += b > 0 ? `+${b.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `${b.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        } else {
            equation += b.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
    } else if (m === 0) {
        equation += '0';
    }
    
    return equation;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const gridX = Math.round((x - centerX) / gridSize);
    const gridY = Math.round((centerY - y) / gridSize);

    const newPoint = { x: gridX, y: gridY };

    setPoints(prevPoints => {
        let updatedPoints = [...prevPoints, newPoint];
        if (updatedPoints.length > 2) {
            updatedPoints = [newPoint]; // Start over
        }
        
        if (updatedPoints.length === 2) {
            const equation = calculateEquation(updatedPoints[0], updatedPoints[1]);
            onAnswerChange(equation);
        } else {
            onAnswerChange('');
        }
        
        return updatedPoints;
    });
  };

  return (
    <div className="w-full text-center">
      <p className="mb-4 text-white text-xl whitespace-pre-line font-mono tracking-tighter">{data.question}</p>
      <div className="relative p-1 bg-red-500/20 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.2)]">
        <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-64 md:h-80 bg-black rounded-lg cursor-crosshair"
        />
      </div>
      <div className='mt-4 p-3 bg-slate-900/80 rounded-lg border border-red-500/20 backdrop-blur-md'>
          <p className="text-xs text-red-500 font-black uppercase tracking-widest">Initialization_Status</p>
          <p className="text-sm text-white/70 mt-1">グラフ上の点を2つプロットして直線を確定してください。</p>
          {points.length > 0 && 
            <div className="flex gap-2 justify-center mt-2">
                {points.map((p, i) => (
                    <span key={i} className="text-[10px] font-mono bg-red-950 text-red-300 px-2 py-1 rounded border border-red-400/30">
                        Node_{i+1}: ({p.x}, {p.y})
                    </span>
                ))}
            </div>
          }
      </div>
    </div>
  );
});

export default GraphingProblemView;
