import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  Map,
  Printer,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  ArrowRight,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ScoreGauge from '../components/ui/ScoreGauge';
import {
  InterviewReport,
  getReportBySession,
  getLatestReport,
} from '../services/reportService';

export const InterviewReportPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>();

  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: InterviewReport;
        if (sessionId) {
          data = await getReportBySession(sessionId);
        } else {
          data = await getLatestReport();
        }
        setReport(data);
      } catch (err: any) {
        console.warn('Could not load specific report, attempting latest fallback:', err);
        try {
          const fallbackData = await getLatestReport();
          setReport(fallbackData);
        } catch (e) {
          setError(
            'No interview performance report found. Complete a mock interview in the Interview Room first.'
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [sessionId]);

  const handlePrint = () => {
    window.print();
  };

  const toggleQuestion = (index: number) => {
    setExpandedQuestion(expandedQuestion === index ? null : index);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Synthesizing Evaluation Report...</h2>
        <p className="text-sm text-slate-400 mt-2">
          Aggregating 5-dimension rubric scores, benchmark comparisons, and personalized career roadmaps.
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Card glow="cyan" padding="lg" className="border-cyan-500/20">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <Badge variant="cyan" pulse className="mb-3">
            Phase 9 • Performance Analytics
          </Badge>
          <h2 className="text-2xl font-bold text-white mb-2">No Report Found</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            {error || 'You have not completed any mock interviews yet. Take an interview session to generate your comprehensive 5-dimension report.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/interview">
              <Button variant="primary" size="md">
                Launch Mock Interview
              </Button>
            </Link>
            <Link to="/analyzer">
              <Button variant="secondary" size="md">
                Scan Resume (ATS)
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Format data for Recharts Radar Chart
  const radarData = report.dimension_scores.map((dim) => ({
    subject: dim.dimension,
    Candidate: dim.score,
    Benchmark: dim.benchmark,
    fullMark: 10,
  }));

  const getVerdictBadgeVariant = (verdict: string) => {
    switch (verdict) {
      case 'Strong Hire':
        return 'emerald';
      case 'Hire':
        return 'cyan';
      case 'Leaning Hire':
        return 'amber';
      default:
        return 'rose';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:m-0">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="cyan" pulse size="sm">
              Phase 9 • Evaluation Analytics
            </Badge>
            <span className="text-xs text-slate-400">
              Session ID: {report.session_id.slice(0, 8)}...
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Interview Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Deep-Dive Report</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Target Role: <strong className="text-cyan-300">{report.target_role}</strong> • Generated on {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/roadmap">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5">
              <Map className="w-4 h-4" /> View Career Roadmap
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Section 1: Executive Summary & Scorecard Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Gauge & Verdict */}
        <div className="lg:col-span-5">
          <Card glow="cyan" padding="lg" className="h-full flex flex-col justify-between border-cyan-500/20 bg-slate-900/60">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  Overall Evaluation
                </span>
                <Badge variant={getVerdictBadgeVariant(report.verdict) as any} size="md">
                  {report.verdict.toUpperCase()}
                </Badge>
              </div>

              <div className="my-6 flex justify-center">
                <ScoreGauge
                  score={Math.round(report.overall_score * 10)}
                  size={170}
                  strokeWidth={14}
                  label="Calibrated Score"
                  sublabel={`${report.overall_score.toFixed(1)} / 10`}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 leading-relaxed">
              <strong className="text-white block mb-1">Executive Summary:</strong>
              {report.executive_summary}
            </div>
          </Card>
        </div>

        {/* Right 7 Cols: 5-Dimension Radar Chart */}
        <div className="lg:col-span-7">
          <Card glow="violet" padding="lg" className="h-full border-violet-500/20 bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-mono text-violet-400 uppercase tracking-wider">
                  Multi-Metric Rubric
                </span>
                <h3 className="text-base font-bold text-white">
                  5-Dimension Performance Radar
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="text-slate-300">Candidate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-violet-400/50 border border-violet-400" />
                  <span className="text-slate-400">L5 Benchmark</span>
                </div>
              </div>
            </div>

            {/* Radar Canvas */}
            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 10]}
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  <Radar
                    name="Candidate"
                    dataKey="Candidate"
                    stroke="#06b6d4"
                    fill="#06b6d4"
                    fillOpacity={0.45}
                  />
                  <Radar
                    name="Benchmark"
                    dataKey="Benchmark"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.15}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* Section 2: Dimension Scorecard & Strengths / Improvements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Dimension Table */}
        <div className="lg:col-span-6">
          <Card padding="lg" className="h-full border-white/10">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              Dimension Scorecard vs Senior L5 Benchmark
            </h3>

            <div className="space-y-4">
              {report.dimension_scores.map((dim) => {
                const isAboveBenchmark = dim.score >= dim.benchmark;
                return (
                  <div key={dim.dimension} className="text-xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-slate-200">{dim.dimension}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{dim.score.toFixed(1)}/10</span>
                        <span className="text-[10px] text-slate-500">
                          (target: {dim.benchmark.toFixed(1)})
                        </span>
                        {isAboveBenchmark ? (
                          <span className="text-[10px] text-emerald-400 font-semibold">✓ Meets</span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-semibold">↑ Gap</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden flex">
                      <div
                        className={`h-full ${
                          dim.score >= 8 ? 'bg-emerald-500' : dim.score >= 6.5 ? 'bg-cyan-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${dim.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right 6 Cols: Strengths & Growth Areas */}
        <div className="lg:col-span-6 space-y-4">
          <Card padding="md" className="border-emerald-500/20 bg-emerald-950/10">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4" /> Top Observed Strengths
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {report.top_strengths.map((str, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card padding="md" className="border-amber-500/20 bg-amber-950/10">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4" /> Critical Areas for Growth
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {report.priority_improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Quick link to Roadmap */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-violet-950/30 to-slate-900 border border-cyan-500/20 flex items-center justify-between">
            <div className="text-xs">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Personalized Roadmap Ready
              </div>
              <div className="text-slate-400 mt-0.5">
                Targeted milestones generated to bridge your {report.priority_improvements[0] || 'technical'} gap.
              </div>
            </div>
            <Link to="/roadmap">
              <Button variant="primary" size="sm" className="flex items-center gap-1">
                Roadmap <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Section 3: Question-by-Question Deep Dive Breakdown */}
      <Card padding="lg" className="border-white/10">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-cyan-400" />
          Turn-by-Turn Questions & Ideal Answer Analysis
        </h3>

        <div className="space-y-3">
          {report.questions_breakdown.map((turn, idx) => {
            const isExpanded = expandedQuestion === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all"
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleQuestion(idx)}
                  className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center font-mono">
                      Q{turn.question_index}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 line-clamp-1">
                        "{turn.question_text}"
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {turn.question_category.replace('_', ' ')} • {turn.difficulty}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold text-xs">
                      {turn.average_score.toFixed(1)}/10
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Accordion Body */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 pt-0 border-t border-white/5 space-y-3 text-xs"
                  >
                    {/* Candidate Answer */}
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                      <strong className="text-slate-400 block mb-1">Your Submitted Response:</strong>
                      <p className="text-slate-200 leading-relaxed font-sans">
                        "{turn.candidate_answer}"
                      </p>
                    </div>

                    {/* Evaluator Feedback */}
                    <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-slate-300">
                      <strong className="text-cyan-300 block mb-1">Evaluator Feedback:</strong>
                      {turn.feedback}
                    </div>

                    {/* Target L5 Senior Ideal Answer */}
                    <div className="p-3 rounded-lg bg-violet-950/20 border border-violet-500/20 text-slate-300">
                      <strong className="text-violet-300 block mb-1">Senior Standard Benchmark:</strong>
                      <p className="italic text-slate-400">"{turn.ideal_answer_summary}"</p>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default InterviewReportPage;

