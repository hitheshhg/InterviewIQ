import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            className={twMerge(
              clsx(
                'w-full py-2.5 px-3.5 rounded-xl text-sm bg-white/5 border text-slate-100 placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-1',
                leftIcon ? 'pl-10' : 'pl-3.5',
                rightIcon ? 'pr-10' : 'pr-3.5',
                error
                  ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/50 bg-rose-500/[0.02]'
                  : 'border-white/10 focus:border-cyan-500/60 focus:ring-cyan-500/40 hover:border-white/20'
              ),
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 text-slate-400 pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
