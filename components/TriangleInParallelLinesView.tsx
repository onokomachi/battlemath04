import React, { useMemo } from 'react';
import { TriangleInParallelLinesData } from '../types';

interface TriangleInParallelLinesViewProps {
    data: TriangleInParallelLinesData;
    userAnswer: string;
    isSubmitted: boolean;
}

interface AngleDisplayProps {
    center: { x: number, y: number },
    v1: { x: number, y: number },
    v2: { x: number, y: number },
    text: string,
    isUnknown: boolean,
}

const AngleDisplay: React.FC<AngleDisplayProps> = ({ center, v1, v2, text, isUnknown }) => {
    const radius = 20;
    const textOffset = 15;

    const angle1 = Math.atan2(v1.y - center.y, v1.x - center.x);
    const angle2 = Math.atan2(v2.y - center.y, v2.x - center.x);
    
    let startAngle = Math.min(angle1, angle2);
    let endAngle = Math.max(angle1, angle2);

    if (endAngle - startAngle > Math.PI) {
      [startAngle, endAngle] = [endAngle, startAngle + 2 * Math.PI];
    }
    
    const start = {
        x: center.x + radius * Math.cos(startAngle),
        y: center.y + radius * Math.sin(startAngle)
    };
    const end = {
        x: center.x + radius * Math.cos(endAngle),
        y: center.y + radius * Math.sin(endAngle)
    };

    const largeArcFlag = (endAngle - startAngle) <= Math.PI ? "0" : "1";
    const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;

    const midAngle = startAngle + (endAngle - startAngle) / 2;
    const textPos = {
        x: center.x + (radius + textOffset) * Math.cos(midAngle),
        y: center.y + (radius + textOffset) * Math.sin(midAngle)
    };
    
    const className = isUnknown ? "angle-unknown-text" : "angle-known-text";
    const isNumeric = (val: any): val is number => typeof val === 'number' && !isNaN(val);
    const displayText = isUnknown || !isNumeric(text) ? text : `${text}°`;

    return (
        <g>
            <path d={arcPath} stroke="#C0A062" strokeWidth="1.5" fill="none" />
            <text x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle" className={className}>
                {displayText}
            </text>
        </g>
    );
};

const TriangleInParallelLinesView: React.FC<TriangleInParallelLinesViewProps> = ({ data, userAnswer, isSubmitted }) => {
    const { angles, unknown, questionText } = data;

    const { viewBox, viewElements } = useMemo(() => {
        const width = 350;
        const y_l = 60;
        const y_m = 160;

        let baseLeftAngle = 70;
        let baseRightAngle = 50;

        const findAngle = (pos: string) => angles.find(a => a.position === pos);

        const baseLeftData = findAngle('base_left');
        if(baseLeftData && typeof baseLeftData.value === 'number') baseLeftAngle = baseLeftData.value;
        
        const baseRightData = findAngle('base_right');
        if (baseRightData && typeof baseRightData.value === 'number') baseRightAngle = baseRightData.value;

        const baseRightExtData = findAngle('base_right_exterior');
        if (baseRightExtData && typeof baseRightExtData.value === 'number') baseRightAngle = 180 - baseRightExtData.value;
        
        const topExtLeftData = findAngle('top_exterior_left');
        if (topExtLeftData && typeof topExtLeftData.value === 'number') baseLeftAngle = topExtLeftData.value;

        baseLeftAngle = Math.max(10, Math.min(baseLeftAngle, 170));
        baseRightAngle = Math.max(10, Math.min(baseRightAngle, 170));

        const baseLength = 180;
        const C = { x: (width - baseLength)/2 + baseLength, y: y_m };
        const B = { x: (width - baseLength)/2, y: y_m };
        
        const h = (y_m - y_l);
        const degToRad = (deg: number) => deg * Math.PI / 180;
        
        const x_offset_A_from_B = h / Math.tan(degToRad(baseLeftAngle));
        const x_offset_A_from_C = h / Math.tan(degToRad(baseRightAngle));
        
        const xA_from_B = B.x + x_offset_A_from_B;
        const xA_from_C = C.x - x_offset_A_from_C;
        
        const A = { x: (xA_from_B + xA_from_C) / 2, y: y_l };
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const updateBounds = (p: { x: number, y: number }) => {
            if(!p) return;
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        };
        
        [A, B, C].forEach(updateBounds);
        
        const allAngles = [...angles.map(a => ({...a, value: String(a.value), isUnknown: false})), {value: unknown.label, position: unknown.position, isUnknown: true}];
        
        const anglePropsList = allAngles.map(angle => {
            switch (angle.position) {
                case 'base_left': return { center: B, v1: A, v2: C, text: String(angle.value), isUnknown: angle.isUnknown };
                case 'base_right': return { center: C, v1: B, v2: A, text: String(angle.value), isUnknown: angle.isUnknown };
                case 'base_right_exterior': return { center: C, v1: A, v2: {x: C.x + 50, y: y_m}, text: String(angle.value), isUnknown: angle.isUnknown };
                case 'top_exterior_left': return { center: A, v1: B, v2: {x: A.x - 50, y: y_l}, text: String(angle.value), isUnknown: angle.isUnknown };
                case 'top_exterior_right': return { center: A, v1: {x: A.x + 50, y: y_l}, v2: C, text: String(angle.value), isUnknown: angle.isUnknown };
                case 'top_vertex': return { center: A, v1: B, v2: C, text: String(angle.value), isUnknown: angle.isUnknown };
                default: return null;
            }
        }).filter(p => p !== null);

        const padding = 60;
        const vbWidth = (maxX - minX) + padding * 2;
        const vbHeight = (maxY - minY) + padding * 2;
        const finalViewBox = `${minX - padding} ${minY - padding} ${vbWidth} ${vbHeight}`;
        
        const elements = (
             <>
                <line x1={minX-padding*2} y1={y_l} x2={maxX+padding*2} y2={y_l} stroke="#666" strokeWidth="2" />
                <text x={minX - padding + 10} y={y_l - 8} className="line-label">a</text>
                <line x1={minX-padding*2} y1={y_m} x2={maxX+padding*2} y2={y_m} stroke="#666" strokeWidth="2" />
                <text x={minX - padding + 10} y={y_m - 8} className="line-label">b</text>
                
                <path d={`M ${maxX + padding - 20} ${y_l} l 8 -4 l 0 8 z`} fill="#aaa" />
                <path d={`M ${maxX + padding - 20} ${y_m} l 8 -4 l 0 8 z`} fill="#aaa" />

                <path d={`M ${A.x} ${A.y} L ${B.x} ${B.y} L ${C.x} ${C.y} Z`} stroke="white" strokeWidth="1.5" fill="none" />
                
                {anglePropsList.map((props, i) => props ? <AngleDisplay key={i} {...props} /> : null)}
            </>
        );

        return { viewBox: finalViewBox, viewElements: elements };
    }, [data]);
    

    return (
        <div className="flex flex-col items-center w-full">
            <p className="text-sm sm:text-lg md:text-xl mb-2 sm:mb-4 font-mono text-center">{questionText || `直線 a と b が平行なとき、∠${unknown.label}の角度を求めなさい。`}</p>
            <svg width="100%" style={{ maxHeight: 'min(240px, 35vh)' }} viewBox={viewBox}>
                 <defs>
                    <style>{`
                        .angle-known-text { font: bold 16px 'Roboto Mono', monospace; fill: white; }
                        .angle-unknown-text { font: bold 20px 'Playfair Display', serif; fill: #fbbf24; }
                        .line-label { font: 16px 'Lato', sans-serif; fill: #aaa; }
                    `}</style>
                </defs>
                {viewElements}
            </svg>
            <div className="mt-2 sm:mt-4 flex items-baseline">
                <span className="text-xl sm:text-3xl font-bold text-white font-['Playfair_Display']">{unknown.label} = </span>
                <span
                    className={`text-2xl sm:text-4xl font-mono min-w-[80px] sm:min-w-[120px] text-center border-b-2 pb-1 transition-colors text-amber-300 ${isSubmitted ? 'border-transparent' : 'border-amber-400'}`}
                >
                    {userAnswer}
                </span>
                 <span className="text-2xl sm:text-4xl font-mono text-amber-300">°</span>
            </div>
        </div>
    );
};

export default TriangleInParallelLinesView;
