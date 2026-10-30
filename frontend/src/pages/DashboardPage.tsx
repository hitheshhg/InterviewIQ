import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Award,
  TrendingUp,
  FileText,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import InfoTooltip from '../components/common/InfoTooltip';
import { useAuth } from '../context/AuthContext';
import {
  DashboardMetrics,
  getDashboardMetrics,
} from '../services/reportService';

export const DashboardPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await getDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const firstName = (
    currentUser?.displayName ||
    userProfile?.display_name ||
    'Candidate'
  ).split(' ')[0];

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          Loading metrics...
        </p>
      </div>
    );
  }

  const hasSessions = (metrics?.total_interviews_completed ?? 0) > 0;
  const trendData = metrics?.score_trend || [];
  const recentSessions = (metrics?.recent_sessions || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner: Greeting + Primary Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, <span className="text-cyan-400">{firstName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track your interview readiness and performance metrics.
          </p>
        </div>

        <Link to="/interview">
          <Button variant="primary" size="md" className="flex items-center gap-2">
            <Zap className="w-4 h-4" /> Start interview
          </Button>
        </Link>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sessions taken */}
        <Card padding="md" className="border-cyan-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              Sessions taken
              <InfoTooltip text="Total mock interview sessions completed." />
            </span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.total_interviews_completed ?? 0}
          </div>
        </Card>

        {/* KPI 2: Average score */}
        <Card padding="md" className="border-violet-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              Average score
              <InfoTooltip text="Aggregated performance score out of 10." />
            </span>
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.average_interview_score ? metrics.average_interview_score.toFixed(1) : '-'}
            <span className="text-xs text-slate-400 font-normal"> / 10</span>
          </div>
        </Card>

        {/* KPI 3: Best score */}
        <Card padding="md" className="border-emerald-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              Best score
              <InfoTooltip text="Highest recorded mock interview score." />
            </span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.highest_interview_score ? metrics.highest_interview_score.toFixed(1) : '-'}
            <span className="text-xs text-slate-400 font-normal"> / 10</span>
          </div>
        </Card>

        {/* KPI 4: Latest ATS score */}
        <Link to="/analyzer" className="block">
          <Card padding="md" className="border-amber-500/20 bg-slate-900/60 hover:border-amber-500/40 transition-colors h-full">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                Latest ATS
                <InfoTooltip text="Most recent resume match score. Click to improve." />
              </span>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics?.latest_ats_score !== null && metrics?.latest_ats_score !== undefined
                ? `${metrics.latest_ats_score}%`
                : '-'}
            </div>
          </Card>
        </Link>
      </div>

      {/* Conditional Rendering: Empty State for New Users vs Full Analytics */}
      {!hasSessions ? (
        /* Empty state for new users: one friendly card with one button, no blank charts */
        <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60 text-center py-12">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Ready for your first interview?</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6">
            Practice realistic voice roleplay questions and receive instant AI feedback.
          </p>
          <Link to="/interview">
            <Button variant="primary" size="md">
              Start interview
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Score Trend Chart */}
          {trendData.length > 0 && (
            <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">Score progression</h2>
                <span className="text-[11px] font-mono text-cyan-400">Score vs Sessions</span>
              </div>

              <div className="w-full h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      stroke="#475569"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      stroke="#475569"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#scoreGlow)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Resume Score Evolution Across Versions */}
          {metrics?.resume_version_trend && metrics.resume_version_trend.length > 0 && (
            <Card glow="cyan" padding="lg" className="border-emerald-500/20 bg-slate-900/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white">Resume score evolution</h2>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">ATS Score vs Versions</span>
              </div>

              <div className="w-full h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.resume_version_trend}>
                    <defs>
                      <linearGradient id="resumeGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      stroke="#475569"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#475569"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`${val}%`, 'ATS Score']}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#resumeGlow)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Recent Sessions (max 5) */}
          <Card padding="md" className="border-white/10 bg-slate-900/60">
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-sm font-bold text-white">Recent sessions</h2>
              <Link to="/interview" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
                New interview
              </Link>
            </div>

            <div className="divide-y divide-white/5 text-xs">
              {recentSessions.map((s, idx) => (
                <div
                  key={idx}
                  className="py-3 px-2 flex items-center justify-between hover:bg-white/[0.02] rounded-lg transition-colors"
                >
                  <div>
                    <p className="font-semibold text-white">{s.target_role}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {s.total_questions} questions • {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold">
                      {s.overall_score ? s.overall_score.toFixed(1) : '7.5'}/10
                    </span>
                    <Link to={`/report/${s.session_id}`}>
                      <Button variant="secondary" size="sm" className="text-xs py-1 px-2.5">
                        View report
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
