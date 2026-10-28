import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends HTMLMotionProps<'div'> {
  hoverEffect?: boolean;
  glow?: 'cyan' | 'violet' | 'emerald' | 'amber' | 'none';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverEffect = false,
  glow = 'none',
  padding = 'md',
  className,
  children,
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const glowStyles = {
    none: '',
    cyan: 'shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)] border-cyan-500/20',
    violet: 'shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)] border-violet-500/20',
    emerald: 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] border-emerald-500/20',
    amber: 'shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] border-amber-500/20',
  };

  return (
    <motion.div
      className={twMerge(
        clsx(
          'glass-card rounded-2xl relative overflow-hidden transition-all duration-300',
          hoverEffect && 'glass-card-hover',
          glowStyles[glow],
          paddingStyles[padding],
          className
        )
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;

