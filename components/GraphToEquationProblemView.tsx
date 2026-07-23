
import React, { useRef, useEffect, useCallback } from 'react';
import { GraphToEquationProblemData } from '../types';

interface Point {
  x: number;
  y: number;
}

interface GraphToEquationProblemViewProps {
  data: GraphToEquationProblemData;
}

const GraphToEquationProblemView: React.FC<GraphToEquationProblemViewProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { points } = data;

  const gridSize = 30;
  const numLines = 10;
  
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    for (let i = -numLines; i <= numLines; i++) {
      ctx.beginPath(); ctx.moveTo(centerX + i * gridSize, 0); ctx.lineTo(centerX + i * gridSize, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, centerY + i * gridSize); ctx.lineTo(width, centerY + i * gridSize); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height); ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = "bold 11px 'JetBrains Mono'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = -numLines; i <= numLines; i++) {
        if (i !== 0 && i % 2 === 0) {
            ctx.fillText(String(i), centerX + i * gridSize, centerY + 20);
            ctx.fillText(String(-i), centerX - 20, centerY + i * gridSize);
        }
    }
  }, [gridSize, numLines]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    if (points.length === 2) {
        ctx.strokeStyle = '#f87171'; // red-400
        ctx.lineWidth = 3;
        ctx.beginPath();
        const p1 = points[0];
        const p2 = points[1];
        
        if (p1.x === p2.x) { // Vertical line
            ctx.moveTo(centerX + p1.x * gridSize, 0);
            ctx.lineTo(centerX + p1.x * gridSize, height);
        } else {
            const m = (p2.y - p1.y) / (p2.x - p1.x);
            const b = p1.y - m * p1.x;
            const x1_grid = -numLines - 2;
            const y1_grid = m * x1_grid + b;
            const x2_grid = numLines + 2;
            const y2_grid = m * x2_grid + b;
            ctx.moveTo(centerX + x1_grid * gridSize, centerY - y1_grid * gridSize);
            ctx.lineTo(centerX + x2_grid * gridSize, centerY - y2_grid * gridSize);
        }
        ctx.stroke();
    }
  }, [points, gridSize, numLines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        drawGrid(ctx, width, height);
        drawLine(ctx, width, height);
    }
  }, [drawGrid, drawLine, points]);
  
  return (
    <div className="w-full text-center">
      <p className="mb-4 text-white text-xl whitespace-pre-line font-mono tracking-tight">{data.question}</p>
      <div className="relative p-1 bg-red-500/20 rounded-xl overflow-hidden shadow-2xl">
        <canvas
            ref={canvasRef}
            className="w-full h-64 md:h-80 bg-black rounded-lg"
        />
      </div>
    </div>
  );
};

export default GraphToEquationProblemView;
