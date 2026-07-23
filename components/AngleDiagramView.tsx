import React from 'react';
import { AngleDiagramData } from '../types';

interface AngleDiagramViewProps {
    data: AngleDiagramData;
    userAnswer: string;
    isSubmitted: boolean;
}

const AngleDiagramView: React.FC<AngleDiagramViewProps> = ({ data, userAnswer, isSubmitted }) => {
    const { config, question } = data;
    const { known, unknown } = config;

    const width = 300;
    const height = 180;
    const y_l = 50; // y-coordinate of line l
    const y_m = 130; // y-coordinate of line m

    // --- Dynamic Angle Calculation ---
    // 1. Determine the acute angle `theta` for the diagram from problem data
    const baseAngle = known[0]?.value || 60; // Default to 60 if no known angle
    const basePosition = known[0]?.position || 2;

    // Assuming a transversal with a negative slope (top-left to bottom-right)
    const acutePositions = [2, 3, 6, 7];
    const isBaseAnglePositionAcute = acutePositions.includes(basePosition);

    let drawingAngle = 60; // This is the acute angle used for drawing
    if (baseAngle > 0 && baseAngle < 180) {
        // If the problem angle is at an acute position, use it directly.
        // If it's at an obtuse position, use its supplement.
        drawingAngle = isBaseAnglePositionAcute ? baseAngle : 180 - baseAngle;
    }
    
    // Clamp the angle for better visualization to avoid extreme cases.
    drawingAngle = Math.max(15, Math.min(drawingAngle, 89));

    // 2. Calculate transversal line points based on the drawingAngle
    const centerX = width / 2;
    const centerYOnTransversal = (y_l + y_m) / 2;

    const thetaRad = drawingAngle * Math.PI / 180;
    const slope = -Math.tan(thetaRad); // Negative slope for a top-left to bottom-right line
    const c = centerYOnTransversal - slope * centerX; // From y = mx + c

    // Find where the line intersects the SVG boundaries
    const pointsOnBoundary = [];
    // Check left/right boundaries
    const yAtX0 = c;
    if (yAtX0 >= 0 && yAtX0 <= height) pointsOnBoundary.push({ x: 0, y: yAtX0 });
    const yAtXWidth = slope * width + c;
    if (yAtXWidth >= 0 && yAtXWidth <= height) pointsOnBoundary.push({ x: width, y: yAtXWidth });
    // Check top/bottom boundaries
    if (slope !== 0) {
        const xAtY0 = -c / slope;
        if (xAtY0 > 0 && xAtY0 < width) pointsOnBoundary.push({ x: xAtY0, y: 0 });
        const xAtYHeight = (height - c) / slope;
        if (xAtYHeight > 0 && xAtYHeight < width) pointsOnBoundary.push({ x: xAtYHeight, y: height });
    }

    let p_start_transversal = { x: 40, y: 0 };
    let p_end_transversal = { x: 250, y: height };

    if (pointsOnBoundary.length >= 2) {
        p_start_transversal = pointsOnBoundary[0];
        p_end_transversal = pointsOnBoundary[1];
    }
    // --- End Dynamic Angle Calculation ---


    // Calculate precise intersection points of the dynamic transversal with parallel lines
    const transversal_slope = (p_end_transversal.y - p_start_transversal.y) / (p_end_transversal.x - p_start_transversal.x);
    const ix_l = (y_l - p_start_transversal.y) / transversal_slope + p_start_transversal.x;
    const ix_m = (y_m - p_start_transversal.y) / transversal_slope + p_start_transversal.x;

    const int_l = { x: ix_l, y: y_l }; // Top intersection
    const int_m = { x: ix_m, y: y_m }; // Bottom intersection

    const textRadius = 25; // Text distance from center

    // Normalized vector for the transversal line
    const dx = p_end_transversal.x - p_start_transversal.x;
    const dy = p_end_transversal.y - p_start_transversal.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const u_t = { x: dx / mag, y: dy / mag };

    // Unit vectors for cardinal directions relative to the angle vertex
    const u_h_right = { x: 1, y: 0 };
    const u_h_left = { x: -1, y: 0 };
    const u_t_down = u_t;
    const u_t_up = { x: -u_t.x, y: -u_t.y };
    
    // Function to create angle data (text position)
    const createAngle = (center: {x:number, y:number}, v_start: {x:number, y:number}, v_end: {x:number, y:number}) => {
        // Bisector vector for text positioning
        const v_bisector = { x: v_start.x + v_end.x, y: v_start.y + v_end.y };
        const mag_bisector = Math.sqrt(v_bisector.x ** 2 + v_bisector.y ** 2);
        const u_bisector = mag_bisector > 0 ? { x: v_bisector.x / mag_bisector, y: v_bisector.y / mag_bisector } : { x: 0, y: 0 };
        const textPos: [number, number] = [center.x + textRadius * u_bisector.x, center.y + textRadius * u_bisector.y];

        return { textPos };
    };

    const anglePositions: { [key: number]: { textPos: [number, number] } } = {
        1: createAngle(int_l, u_h_left, u_t_up),    // top-left
        2: createAngle(int_l, u_t_up, u_h_right),   // top-right
        3: createAngle(int_l, u_t_down, u_h_left),  // bottom-left
        4: createAngle(int_l, u_h_right, u_t_down), // bottom-right
        5: createAngle(int_m, u_h_left, u_t_up),    // top-left
        6: createAngle(int_m, u_t_up, u_h_right),   // top-right
        7: createAngle(int_m, u_t_down, u_h_left),  // bottom-left
        8: createAngle(int_m, u_h_right, u_t_down), // bottom-right
    };

    return (
        <div className="flex flex-col items-center w-full">
             <p className="text-sm sm:text-lg md:text-xl mb-2 sm:mb-4 font-mono text-center">{question || `直線lとmが平行なとき、∠${unknown.name} の角度を求めなさい。`}</p>
            <svg width="100%" style={{ maxHeight: 'min(220px, 35vh)' }} viewBox={`0 0 ${width} ${height}`}>
                {/* Parallel lines */}
                <line x1="0" y1={y_l} x2={width} y2={y_l} stroke="#666" strokeWidth="2" />
                <text x="5" y={y_l - 8} className="text-gray-400 font-sans text-base" fill="#9ca3af">l</text>
                <line x1="0" y1={y_m} x2={width} y2={y_m} stroke="#666" strokeWidth="2" />
                <text x="5" y={y_m - 8} className="text-gray-400 font-sans text-base" fill="#9ca3af">m</text>
                
                {/* Parallel line markers */}
                <path d={`M ${width*0.6} ${y_l} l 8 -4 l 0 8 z`} fill="#aaa" />
                <path d={`M ${width*0.6} ${y_m} l 8 -4 l 0 8 z`} fill="#aaa" />

                {/* Transversal line */}
                <line x1={p_start_transversal.x} y1={p_start_transversal.y} x2={p_end_transversal.x} y2={p_end_transversal.y} stroke="#666" strokeWidth="2" />
                
                {/* Known Angles */}
                {known.map(angle => {
                    const pos = anglePositions[angle.position];
                    if (!pos) return null;
                    return (
                        <g key={`known-${angle.position}`}>
                            <text x={pos.textPos[0]} y={pos.textPos[1]} textAnchor="middle" dominantBaseline="middle" className="font-bold text-lg font-mono text-white" fill="white">{angle.value}°</text>
                        </g>
                    );
                })}

                {/* Unknown Angle */}
                {(() => {
                    const pos = anglePositions[unknown.position];
                    if (!pos) return null;
                    return (
                        <g>
                            <text x={pos.textPos[0]} y={pos.textPos[1]} textAnchor="middle" dominantBaseline="middle" className="font-bold text-xl text-amber-400" fill="#fbbf24" style={{fontFamily: "'Playfair Display', serif"}}>{unknown.name}</text>
                        </g>
                    );
                })()}
            </svg>
            <div className="mt-2 sm:mt-4 flex items-baseline">
                <span className="text-xl sm:text-3xl font-bold text-white" style={{fontFamily: "'Playfair Display', serif"}}>{unknown.name} = </span>
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

export default AngleDiagramView;
