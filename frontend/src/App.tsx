import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Server, 
  FileText, 
  Mic, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface HealthData {
  status: string;
  app_name: string;
  version: string;
  environment: string;
  timestamp: string;
  services: {
    api: string;
    database: {
      status: string;
      latency_ms: number | null;
      error?: string;
    } | string;
    gemini: string;
  };
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const response = await fetch('http://localhost:8000/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: HealthData = await response.json();
      setLatency(Math.round(performance.now() - start));
      setHealth(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to reach backend');
      }
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="relative min-h-screen bg-[#0B0F19] text-slate-100 overflow-hidden">
      {/* Aurora Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-20 right-1/4 w-[30rem] h-[30rem] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-6xl mx-auto px-6 py-12 flex flex-col min-h-screen">
        
        {/* Navigation Bar */}
        <header className="flex items-center justify-between py-4 px-6 rounded-2xl glass-card mb-12 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-neon-cyan">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight aurora-gradient-text">InterviewIQ</span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                Phase 2 Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              TypeScript + Vite
            </span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-cyan-300 mb-6 backdrop-blur-md">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            VTU Final-Year Major Project Skeleton Initialized
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight sm:leading-snug">
            Next-Gen AI Interview &{' '}
            <span className="aurora-gradient-text">Resume Intelligence</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Engineered with high-fidelity voice-driven mock interviews, hybrid deterministic ATS scoring, and dynamic career roadmaps.
          </p>

          {/* Verification Widget: Backend Health Status */}
          <div className="mt-10 w-full max-w-2xl glass-card rounded-2xl p-6 border border-white/10 shadow-glass text-left">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Backend Health Verification</h3>
                  <p className="text-xs text-slate-400">Connecting React frontend to FastAPI /health endpoint</p>
                </div>
              </div>

              <button
                onClick={fetchHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Re-check
              </button>
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-sm">Connecting to backend at port 8000...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Connection Failed</div>
                  <div className="text-xs text-rose-400/80 mt-1">{error}</div>
                  <div className="text-xs text-slate-400 mt-2">
                    Ensure the FastAPI backend is running via <code className="bg-black/30 px-1 py-0.5 rounded text-white font-mono">uvicorn app.main:app --port 8000</code>.
                  </div>
                </div>
              </div>
            ) : health ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-300">FastAPI Backend Operational</span>
                  </div>
                  {latency !== null && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                      {latency}ms latency
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block mb-0.5">App Name</span>
                    <span className="font-medium text-white">{health.app_name}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block mb-0.5">Environment</span>
                    <span className="font-mono text-purple-300">{health.environment}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block mb-0.5">API Status</span>
                    <span className="font-mono text-emerald-300 capitalize">{health.services.api}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block mb-0.5">MongoDB Atlas</span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {typeof health.services.database === 'object'
                        ? `${health.services.database.status} (${health.services.database.latency_ms ?? 0}ms)`
                        : health.services.database}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Module Roadmap Teasers */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
            <div className="glass-card glass-card-hover rounded-2xl p-5">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-500/20">
                <FileText className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-white text-sm">Deterministic ATS Engine</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Hybrid keyword density, quantified metrics, and action verbs evaluation with semantic gap analysis.
              </p>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-5">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3 border border-violet-500/20">
                <Mic className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-white text-sm">Voice AI Interview Room</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Gemini-powered real-time WebSocket interview room with audio waveforms, live timer, and adaptive difficulty.
              </p>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-5">
              <div className="w-9 h-9 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center mb-3 border border-pink-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-white text-sm">5-Metric Radar & Roadmap</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Granular scoring across Clarity, Technical Depth, and Confidence paired with a structured recovery path.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>InterviewIQ Project • B.E. Major Project (VTU)</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="http://localhost:8000/docs" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-cyan-400 transition flex items-center gap-1"
            >
              Interactive API Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;

