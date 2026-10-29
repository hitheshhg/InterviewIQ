import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Award,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpen,
  Compass,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import {
  CanonicalResume,
  JobDescriptionInput,
  MultiJDCompareResponse,
} from '../../types/resumeStudio';
import { api } from '../../services/api';
import { generateRoadmapFromGaps } from '../../services/reportService';

interface MultiJDModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: CanonicalResume;
  onSelectForTailoring?: (role: string, company: string, text: string) => void;
}

const SAMPLE_JDS: JobDescriptionInput[] = [
  {
    id: 'jd-sample-1',
    title: 'Full Stack Engineer',
    company: 'Google',
    text: 'We are seeking a Full Stack Software Engineer proficient in React, TypeScript, Python, FastAPI, and PostgreSQL. Experience with microservices, Redis caching, and Docker containerization is required.',
  },
  {
    id: 'jd-sample-2',
    title: 'Cloud & DevOps Engineer',
    company: 'Amazon Web Services',
    text: 'Looking for a DevOps Engineer with deep hands-on expertise in Kubernetes, Terraform, AWS cloud infrastructure, Docker, CI/CD automation, and Linux server management.',
  },
  {
    id: 'jd-sample-3',
    title: 'Backend Platform Engineer',
    company: 'Stripe',
    text: 'Backend Software Engineer needed to scale payment APIs. Must have strong skills in Python, FastAPI, distributed databases (PostgreSQL, Redis), RESTful APIs, and async event processing.',
  },
];

export const MultiJDModal: React.FC<MultiJDModalProps> = ({
  isOpen,
  onClose,
  resume,
  onSelectForTailoring,
}) => {
  const [jds, setJds] = useState<JobDescriptionInput[]>([SAMPLE_JDS[0]]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<MultiJDCompareResponse | null>(null);

  if (!isOpen) return null;

  const handleAddJD = () => {
    if (jds.length >= 5) return;
    const newId = `jd-${Math.random().toString(36).substring(2, 8)}`;
    setJds([
      ...jds,
      {
        id: newId,
        title: `Role #${jds.length + 1}`,
        company: 'Company Name',
        text: '',
      },
    ]);
  };

  const handleRemoveJD = (id: string) => {
    if (jds.length <= 1) return;
    setJds(jds.filter((j) => j.id !== id));
  };

  const updateJD = (id: string, field: keyof JobDescriptionInput, value: string) => {
    setJds(jds.map((j) => (j.id === id ? { ...j, [field]: value } : j)));
  };

  const loadSampleJDs = () => {
    setJds(SAMPLE_JDS);
    setCompareResult(null);
    setErrorMsg(null);
  };

  const handleRunComparison = async () => {
    // Validate text lengths
    const invalid = jds.find((j) => !j.text || j.text.trim().length < 15);
    if (invalid) {
      setErrorMsg(`Please provide job requirements for "${invalid.title}" (minimum 15 characters).`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await api.post<MultiJDCompareResponse>(
        '/api/v1/resume-studio/compare-jds',
        {
          resume,
          job_descriptions: jds,
        }
      );
      setCompareResult(response.data);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || err.message || 'Failed to compare job descriptions.'
      );
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);

  const handleGenerateRoadmap = async () => {
    if (!compareResult || compareResult.common_gaps.length === 0) return;
    setGeneratingRoadmap(true);
    try {
      const targetRole = compareResult.rankings[0]?.title || 'Software Engineer';
      const roadmap = await generateRoadmapFromGaps(targetRole, compareResult.common_gaps);
      onClose();
      navigate('/roadmap', { state: { roadmap } });
    } catch (err: any) {
      console.error('Failed to generate roadmap from common gaps:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to generate roadmap from common gaps.');
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const CHART_COLORS = ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-5 sm:p-6 text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Multi-JD Comparison</h3>
              <p className="text-[11px] text-slate-400">
                Match your resume against up to 5 target roles simultaneously.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar my-4">
          {/* Top Actions: Load Samples & Add Role */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/60 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">
                Target Roles ({jds.length}/5)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadSampleJDs}
                className="text-xs text-cyan-400 flex items-center gap-1 py-0.5 px-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pre-fill 3 Sample Roles</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddJD}
              disabled={jds.length >= 5}
              className="text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Role</span>
            </Button>
          </div>

          {/* Job Description Inputs (Collapsible or compact cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {jds.map((jd, idx) => (
              <div
                key={jd.id}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 space-y-2 relative"
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                    Role #{idx + 1}
                  </span>
                  {jds.length > 1 && (
                    <button
                      onClick={() => handleRemoveJD(jd.id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Job Title"
                    value={jd.title}
                    onChange={(e) => updateJD(jd.id, 'title', e.target.value)}
                  />
                  <Input
                    placeholder="Company"
                    value={jd.company || ''}
                    onChange={(e) => updateJD(jd.id, 'company', e.target.value)}
                  />
                </div>

                <textarea
                  rows={3}
                  value={jd.text}
                  onChange={(e) => updateJD(jd.id, 'text', e.target.value)}
                  placeholder="Paste requirements text..."
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 leading-relaxed"
                />
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Run Button */}
          <div className="flex justify-center pt-1">
            <Button
              variant="primary"
              size="md"
              onClick={handleRunComparison}
              disabled={loading}
              className="px-6 flex items-center gap-2"
            >
              <BarChart3 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Analyzing Matches...' : 'Run Comparison'}</span>
            </Button>
          </div>

          {/* Results Stage */}
          {compareResult && (
            <div className="space-y-6 pt-4 border-t border-white/10 animate-fade-in">
              {/* 1. Rankings Highlights */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-cyan-400" />
                  <span>Match Rankings</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {compareResult.rankings.map((r, rankIdx) => {
                    const isBest = r.jd_id === compareResult.best_fit_jd_id;
                    return (
                      <div
                        key={r.jd_id}
                        className={`p-4 rounded-xl border relative transition-all ${
                          isBest
                            ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/30'
                            : 'bg-slate-950/60 border-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 block uppercase">
                              {r.company}
                            </span>
                            <h5 className="text-sm font-bold text-white mt-0.5">{r.title}</h5>
                          </div>
                          {isBest ? (
                            <Badge variant="cyan" size="sm">
                              #1 Best Fit
                            </Badge>
                          ) : (
                            <span className="text-xs font-mono text-slate-500 font-bold">
                              #{rankIdx + 1}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white font-mono">
                            {r.overall_score}
                          </span>
                          <span className="text-xs text-slate-400">/ 100 ATS</span>
                          <span className="text-xs font-semibold text-cyan-400 ml-auto">
                            {r.keyword_match_pct}% JD Match
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{r.verdict}</span>
                          <span>{r.matched_skills.length} skills matched</span>
                        </div>

                        {onSelectForTailoring && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const origJD = jds.find((j) => j.id === r.jd_id);
                              onSelectForTailoring(r.title, r.company, origJD?.text || '');
                            }}
                            className="w-full mt-2.5 text-[11px] py-1 flex items-center justify-center gap-1 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                          >
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span>Tailor Resume</span>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Common Gaps Alert Panel */}
              {compareResult.common_gaps.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                      <h5 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Common Skill Gaps ({compareResult.common_gaps.length})
                      </h5>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateRoadmap}
                      disabled={generatingRoadmap}
                      className="text-xs py-1 px-2.5 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-600 hover:to-cyan-600 text-white shadow-md shadow-amber-500/20"
                      title="Build milestone career roadmap for these missing skills"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>{generatingRoadmap ? 'Generating...' : 'Generate Roadmap'}</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    These skills are required across multiple target roles but missing from your profile.
                    Prioritize these in your preparation:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {compareResult.common_gaps.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded text-xs bg-amber-950/70 text-amber-300 border border-amber-500/30 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Skill Matrix Heatmap Table */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Cross-Role Skill Matrix
                </h4>
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-900/80">
                        <th className="p-3 text-slate-300 font-semibold sticky left-0 bg-slate-900 z-10 w-44">
                          Required Skill
                        </th>
                        {compareResult.rankings.map((r) => (
                          <th key={r.jd_id} className="p-3 text-slate-300 font-semibold min-w-[130px]">
                            <div className="truncate font-bold text-white">{r.company}</div>
                            <div className="text-[10px] text-slate-500 truncate">{r.title}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {compareResult.skill_matrix.map((row) => (
                        <tr key={row.skill} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-semibold text-slate-200 sticky left-0 bg-slate-950/90 z-10">
                            {row.skill}
                          </td>
                          {compareResult.rankings.map((r) => {
                            const status = row.cells[r.jd_id];
                            return (
                              <td key={r.jd_id} className="p-3">
                                {status === 'matched' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Matched</span>
                                  </span>
                                ) : status === 'partial' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Partial</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <XCircle className="w-3 h-3" />
                                    <span>Missing</span>
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Visual Comparison Bar Chart */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Factor Comparison Across Roles
                </h4>
                <div className="p-4 rounded-xl border border-white/10 bg-slate-950/70 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={compareResult.comparison_chart_data}
                      margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="dimension" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      {compareResult.rankings.map((r, i) => {
                        const key = `${r.company} (${r.title.slice(0, 12)})`;
                        return (
                          <Bar
                            key={key}
                            dataKey={key}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={[4, 4, 0, 0]}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
