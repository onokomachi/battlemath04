import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EraseIcon } from './Icons';

interface DrawingCanvasProps {
  isVisible: boolean;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  const setCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    if(canvas.width !== width || canvas.height !== height){
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if(ctx){
            // Phase 3: プラズマ・インク（ネオン設定）
            ctx.strokeStyle = '#c084fc'; // Purple-400
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(168, 85, 247, 0.8)';
            setContext(ctx);
        }
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      setCanvasSize();
      window.addEventListener('resize', setCanvasSize);
      return () => window.removeEventListener('resize', setCanvasSize);
    }
  }, [isVisible, setCanvasSize]);

  const getCoords = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in event.nativeEvent && event.nativeEvent.touches.length > 0) {
      return {
        offsetX: event.nativeEvent.touches[0].clientX - rect.left,
        offsetY: event.nativeEvent.touches[0].clientY - rect.top
      };
    }
    return {
      offsetX: (event as React.MouseEvent).nativeEvent.offsetX,
      offsetY: (event as React.MouseEvent).nativeEvent.offsetY
    };
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!context) return;
    const { offsetX, offsetY } = getCoords(event);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing || !context) return;
    const { offsetX, offsetY } = getCoords(event);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair pointer-events-auto"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <button 
        onClick={clearCanvas}
        className="absolute bottom-24 right-8 btn-tactical p-4 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.2)] flex items-center justify-center transition-all hover:scale-110 pointer-events-auto border-red-500/40 hover:bg-red-500/20 text-red-400"
        aria-label="Purge Memo"
      >
        <EraseIcon className="w-8 h-8" />
      </button>
    </div>
  );
};

export default DrawingCanvas;