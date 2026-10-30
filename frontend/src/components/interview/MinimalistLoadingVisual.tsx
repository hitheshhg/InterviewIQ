import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface MinimalistLoadingVisualProps {
  title?: string;
  subtitle?: string;
  mode?: 'evaluating' | 'connecting';
  className?: string;
}

export const MinimalistLoadingVisual: React.FC<MinimalistLoadingVisualProps> = ({
  title = 'Evaluating response',
  subtitle = 'Calibrating technical accuracy & depth...',
  mode = 'evaluating',
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className={`h-full flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
    >
      {/* Minimalist Graphic Rings */}
      <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
        {/* Soft Ambient Glow */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.25, 0.6, 0.25],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md pointer-events-none"
        />

        {/* Outer Minimalist Dashed Orbit */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border border-dashed border-cyan-400/40"
        />

        {/* Counter-rotating Inner Accent Ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute w-11 h-11 rounded-full border border-violet-400/40 border-t-transparent"
        />

        {/* Dynamic Waveform Bars for Audio/AI Evaluation */}
        {mode === 'evaluating' ? (
          <div className="flex items-center gap-1 z-10">
            <motion.span
              animate={{ height: [6, 16, 6], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 bg-cyan-400 rounded-full"
            />
            <motion.span
              animate={{ height: [9, 22, 9], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
              className="w-1 bg-violet-400 rounded-full"
            />
            <motion.span
              animate={{ height: [12, 26, 12], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              className="w-1 bg-cyan-300 rounded-full"
            />
            <motion.span
              animate={{ height: [9, 22, 9], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: 0.45 }}
              className="w-1 bg-violet-400 rounded-full"
            />
            <motion.span
              animate={{ height: [6, 16, 6], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              className="w-1 bg-cyan-400 rounded-full"
            />
          </div>
        ) : (
          <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse z-10" />
        )}
      </div>

      {/* Typography */}
      <h4 className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
        {title}
      </h4>
      <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
        {subtitle}
      </p>
    </motion.div>
  );
};

export default MinimalistLoadingVisual;
