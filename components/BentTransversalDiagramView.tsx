import React, { useMemo } from 'react';
import { BentTransversalDiagramData } from '../types';

interface BentTransversalDiagramViewProps {
    data: BentTransversalDiagramData;
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

    const isNumeric = (val: any): val is number => typeof val === 'number' && !isNaN(val);
    const displayText = isUnknown || !isNumeric(text) ? text : `${text}°`;

    return (
        <g>
            <path d={arcPath} stroke="#C0A062" strokeWidth="1.5" fill="none" />
            <text x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle" className={isUnknown ? "font-bold text-xl text-amber-400" : "font-bold text-base text-white font-mono"} fill={isUnknown ? "#fbbf24" : "white"}>
                {displayText}
            </text>
        </g>
    );
};

const BentTransversalDiagramView: React.FC<BentTransversalDiagramViewProps> = ({ data, userAnswer, isSubmitted }) => {
    const { topAngle, bottomAngle, unknownAngle, question } = data;

    const { viewBox, viewElements } = useMemo(() => {
        const width = 350;
        const height = 220;
        const y_l = 60;
        const y_m = 160;
        const bendPoint = { x: width / 2, y: (y_l + y_m) / 2 };

        const getAngleForCalc = (angle: { value: number | string, placement: string }) => {
            if (typeof angle.value !== 'number') return 60; // Default if value is a variable
            let effectiveAngle = angle.value;
            if (angle.placement.includes('exterior')) {
               effectiveAngle = 180 - angle.value;
            }
            return Math.max(15, Math.min(effectiveAngle, 89));
        };

        const topDrawAngle = getAngleForCalc(topAngle);
        const bottomDrawAngle = getAngleForCalc(bottomAngle);

        const degToRad = (deg: number) => deg * Math.PI / 180;
        const topTan = Math.tan(degToRad(topDrawAngle));
        const bottomTan = Math.tan(degToRad(bottomDrawAngle));

        const topIntersect = {
            x: bendPoint.x - (bendPoint.y - y_l) / topTan,
            y: y_l
        };
        const bottomIntersect = {
            x: bendPoint.x + (y_m - bendPoint.y) / bottomTan,
            y: y_m
        };

        const extendLine = (p1: {x: number, y: number}, p2: {x: number, y: number}, y_bound: number) => {
            if (p1.x === p2.x) return {x: p1.x, y: y_bound};
            if (p1.y === p2.y) return {x: p1.x > width / 2 ? width : 0, y: p1.y};
            const m = (p2.y - p1.y) / (p2.x - p1.x);
            const b = p1.y - m * p1.x;
            const x_at_bound = (y_bound - b) / m;
            return { x: x_at_bound, y: y_bound };
        }

        const startPoint = extendLine(bendPoint, topIntersect, 0);
        const endPoint = extendLine(bendPoint, bottomIntersect, height);
        
        // Determine angle display vectors based on placement
        const topIsRight = !topAngle.placement || topAngle.placement.includes('right');
        const topIsExterior = topAngle.placement?.includes('exterior');
        const v_top_h = { x: topIntersect.x + (topIsRight ? 50 : -50), y: y_l };
        const v_top_t = topIsExterior ? startPoint : bendPoint;

        const bottomIsLeft = !bottomAngle.placement || bottomAngle.placement.includes('left');
        const bottomIsExterior = bottomAngle.placement?.includes('exterior');
        const v_bottom_h = { x: bottomIntersect.x + (bottomIsLeft ? -50 : 50), y: y_m };
        const v_bottom_t = bottomIsExterior ? endPoint : bendPoint;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const updateBounds = (p: { x: number, y: number }) => {
            if(!p) return;
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        };
        
        [bendPoint, topIntersect, bottomIntersect, startPoint, endPoint].forEach(updateBounds);
        
        const padding = 60; 
        const vbWidth = (maxX - minX) + padding * 2;
        const vbHeight = (maxY - minY) + padding * 2;
        const finalViewBox = `${minX - padding} ${minY - padding} ${vbWidth} ${vbHeight}`;
        
        const anglesToRender = [
            { center: topIntersect, v1: v_top_h, v2: v_top_t, text: String(topAngle.value), isUnknown: false },
            { center: bottomIntersect, v1: v_bottom_h, v2: v_bottom_t, text: String(bottomAngle.value), isUnknown: false },
            { center: bendPoint, v1: topIntersect, v2: bottomIntersect, text: unknownAngle.label, isUnknown: true }
        ];
        
        const elements = (
            <>
                <line x1={minX - padding * 2} y1={y_l} x2={maxX + padding * 2} y2={y_l} stroke="#666" strokeWidth="2" />
                <text x={minX - padding + 10} y={y_l - 8} className="text-gray-400 font-sans text-base" fill="#9ca3af">l</text>
                <line x1={minX - padding * 2} y1={y_m} x2={maxX + padding * 2} y2={y_m} stroke="#666" strokeWidth="2" />
                <text x={minX - padding + 10} y={y_m - 8} className="text-gray-400 font-sans text-base" fill="#9ca3af">m</text>
                
                <path d={`M ${maxX + padding - 20} ${y_l} l 8 -4 l 0 8 z`} fill="#aaa" />
                <path d={`M ${maxX + padding - 20} ${y_m} l 8 -4 l 0 8 z`} fill="#aaa" />

                <line x1={startPoint.x} y1={startPoint.y} x2={bendPoint.x} y2={bendPoint.y} stroke="#888" strokeWidth="2" />
                <line x1={bendPoint.x} y1={bendPoint.y} x2={endPoint.x} y2={endPoint.y} stroke="#888" strokeWidth="2" />
                
                {anglesToRender.map((props, i) => <AngleDisplay key={i} {...props} />)}
            </>
        );

        return { viewBox: finalViewBox, viewElements: elements };
    }, [data]);
    

    return (
        <div className="flex flex-col items-center w-full">
            <p className="text-sm sm:text-lg md:text-xl mb-2 sm:mb-4 font-mono text-center">{question || `直線 l と m が平行なとき、∠${unknownAngle.label} の角度を求めなさい。`}</p>
            <svg width="100%" style={{ maxHeight: 'min(240px, 35vh)' }} viewBox={viewBox}>
                {viewElements}
            </svg>
            <div className="mt-2 sm:mt-4 flex items-baseline">
                <span className="text-xl sm:text-3xl font-bold text-white" style={{fontFamily: "'Playfair Display', serif"}}>{unknownAngle.label} = </span>
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

export default BentTransversalDiagramView;
