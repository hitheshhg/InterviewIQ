import React from 'react';
import { motion } from 'framer-motion';

export type AIOrbState = 'idle' | 'speaking' | 'listening' | 'thinking';

interface AIOrbProps {
  state: AIOrbState;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export const AIOrb: React.FC<AIOrbProps> = ({
  state = 'idle',
  size = 140,
  className = '',
  onClick,
}) => {
  // Color presets depending on active state
  const stateConfig = {
    idle: {
      gradient: 'from-cyan-500/80 via-indigo-500/70 to-violet-600/80',
      glow: 'rgba(6, 182, 212, 0.35)',
      ringColor: 'border-cyan-500/30',
      label: 'AI Interviewer Ready',
      labelColor: 'text-cyan-300',
    },
    speaking: {
      gradient: 'from-cyan-400 via-sky-500 to-indigo-600',
      glow: 'rgba(56, 189, 248, 0.65)',
      ringColor: 'border-sky-400/50',
      label: 'Interviewer Speaking...',
      labelColor: 'text-sky-300',
    },
    listening: {
      gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
      glow: 'rgba(52, 211, 153, 0.65)',
      ringColor: 'border-emerald-400/50',
      label: 'Listening to You...',
      labelColor: 'text-emerald-300',
    },
    thinking: {
      gradient: 'from-amber-400 via-orange-500 to-violet-600',
      glow: 'rgba(251, 191, 36, 0.6)',
      ringColor: 'border-amber-400/50',
      label: 'AI Evaluating Answer...',
      labelColor: 'text-amber-300',
    },
  };

  const current = stateConfig[state];

  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${className}`}
      onClick={onClick}
    >
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: size * 1.5, height: size * 1.5 }}
      >
        {/* Outer ambient glow */}
        <motion.div
          animate={{
            scale: state === 'speaking' ? [1, 1.25, 1] : state === 'listening' ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: state === 'idle' ? 0.3 : 0.6,
          }}
          transition={{
            duration: state === 'speaking' ? 1.5 : 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
          style={{ backgroundColor: current.glow }}
        />

        {/* Outer animated ripple rings when speaking or listening */}
        {(state === 'speaking' || state === 'listening') && (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className={`absolute rounded-full border ${current.ringColor}`}
              style={{ width: size, height: size }}
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.7, opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: 0.6,
                ease: 'easeOut',
              }}
              className={`absolute rounded-full border ${current.ringColor}`}
              style={{ width: size, height: size }}
            />
          </>
        )}

        {/* Orbiting particles ring when thinking */}
        {state === 'thinking' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute rounded-full border border-dashed border-amber-400/40"
            style={{ width: size * 1.25, height: size * 1.25 }}
          >
            <span className="absolute -top-1.5 left-1/2 w-3 h-3 rounded-full bg-amber-400 shadow-lg shadow-amber-400/80" />
          </motion.div>
        )}

        {/* Main Central Orb */}
        <motion.div
          animate={{
            scale: state === 'speaking' ? [1, 1.08, 0.98, 1.04, 1] : state === 'listening' ? [1, 1.06, 1] : [1, 1.02, 1],
            rotate: state === 'thinking' ? 360 : 0,
          }}
          transition={{
            duration: state === 'speaking' ? 2 : state === 'thinking' ? 8 : 4,
            repeat: Infinity,
            ease: state === 'thinking' ? 'linear' : 'easeInOut',
          }}
          className={`relative rounded-full bg-gradient-to-tr ${current.gradient} shadow-2xl backdrop-blur-md flex items-center justify-center border border-white/20`}
          style={{
            width: size,
            height: size,
            boxShadow: `0 0 35px ${current.glow}, inset 0 0 25px rgba(255,255,255,0.3)`,
          }}
        >
          {/* Glass highlight glare */}
          <div className="absolute top-2 left-3 w-1/3 h-1/4 rounded-full bg-gradient-to-b from-white/40 to-transparent transform -rotate-45 pointer-events-none" />

          {/* Internal core iris pulse */}
          <motion.div
            animate={{
              scale: state === 'speaking' ? [0.85, 1.1, 0.85] : [0.95, 1.05, 0.95],
              opacity: state === 'idle' ? 0.6 : 0.9,
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-1/2 h-1/2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30"
          />
        </motion.div>
      </div>

      {/* State Status Tag */}
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            state === 'speaking'
              ? 'bg-sky-400 animate-ping'
              : state === 'listening'
              ? 'bg-emerald-400 animate-pulse'
              : state === 'thinking'
              ? 'bg-amber-400 animate-spin'
              : 'bg-cyan-400'
          }`}
        />
        <span className={`text-xs font-medium font-mono ${current.labelColor}`}>
          {current.label}
        </span>
      </motion.div>
    </div>
  );
};

export default AIOrb;
