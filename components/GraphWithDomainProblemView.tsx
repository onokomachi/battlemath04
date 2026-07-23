
import React, { useRef, useEffect, useCallback } from 'react';
import { GraphWithDomainProblemData } from '../types';
import GraphHintOverlay from './GraphHintOverlay';

interface GraphWithDomainProblemViewProps {
  data: GraphWithDomainProblemData;
  isVisualHintVisible: boolean;
}

const GraphWithDomainProblemView: React.FC<GraphWithDomainProblemViewProps> = ({ data, isVisualHintVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { equation } = data;

  const gridSize = 25;
  const numLines = 10;
  const xDomain: [number, number] = [-10, 10];
  const yDomain: [number, number] = [-10, 10];

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
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height); ctx.stroke();
    
    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = "bold 10px 'JetBrains Mono'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = -numLines; i <= numLines; i++) {
        if (i !== 0 && i % 2 === 0) {
            ctx.fillText(String(i), centerX + i * gridSize, centerY + 16);
            ctx.fillText(String(-i), centerX - 16, centerY + i * gridSize);
        }
    }
  }, [gridSize, numLines]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const m = equation.m;
    const b = equation.c;
    
    const x1_grid = xDomain[0] - 2;
    const y1_grid = m * x1_grid + b;
    const x2_grid = xDomain[1] + 2;
    const y2_grid = m * x2_grid + b;

    ctx.moveTo(centerX + x1_grid * gridSize, centerY - y1_grid * gridSize);
    ctx.lineTo(centerX + x2_grid * gridSize, centerY - y2_grid * gridSize);
    ctx.stroke();

  }, [equation, gridSize, xDomain]);
  
  const setCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const { width } = container.getBoundingClientRect();
    const height = width; // Make it square
    if(canvas.width !== width || canvas.height !== height){
        canvas.width = width;
        canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
        drawGrid(ctx, width, height);
        drawLine(ctx, width, height);
    }
  }, [drawGrid, drawLine]);

  useEffect(() => {
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    return () => window.removeEventListener('resize', setCanvasSize);
  }, [setCanvasSize]);

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 items-center">
      <div className="w-full md:w-5/12 flex flex-col items-center">
        <div className="hud-panel p-6 rounded-2xl border border-red-500/10 w-full shadow-2xl">
            <p className="text-center text-lg sm:text-xl font-mono leading-relaxed">{data.question}</p>
        </div>
      </div>
      <div className="w-full md:w-7/12 relative aspect-square">
        <div className="relative p-1 bg-red-500/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)] h-full">
            <canvas ref={canvasRef} className="w-full h-full bg-black rounded-lg" />
            {isVisualHintVisible && canvasRef.current && (
                <GraphHintOverlay
                    hints={data.visualHints}
                    xDomain={xDomain}
                    yDomain={yDomain}
                    width={canvasRef.current.width}
                    height={canvasRef.current.height}
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default GraphWithDomainProblemView;
