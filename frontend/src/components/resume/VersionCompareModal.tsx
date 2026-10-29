import React, { useState, useEffect } from 'react';
import { VersionComparisonResponse } from '../../types/resumeStudio';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  X,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Loader2,
  FileText,
  Code,
  Briefcase,
  AlertCircle,
} from 'lucide-react';


interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionId1: string;
  versionId2: string;
}

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  isOpen,
  onClose,
  versionId1,
  versionId2,
}) => {
  const [data, setData] = useState<VersionComparisonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'skills' | 'summary' | 'experience'>('skills');

  useEffect(() => {
    if (isOpen && versionId1 && versionId2) {
      const fetchComparison = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await api.post<VersionComparisonResponse>(
            '/api/v1/resume-studio/compare-versions',
            {
              version_id_1: versionId1,
              version_id_2: versionId2,
            }
          );
          setData(res.data);
        } catch (err: any) {
          console.error('Error fetching version comparison:', err);
          setError(err?.response?.data?.detail || 'Failed to compare versions.');
        } finally {
          setLoading(false);
        }
      };
      fetchComparison();
    }
  }, [isOpen, versionId1, versionId2]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Version Comparison</h2>
              <p className="text-xs text-slate-400">Inspect score changes and content diffs.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
              Computing comparison diff...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400 text-xs flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <p>{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Head-to-Head Score Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-950/50 p-4 rounded-xl border border-white/5">
                {/* Version 1 */}
                <div className="text-center md:text-left space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Source Version
                  </span>
                  <h4 className="text-sm font-bold text-white truncate">{data.version_1.label}</h4>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-xs">
                    <span className="font-mono text-cyan-400 font-bold">
                      {Math.round(data.version_1.ats_score)}% ATS
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{data.version_1.word_count} words</span>
                  </div>
                </div>

                {/* Score Delta Badge */}
                <div className="flex flex-col items-center justify-center py-2 md:py-0 border-y md:border-y-0 md:border-x border-white/5">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      data.score_delta >= 0
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {data.score_delta >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {data.score_delta >= 0 ? `+${data.score_delta}%` : `${data.score_delta}%`}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 font-mono">
                    {data.word_count_delta >= 0 ? `+${data.word_count_delta}` : data.word_count_delta}{' '}
                    words
                  </span>
                </div>

                {/* Version 2 */}
                <div className="text-center md:text-right space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Target Version
                  </span>
                  <h4 className="text-sm font-bold text-white truncate">{data.version_2.label}</h4>
                  <div className="flex items-center justify-center md:justify-end gap-2 text-xs">
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.round(data.version_2.ats_score)}% ATS
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{data.version_2.word_count} words</span>
                  </div>
                </div>
              </div>

              {/* Verdict Callout */}
              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200">
                <span className="font-bold text-cyan-300">Analysis: </span>
                {data.verdict}
              </div>

              {/* Section Tabs */}
              <div className="flex border-b border-white/10 gap-2">
                <button
                  onClick={() => setActiveTab('skills')}
                  className={`pb-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'skills'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  Skills ({data.skills_diff.added.length} added)
                </button>

                <button
                  onClick={() => setActiveTab('summary')}
                  className={`pb-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'summary'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Summary ({data.summary_diff.changed ? 'Changed' : 'Same'})
                </button>

                <button
                  onClick={() => setActiveTab('experience')}
                  className={`pb-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'experience'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Experience ({data.experience_diff.items.length} roles)
                </button>
              </div>

              {/* Tab 1: Skills Diff */}
              {activeTab === 'skills' && (
                <div className="space-y-4">
                  {data.skills_diff.added.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Skills Added in {data.version_2.label} ({data.skills_diff.added.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {data.skills_diff.added.map((s) => (
                          <span
                            key={s}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                          >
                            + {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.skills_diff.removed.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        Skills Omitted / Not In {data.version_2.label} ({data.skills_diff.removed.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {data.skills_diff.removed.map((s) => (
                          <span
                            key={s}
                            className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-white/10 text-slate-400 text-xs line-through"
                          >
                            - {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Shared Skills ({data.skills_diff.common.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.skills_diff.common.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-slate-300 text-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Summary Diff */}
              {activeTab === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-white">{data.version_1.label}</span>
                      <span className="font-mono">{data.summary_diff.v1_words} words</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {data.summary_diff.version_1_summary || 'No summary text.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs text-cyan-300">
                      <span className="font-semibold text-white">{data.version_2.label}</span>
                      <span className="font-mono">{data.summary_diff.v2_words} words</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {data.summary_diff.version_2_summary || 'No summary text.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: Experience Diff */}
              {activeTab === 'experience' && (
                <div className="space-y-3">
                  {data.experience_diff.items.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white">{exp.role}</h4>
                          <span className="text-[11px] text-slate-400">{exp.company}</span>
                        </div>
                        <Badge
                          variant={
                            exp.status === 'new_entry'
                              ? 'emerald'
                              : exp.status === 'modified'
                              ? 'cyan'
                              : 'slate'
                          }
                          className="text-[10px] capitalize"
                        >
                          {exp.status.replace('_', ' ')}
                        </Badge>

                      </div>

                      {exp.bullets_added.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase">
                            Added Bullets:
                          </span>
                          {exp.bullets_added.map((b, i) => (
                            <div
                              key={i}
                              className="text-xs text-emerald-300 bg-emerald-500/10 p-2 rounded border border-emerald-500/20"
                            >
                              + {b}
                            </div>
                          ))}
                        </div>
                      )}

                      {exp.bullets_removed.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <span className="text-[10px] font-mono text-rose-400 uppercase">
                            Removed Bullets:
                          </span>
                          {exp.bullets_removed.map((b, i) => (
                            <div
                              key={i}
                              className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded border border-white/5 line-through"
                            >
                              - {b}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
