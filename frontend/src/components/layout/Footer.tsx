import React from 'react';
import { Sparkles, Shield, Cpu, Database, Flame, ExternalLink, GraduationCap, Github } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-24 border-t border-white/10 bg-[#070A11] text-slate-400 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand & Academic Context */}
          <div className="md:col-span-2 space-y-3 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">InterviewIQ</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                VTU Major Project
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              An intelligent, voice-driven AI interview simulation and deterministic ATS resume analysis platform built for final-year B.E. Computer Science evaluation.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
              <GraduationCap className="w-4 h-4 text-cyan-400" />
              <span>Visvesvaraya Technological University (VTU)</span>
            </div>
          </div>

          {/* Col 2: Architectural Specs */}
          <div className="space-y-2.5 text-left">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Engineered With</h4>
            <ul className="text-xs space-y-1.5 text-slate-400 font-mono">
              <li className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>FastAPI + Python 3.12</span>
              </li>
              <li className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>MongoDB Atlas (Motor Async)</span>
              </li>
              <li className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Firebase Authentication</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Google Gemini 2.5 Flash</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Quick Links & Viva Resources */}
          <div className="space-y-2.5 text-left">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Resources</h4>
            <ul className="text-xs space-y-1.5 text-slate-400">
              <li>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition flex items-center gap-1.5"
                >
                  <span>Interactive API Swagger</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:8000/health"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition flex items-center gap-1.5"
                >
                  <span>System Diagnostics (/health)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hitheshhg"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition flex items-center gap-1.5"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Profile</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Privacy Notice Banner as required by Master Prompt */}
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400 flex items-start gap-2.5 text-left mb-8">
          <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300">Privacy Notice for Demo Testing: </span>
            This evaluation build uses Google AI Studio free-tier endpoints. To preserve confidentiality, test with dummy or anonymized resumes during presentations.
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 InterviewIQ • Built by Shreya for VTU Major Project Evaluation</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Aurora Glassmorphism Design System</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">100% Type Safe</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
