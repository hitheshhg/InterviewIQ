import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const isWidePage =
    location.pathname.startsWith('/resume') ||
    location.pathname.startsWith('/analyzer');

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Floating Translucent Aurora Navbar */}
      <Navbar />

      {/* Main Content Stage - Expanded for Resume Studio, Focused for others */}
      <main
        className={`flex-1 w-full mx-auto pb-12 transition-all duration-300 ${
          isWidePage
            ? 'max-w-[1850px] px-3 sm:px-6 lg:px-8'
            : 'max-w-6xl px-4 sm:px-6'
        }`}
      >
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="text-center py-4 border-t border-white/5 text-[11px] text-slate-500">
        InterviewIQ • Your data is private, encrypted, and never shared.
      </footer>
    </div>
  );
};

export default AppShell;
