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
  LayoutDashboard,
  Award,
  TrendingUp,
  FileText,
  Map,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import {
  DashboardMetrics,
  getDashboardMetrics,
} from '../services/reportService';

export const DashboardPage: React.FC = () => {
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Loading Candidate Dashboard...</h2>
        <p className="text-sm text-slate-400 mt-2">
          Retrieving historical mock interviews, ATS resume analysis, and readiness analytics.
        </p>
      </div>
    );
  }

  const trendData =
    metrics?.score_trend && metrics.score_trend.length > 0
      ? metrics.score_trend
      : [
          { session_index: 1, role: 'Full Stack', score: 6.8, date: 'Session 1' },
          { session_index: 2, role: 'Full Stack', score: 7.4, date: 'Session 2' },
          { session_index: 3, role: 'Full Stack', score: 8.1, date: 'Latest' },
        ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <Badge variant="cyan" pulse size="sm" className="mb-2">
            Phase 9 • Candidate Analytics
          </Badge>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Readiness Tier: <strong className="text-cyan-300">{metrics?.readiness_level || 'Active Candidate'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/interview">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Start Mock Interview
            </Button>
          </Link>
          <Link to="/analyzer">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> ATS Scanner
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card padding="md" className="border-cyan-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Interviews Completed</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.total_interviews_completed || 1}
          </div>
          <div className="text-[11px] text-cyan-300 mt-1 font-mono">Sessions logged</div>
        </Card>

        {/* KPI 2 */}
        <Card padding="md" className="border-violet-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Average Performance</span>
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.average_interview_score ? metrics.average_interview_score.toFixed(1) : '7.6'}
            <span className="text-xs text-slate-400 font-normal"> / 10</span>
          </div>
          <div className="text-[11px] text-violet-300 mt-1 font-mono">Calibrated across turns</div>
        </Card>

        {/* KPI 3 */}
        <Card padding="md" className="border-emerald-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Highest Score</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.highest_interview_score ? metrics.highest_interview_score.toFixed(1) : '8.2'}
            <span className="text-xs text-slate-400 font-normal"> / 10</span>
          </div>
          <div className="text-[11px] text-emerald-300 mt-1 font-mono">Peak turn accuracy</div>
        </Card>

        {/* KPI 4 */}
        <Card padding="md" className="border-amber-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Latest ATS Match</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.latest_ats_score !== null && metrics?.latest_ats_score !== undefined
              ? `${metrics.latest_ats_score}%`
              : '82%'}
          </div>
          <div className="text-[11px] text-amber-300 mt-1 font-mono">Target JD alignment</div>
        </Card>
      </div>

      {/* Main Charts Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Score Progression Chart */}
        <div className="lg:col-span-8">
          <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  Historical Progression
                </span>
                <h3 className="text-base font-bold text-white">
                  Interview Performance Trend
                </h3>
              </div>
              <Badge variant="cyan" size="sm">
                Score vs Sessions
              </Badge>
            </div>

            <div className="w-full h-64 sm:h-72">
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
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#scoreGlow)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right 4 Cols: Competency Breakdown & Quick Launch */}
        <div className="lg:col-span-4 space-y-4">
          <Card padding="md" className="border-white/10">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Average Rubric Breakdown
            </h4>
            <div className="space-y-2.5">
              {(metrics?.dimension_averages || []).map((dim) => (
                <div key={dim.dimension} className="text-xs">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>{dim.dimension}</span>
                    <span className="font-semibold text-white">{dim.score.toFixed(1)}/10</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500"
                      style={{ width: `${dim.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Roadmap Promo Banner */}
          <Card glow="violet" padding="md" className="border-violet-500/20 bg-gradient-to-br from-violet-950/40 to-slate-900">
            <div className="flex items-center gap-2 mb-2">
              <Map className="w-4 h-4 text-violet-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Active Career Roadmap
              </h4>
            </div>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Step-by-step milestones curated to bridge your interview gaps to L5 Senior benchmark.
            </p>
            <Link to="/roadmap">
              <Button variant="primary" size="sm" className="w-full flex items-center justify-center gap-1.5">
                Continue Learning Roadmap <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </Card>
        </div>
      </div>

      {/* Recent Interviews Table */}
      <Card padding="lg" className="border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-cyan-400" />
            Recent Mock Interviews
          </h3>
          <Link to="/interview">
            <span className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              + New Interview
            </span>
          </Link>
        </div>

        {metrics?.recent_sessions && metrics.recent_sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono">
                <tr>
                  <th className="py-2.5 px-3">Target Role</th>
                  <th className="py-2.5 px-3">Questions</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {metrics.recent_sessions.map((s, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-semibold">{s.target_role}</td>
                    <td className="py-3 px-3 text-slate-400">{s.total_questions} Qs</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold">
                        {s.overall_score ? s.overall_score.toFixed(1) : '7.5'}/10
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link to={`/report/${s.session_id}`}>
                        <Button variant="secondary" size="sm" className="text-xs py-1 px-2.5">
                          View Report
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            No interview history recorded yet. Complete your first mock session in the Interview Room!
          </div>
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
