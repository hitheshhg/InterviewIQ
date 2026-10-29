import React from 'react';
import { Navigate } from 'react-router-dom';
import { Sparkles, FileCheck, Mic, Map } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

interface LandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { currentUser, loading } = useAuth();

  // If already logged in, redirect immediately to dashboard
  if (currentUser && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative h-screen w-full flex flex-col justify-between items-center px-4 py-8 bg-[#0B0F19] text-slate-100 overflow-hidden select-none">
      {/* Top Header: Logo + App Name */}
      <header className="w-full max-w-5xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">
            Interview<span className="text-cyan-400">IQ</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenAuth('signin')}
            className="text-xs sm:text-sm"
          >
            Sign in
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenAuth('signup')}
            className="text-xs sm:text-sm"
          >
            Sign up
          </Button>
        </div>
      </header>

      {/* Main Hero: Tagline, Explanation, 3 Icons & Actions */}
      <main className="relative z-10 max-w-2xl text-center flex flex-col items-center my-auto space-y-7">
        {/* Soft Glowing Orb behind tagline */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* Tagline (one line) */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Get grilled by AI.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
            Get hired by humans.
          </span>
        </h1>

        {/* Short explanation (max 2 lines) */}
        <p className="text-sm sm:text-base text-slate-400 max-w-lg leading-relaxed">
          Master technical interviews with real-time AI voice roleplay and automated ATS resume optimization.
        </p>

        {/* 3 small icon-with-label items (3 words max each, no paragraphs) */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300">
            <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resume score</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300">
            <Mic className="w-3.5 h-3.5 text-violet-400" />
            <span>Voice interview</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300">
            <Map className="w-3.5 h-3.5 text-emerald-400" />
            <span>Career roadmap</span>
          </div>
        </div>

        {/* Two buttons only: Sign in and Sign up */}
        <div className="flex items-center gap-4 pt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => onOpenAuth('signup')}
            className="px-8 shadow-lg shadow-cyan-500/20"
          >
            Sign up
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onOpenAuth('signin')}
            className="px-8"
          >
            Sign in
          </Button>
        </div>
      </main>

      {/* Footer: One small line privacy notice */}
      <footer className="w-full text-center text-[11px] text-slate-500 border-t border-white/5 pt-4">
        InterviewIQ • Your data is private, encrypted, and never shared.
      </footer>
    </div>
  );
};

export default LandingPage;
