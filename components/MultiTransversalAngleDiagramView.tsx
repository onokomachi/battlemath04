
import React, { useMemo } from 'react';
import { AngleInfo, MultiTransversalAngleData, Transversal } from '../types';

interface MultiTransversalAngleDiagramViewProps {
    data: MultiTransversalAngleData;
    userAnswer: string;
    isSubmitted: boolean;
}

interface AngleDisplayProps {
    center: { x: number, y: number },
    v1: { x: number, y: number },
    v2: { x: number, y: number },
    text: string,
    isUnknown: boolean,
    radius: number,
}

const AngleDisplay: React.FC<AngleDisplayProps> = ({ center, v1, v2, text, isUnknown, radius }) => {
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
    const isNumeric = (str: string) => !isNaN(parseFloat(str)) && isFinite(str as any);
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

const MultiTransversalAngleDiagramView: React.FC<MultiTransversalAngleDiagramViewProps> = ({ data, userAnswer, isSubmitted }) => {
    const { parallelLines = [], transversals: initialTransversals = [], angles = [], questionText } = data;

    const { viewBox, viewElements } = useMemo(() => {
        const centerX = 200;
        const dynamicTransversals: Transversal[] = [];
        
        for (let i = 0; i < initialTransversals.length; i++) {
            const originalT = initialTransversals[i];
            if (!originalT || !originalT.p1 || !originalT.p2) continue;

            const definingAngleInfo = angles.find(a => a.transversalIndex === i && !a.isUnknown && !isNaN(parseFloat(a.value)));
            let slope = (originalT.p2.y - originalT.p1.y) / (originalT.p2.x - originalT.p1.x);

            if (definingAngleInfo) {
                const angleValue = parseFloat(definingAngleInfo.value);
                const isPositiveSlope = slope > 0;
                const acutePositions = isPositiveSlope ? ['top-right', 'bottom-left'] : ['top-left', 'bottom-right'];
                
                let acuteAngle;
                if (acutePositions.includes(definingAngleInfo.position)) {
                    acuteAngle = angleValue < 90 ? angleValue : 180 - angleValue;
                } else {
                    acuteAngle = angleValue > 90 ? 180 - angleValue : angleValue;
                }
                
                acuteAngle = Math.max(15, Math.min(acuteAngle, 89));
                const sign = isPositiveSlope ? 1 : -1;
                slope = Math.tan(acuteAngle * Math.PI / 180) * sign;
            }

            const intersectionY = parallelLines.length > 1 ? parallelLines[1].y : 150;
            const intersectPoint = {
                x: centerX + (i - (initialTransversals.length - 1) / 2) * 50,
                y: intersectionY
            };
            
            const b = intersectPoint.y - slope * intersectPoint.x;
            dynamicTransversals.push({ p1: { x: 0, y: b }, p2: { x: 400, y: slope * 400 + b } });
        }
        
        const transversals = dynamicTransversals;

        const getIntersection = (pLineY: number, tLine: Transversal): {x: number, y: number} => {
            const { p1, p2 } = tLine;
            if (p1.y === p2.y) return { x: 200, y: pLineY };
            if (p1.x === p2.x) return { x: p1.x, y: pLineY };
            const m = (p2.y - p1.y) / (p2.x - p1.x);
            const b = p1.y - m * p1.x;
            const x = (pLineY - b) / m;
            return { x, y: pLineY };
        };
        
        const getTransversalIntersection = (t1: Transversal, t2: Transversal): {x: number, y: number} | null => {
            if (!t1?.p1 || !t1?.p2 || !t2?.p1 || !t2?.p2) return null;
            const { p1: a, p2: b } = t1;
            const { p1: c, p2: d } = t2;
            const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
            if (denominator === 0) return null;
            const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
            return {
                x: a.x + t * (b.x - a.x),
                y: a.y + t * (b.y - a.y)
            };
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const mainPoints: ({x: number, y: number}|null)[] = [];

        parallelLines.forEach(pLine => {
            mainPoints.push({x: 0, y: pLine.y});
            mainPoints.push({x: 400, y: pLine.y});
            transversals.forEach(tLine => {
                mainPoints.push(getIntersection(pLine.y, tLine));
            });
        });
        
        mainPoints.forEach(p => {
            if(!p || typeof p.x !== 'number') return;
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });

        const intersections = transversals.map(t => parallelLines.map(p => getIntersection(p.y, t)));

        const anglesByCenter: { [key: string]: AngleInfo[] } = {};
        angles.forEach(angle => {
            if (!angle) return;
            let center: {x: number, y: number} | null = null;
            if (angle.isIntersectionAngle) {
                center = getTransversalIntersection(transversals[angle.transversalIndex], transversals[angle.parallelLineIndex]);
            } else if (intersections[angle.transversalIndex]) {
                center = intersections[angle.transversalIndex][angle.parallelLineIndex];
            }
            if (center && typeof center.x === 'number') {
                const key = `${center.x.toFixed(2)}-${center.y.toFixed(2)}`;
                if (!anglesByCenter[key]) anglesByCenter[key] = [];
                anglesByCenter[key].push(angle);
            }
        });

        const anglePropsList = angles.map((angle) => {
            if (!angle) return null;
            let center: { x: number, y: number } | null = null;
            let vec1, vec2;
            
            if(angle.isIntersectionAngle) {
                const t1 = transversals[angle.transversalIndex];
                const t2 = transversals[angle.parallelLineIndex];
                if (!t1?.p1 || !t2?.p1) return null;

                center = getTransversalIntersection(t1, t2);
                if (!center) return null;

                const v1_raw = { x: t1.p1.x - center.x, y: t1.p1.y - center.y };
                const v2_raw = { x: t2.p1.x - center.x, y: t2.p1.y - center.y };

                 switch (angle.position) {
                    case 'top-left': vec1 = v1_raw; vec2 = v2_raw; break;
                    case 'top-right': vec1 = {x: -v2_raw.x, y: -v2_raw.y}; vec2 = v1_raw; break;
                    case 'bottom-left': vec1 = v2_raw; vec2 = {x: -v1_raw.x, y: -v1_raw.y}; break;
                    case 'bottom-right': vec1 = {x: -v1_raw.x, y: -v1_raw.y}; vec2 = {x: -v2_raw.x, y: -v2_raw.y}; break;
                    default: vec1 = v1_raw; vec2 = v2_raw; break;
                }
            } else {
                if (!intersections[angle.transversalIndex]) return null;
                center = intersections[angle.transversalIndex][angle.parallelLineIndex];
                if (!center) return null;

                const tLine = transversals[angle.transversalIndex];
                if (!tLine?.p1 || !tLine?.p2) return null;

                const tVec = { x: tLine.p2.x - tLine.p1.x, y: tLine.p2.y - tLine.p1.y };
                const hVec = { x: 1, y: 0 };
                
                switch (angle.position) {
                    case 'top-left': vec1 = {x: -hVec.x, y: hVec.y}; vec2 = {x: -tVec.x, y: -tVec.y}; break;
                    case 'top-right': vec1 = hVec; vec2 = {x: -tVec.x, y: -tVec.y}; break;
                    case 'bottom-left': vec1 = {x: -hVec.x, y: hVec.y}; vec2 = tVec; break;
                    case 'bottom-right': vec1 = hVec; vec2 = tVec; break;
                    default: vec1 = hVec; vec2 = tVec; break;
                }
            }
            
            const v1_point = { x: center.x + vec1.x, y: center.y + vec1.y };
            const v2_point = { x: center.x + vec2.x, y: center.y + vec2.y };
            
            const centerKey = `${center.x.toFixed(2)}-${center.y.toFixed(2)}`;
            const anglesAtThisCenter = anglesByCenter[centerKey] || [];
            const angleIndexAtCenter = anglesAtThisCenter.findIndex(a => a === angle);
            const baseRadius = 25;
            const radiusStep = 20;
            const radius = baseRadius + (angleIndexAtCenter > -1 ? angleIndexAtCenter * radiusStep : 0);
            
            return { center, v1: v1_point, v2: v2_point, text: angle.value, isUnknown: angle.isUnknown, radius };
        }).filter(p => p !== null && p.center !== null);

        const padding = 60;
        const vbWidth = (maxX === -Infinity) ? 400 : (maxX - minX) + padding * 2;
        const vbHeight = (maxY === -Infinity) ? 300 : (maxY - minY) + padding * 2;
        const finalViewBox = `${(minX === Infinity) ? 0 : minX - padding} ${(minY === Infinity) ? 0 : minY - padding} ${vbWidth} ${vbHeight}`;
        
        const elements = (
            <>
                {parallelLines.map((line, index) => (
                    <g key={`p-line-${index}`}>
                        <line x1={minX - padding * 2} y1={line.y} x2={maxX + padding * 2} y2={line.y} stroke="#666" strokeWidth="2" />
                        <text x={minX - padding + 10} y={line.y - 8} className="line-label">{line.label}</text>
                    </g>
                ))}

                {transversals.map((line, index) => {
                    return (<line key={`t-line-${index}`} x1={line.p1.x} y1={line.p1.y} x2={line.p2.x} y2={line.p2.y} stroke="#888" strokeWidth="2" />)
                })}
                
                {anglePropsList.map((props, i) => props ? <AngleDisplay key={i} {...props} /> : null)}
            </>
        );

        return { viewBox: finalViewBox, viewElements: elements };

    }, [data, parallelLines, initialTransversals, angles]);

    const parallelLineInfo = parallelLines.map(l => l.label).join(', ');
    const unknownAngle = angles.find(a => a.isUnknown);
    const defaultQuestion = `直線 ${parallelLineInfo} が平行なとき、∠${unknownAngle ? unknownAngle.value : 'x'}の角度を求めなさい。`;

    return (
        <div className="flex flex-col items-center w-full">
            <p className="text-sm sm:text-lg md:text-xl mb-2 sm:mb-4 font-mono text-center whitespace-pre-line">{questionText || defaultQuestion}</p>
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
                <span className="text-xl sm:text-3xl font-bold text-white font-['Playfair_Display']">{unknownAngle ? unknownAngle.value : 'x'} = </span>
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

export default MultiTransversalAngleDiagramView;
