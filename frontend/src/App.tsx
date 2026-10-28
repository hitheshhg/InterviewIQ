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
  Zap,
  Lock,
  Unlock,
  LogOut,
  User as UserIcon,
  Database
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { api } from './services/api';

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

const AppContent: React.FC = () => {
  const { currentUser, userProfile, logout, token } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Health state
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLatency, setHealthLatency] = useState<number | null>(null);

  // Auth verification test states
  const [authTestResult, setAuthTestResult] = useState<{
    type: 'success' | 'error';
    statusCode: number;
    message: string;
    data?: unknown;
  } | null>(null);
  const [testingAuth, setTestingAuth] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    const start = performance.now();
    try {
      const response = await fetch('http://localhost:8000/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: HealthData = await response.json();
      setHealthLatency(Math.round(performance.now() - start));
      setHealth(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setHealthError(err.message);
      } else {
        setHealthError('Failed to reach backend');
      }
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Test 1: Hit protected route WITHOUT token (Expect 401)
  const testUnauthorizedRequest = async () => {
    setTestingAuth(true);
    setAuthTestResult(null);
    try {
      // Direct raw fetch without Authorization header
      const res = await fetch('http://localhost:8000/api/v1/auth/protected-test');
      const data = await res.json();
      setAuthTestResult({
        type: res.status === 401 ? 'success' : 'error',
        statusCode: res.status,
        message: res.status === 401 
          ? 'Passed! Backend securely rejected unauthorized request with HTTP 401.' 
          : 'Unexpected status code received.',
        data,
      });
    } catch (err: unknown) {
      setAuthTestResult({
        type: 'error',
        statusCode: 0,
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setTestingAuth(false);
    }
  };

  // Test 2: Hit protected route WITH Firebase ID Token (Expect 200)
  const testAuthorizedRequest = async () => {
    if (!token) return;
    setTestingAuth(true);
    setAuthTestResult(null);
    try {
      const res = await api.get('/api/v1/auth/protected-test');
      setAuthTestResult({
        type: 'success',
        statusCode: res.status,
        message: 'Passed! Token verified by Firebase Admin & user synchronized with MongoDB Atlas.',
        data: res.data,
      });
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { detail?: string }; status?: number } });
      setAuthTestResult({
        type: 'error',
        statusCode: errorMsg.response?.status || 500,
        message: errorMsg.response?.data?.detail || 'Verification failed',
      });
    } finally {
      setTestingAuth(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0B0F19] text-slate-100 overflow-hidden">
      {/* Aurora Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-20 right-1/4 w-[30rem] h-[30rem] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-6xl mx-auto px-6 py-10 flex flex-col min-h-screen">
        
        {/* Navigation Bar */}
        <header className="flex items-center justify-between py-4 px-6 rounded-2xl glass-card mb-12 border border-white/10 shadow-glass">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-neon-cyan">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight aurora-gradient-text">InterviewIQ</span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                Phase 3 Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-5 h-5 rounded-full border border-cyan-500/40"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-slate-200 hidden md:inline">
                    {userProfile?.display_name || currentUser.displayName || currentUser.email}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-xs font-medium text-slate-300 hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white text-xs font-semibold transition shadow-neon-cyan"
              >
                <UserIcon className="w-3.5 h-3.5" />
                Sign In / Register
              </button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-cyan-300 mb-6 backdrop-blur-md">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            VTU Final-Year Major Project • Authenticated Architecture
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight sm:leading-snug">
            Next-Gen AI Interview &{' '}
            <span className="aurora-gradient-text">Resume Intelligence</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Engineered with high-fidelity voice mock interviews, hybrid deterministic ATS scoring, and cryptographic Firebase token authentication.
          </p>

          {/* Verification Widgets Grid */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl text-left">
            
            {/* Widget 1: System Health & MongoDB Atlas */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 shadow-glass flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Cloud Infrastructure Health</h3>
                      <p className="text-xs text-slate-400">FastAPI Backend & MongoDB Atlas</p>
                    </div>
                  </div>

                  <button
                    onClick={fetchHealth}
                    disabled={loadingHealth}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingHealth ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-sm">Querying backend...</span>
                  </div>
                ) : healthError ? (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{healthError}</span>
                  </div>
                ) : health ? (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-300">FastAPI Operational</span>
                      </div>
                      {healthLatency !== null && (
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                          {healthLatency}ms latency
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <span className="text-slate-400 block mb-0.5">Environment</span>
                        <span className="font-mono text-purple-300">{health.environment}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <span className="text-slate-400 block mb-0.5">MongoDB Atlas</span>
                        <span className="font-mono text-emerald-400 flex items-center gap-1.5">
                          <Database className="w-3 h-3 text-emerald-400" />
                          {typeof health.services.database === 'object'
                            ? `${health.services.database.status} (${health.services.database.latency_ms ?? 0}ms)`
                            : health.services.database}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Collections: users, resumes, sessions, answers, reports</span>
                <span className="font-mono text-emerald-400">Indexes Ready</span>
              </div>
            </div>

            {/* Widget 2: Firebase Auth & Token Security Barrier */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 shadow-glass flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Firebase Auth Verification</h3>
                      <p className="text-xs text-slate-400">Cryptographic JWT Token Barrier</p>
                    </div>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    currentUser 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {currentUser ? 'Signed In' : 'Unauthenticated'}
                  </span>
                </div>

                <div className="space-y-3">
                  {currentUser ? (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Candidate:</span>
                        <span className="font-medium text-white">{currentUser.displayName || 'Candidate'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Email:</span>
                        <span className="font-mono text-cyan-300">{currentUser.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Firebase UID:</span>
                        <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]">
                          {currentUser.uid}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">MongoDB Sync:</span>
                        <span className="font-mono text-emerald-400 font-semibold">Active & Indexed</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-400">
                      Sign in with Google or Email to generate a live Firebase ID token and test authenticated route authorization.
                    </div>
                  )}

                  {/* Verification Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={testUnauthorizedRequest}
                      disabled={testingAuth}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium transition disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Test Without Token (401)
                    </button>

                    <button
                      onClick={currentUser ? testAuthorizedRequest : () => setAuthModalOpen(true)}
                      disabled={testingAuth}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-medium transition disabled:opacity-50"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      {currentUser ? 'Test With Token (200)' : 'Sign In to Test (200)'}
                    </button>
                  </div>

                  {/* Result Box */}
                  {authTestResult && (
                    <div className={`p-3 rounded-xl text-xs border ${
                      authTestResult.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      <div className="flex items-center justify-between font-semibold mb-1">
                        <span>HTTP {authTestResult.statusCode} Response</span>
                        <span className="font-mono text-[10px] uppercase">{authTestResult.type}</span>
                      </div>
                      <div>{authTestResult.message}</div>
                      {Boolean(authTestResult.data) && (
                        <pre className="mt-2 p-2 rounded bg-black/40 text-[10px] font-mono text-slate-300 overflow-x-auto">
                          {JSON.stringify(authTestResult.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Security: RS256 Firebase Key Verification</span>
                <span className="font-mono text-cyan-400">Protected Routes Active</span>
              </div>
            </div>

          </div>

          {/* Module Roadmap Teasers */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left max-w-5xl">
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

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
