
import React, { useRef, useEffect, useCallback } from 'react';
import { GraphLineData, GraphPolygonData } from '../types';

interface GraphProblemViewProps {
  lines: GraphLineData[];
  polygon?: GraphPolygonData;
}

const GraphProblemView: React.FC<GraphProblemViewProps> = ({ lines = [], polygon }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const xDomain: [number, number] = [-8, 8];
  const yDomain: [number, number] = [-8, 8];

  const mapCoords = useCallback((mathX: number, mathY: number, width: number, height: number) => {
    const x = ((mathX - xDomain[0]) / (xDomain[1] - xDomain[0])) * width;
    const y = ((yDomain[1] - mathY) / (yDomain[1] - yDomain[0])) * height;
    return { x, y };
  }, [xDomain, yDomain]);
  
  const draw = useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;
    
    const { width } = container.getBoundingClientRect();
    const height = width; // Keep it square
    svg.setAttribute('width', `${width}`);
    svg.setAttribute('height', `${height}`);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const { x: originX, y: originY } = mapCoords(0, 0, width, height);

    let elements = `<defs><style>
        .grid-line { stroke: rgba(255, 255, 255, 0.25); stroke-width: 1; }
        .axis-line { stroke: #f87171; stroke-width: 3; stroke-linecap: round; }
        .label-text { fill: rgba(255, 255, 255, 0.4); font-size: 11px; font-family: 'JetBrains Mono', monospace; font-weight: bold; }
        .line-label { font: bold 14px 'JetBrains Mono', sans-serif; text-shadow: 0 0 5px black; }
    </style></defs>`;

    // Grid
    for (let i = Math.ceil(xDomain[0]); i <= Math.floor(xDomain[1]); i++) {
        const { x } = mapCoords(i, 0, width, height);
        elements += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="grid-line" />`;
        if (i !== 0 && i % 2 === 0) {
           elements += `<text x="${x}" y="${originY + 18}" text-anchor="middle" class="label-text">${i}</text>`;
        }
    }
    for (let i = Math.ceil(yDomain[0]); i <= Math.floor(yDomain[1]); i++) {
        const { y } = mapCoords(0, i, width, height);
        elements += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="grid-line" />`;
        if (i !== 0 && i % 2 === 0) {
            elements += `<text x="${originX - 18}" y="${y}" text-anchor="end" dominant-baseline="middle" class="label-text">${i}</text>`;
        }
    }

    // Axes
    elements += `<line x1="0" y1="${originY}" x2="${width}" y2="${originY}" class="axis-line" />`;
    elements += `<line x1="${originX}" y1="0" x2="${originX}" y2="${height}" class="axis-line" />`;

    // Polygon
    if (polygon && polygon.points) {
        const pointsStr = polygon.points.map(p => {
            if (!p) return "0,0";
            const { x, y } = mapCoords(p.x, p.y, width, height);
            return `${x},${y}`;
        }).join(' ');
        const color = polygon.color || 'rgba(239, 68, 68, 0.15)';
        elements += `<polygon points="${pointsStr}" fill="${color}" stroke="rgba(239, 68, 68, 0.4)" stroke-width="1.5" />`;
    }

    // Lines
    lines.forEach((line, index) => {
        if (!line) return;
        const { m, c } = line;
        const x1_math = xDomain[0] - 2;
        const y1_math = m * x1_math + c;
        const x2_math = xDomain[1] + 2;
        const y2_math = m * x2_math + c;
        const p1 = mapCoords(x1_math, y1_math, width, height);
        const p2 = mapCoords(x2_math, y2_math, width, height);
        const color = line.color || (index === 0 ? '#f87171' : '#60a5fa');
        elements += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="3" />`;

        if (line.label) {
            let lx = 0, ly = 0;
            if(Math.abs(m) < 1) { // more horizontal
                lx = xDomain[0] + 1;
                ly = m * lx + c;
            } else { // more vertical
                ly = yDomain[0] + 2;
                if(c > 0 && m < 0) ly = yDomain[1] - 2;
                if(c < 0 && m > 0) ly = yDomain[0] + 2;
                lx = (ly - c) / m;
            }
            
            const {x, y} = mapCoords(lx, ly, width, height);
            const textAnchor = lx > (xDomain[0]+xDomain[1])/2 ? "end" : "start";
            const offsetX = textAnchor === "start" ? 10 : -10;

            elements += `<text x="${x + offsetX}" y="${y - 10}" fill="${color}" class="line-label" text-anchor="${textAnchor}">${line.label}</text>`;
        }
    });

    svg.innerHTML = elements;
  }, [mapCoords, xDomain, yDomain, lines, polygon]);

  useEffect(() => {
    // Initial draw
    const timer = setTimeout(draw, 50);
    window.addEventListener('resize', draw);
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', draw);
    }
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black rounded-lg border border-red-500/10 shadow-inner">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphProblemView;
