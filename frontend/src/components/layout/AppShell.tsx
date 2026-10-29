import React from 'react';
import Navbar from './Navbar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Floating Translucent Aurora Navbar */}
      <Navbar />

      {/* Main Content Stage */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-12">
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
