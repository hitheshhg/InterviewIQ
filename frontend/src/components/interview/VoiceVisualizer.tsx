import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface VoiceVisualizerProps {
  isActive: boolean;
  barCount?: number;
  mode?: 'user' | 'interviewer';
  className?: string;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isActive,
  barCount = 16,
  mode = 'user',
  className = '',
}) => {
  const [heights, setHeights] = useState<number[]>(new Array(barCount).fill(15));

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setHeights(
          Array.from({ length: barCount }, () => {
            // Generate natural fluctuating speech frequencies (20% to 100%)
            return Math.floor(Math.random() * 80) + 20;
          })
        );
      }, 90);
    } else {
      setHeights(new Array(barCount).fill(12));
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, barCount]);

  const barColor =
    mode === 'interviewer'
      ? 'from-cyan-400 to-violet-500'
      : 'from-emerald-400 to-cyan-500';

  return (
    <div
      className={`flex items-center justify-center gap-1 h-12 px-3 py-1 rounded-xl bg-black/30 border border-white/5 backdrop-blur-sm select-none ${className}`}
    >
      {heights.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: `${h}%` }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          className={`w-1 rounded-full bg-gradient-to-t ${barColor} opacity-90`}
          style={{ minHeight: '4px', maxHeight: '100%' }}
        />
      ))}
    </div>
  );
};

export default VoiceVisualizer;
