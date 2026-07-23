
import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  messages: string[];
}

const GameLog: React.FC<GameLogProps> = ({ messages }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="absolute bottom-4 right-4 w-64 h-48 bg-black/50 backdrop-blur-sm text-white rounded-lg p-2 flex flex-col shadow-lg border border-gray-700">
      <h3 className="text-center font-bold text-purple-300 border-b border-gray-600 pb-1 mb-2">ゲームログ</h3>
      <div ref={logContainerRef} className="flex-grow overflow-y-auto text-sm space-y-1">
        {messages.map((msg, index) => (
          <p key={index} className="opacity-90">{msg}</p>
        ))}
      </div>
    </div>
  );
};

export default GameLog;