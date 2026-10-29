import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  Check,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Diff,
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  CanonicalResume,
  TailorResumeResponse,
  BulletDiffItem,
} from '../../types/resumeStudio';
import { api } from '../../services/api';

interface TailoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: CanonicalResume;
  jobDescription: string;
  targetRole?: string;
  targetCompany?: string;
  onApplyTailoring: (tailored: CanonicalResume, targetRole: string) => void;
}

export const TailoringModal: React.FC<TailoringModalProps> = ({
  isOpen,
  onClose,
  resume,
  jobDescription,
  targetRole = 'Software Engineer',
  targetCompany = 'Target Company',
  onApplyTailoring,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<TailorResumeResponse | null>(null);

  const fetchTailoring = async () => {
    if (!jobDescription || jobDescription.trim().length < 15) {
      setErrorMsg('Target job description is required (minimum 15 characters).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await api.post<TailorResumeResponse>(
        '/api/v1/resume-studio/tailor',
        {
          resume,
          job_description: jobDescription,
          target_role: targetRole,
          target_company: targetCompany,
        }
      );
      setTailorResult(response.data);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || err.message || 'Failed to tailor resume.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTailoring();
    }
  }, [isOpen, jobDescription, targetRole, targetCompany]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-5 sm:p-6 text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Truthful AI Tailoring</h3>
              <p className="text-[11px] text-slate-400">
                Customizing for {targetRole} ({targetCompany}).
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
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar my-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-mono">
                Front-loading keywords & tailoring executive summary...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
              <p>{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={fetchTailoring} className="text-xs">
                Retry
              </Button>
            </div>
          ) : tailorResult ? (
            <div className="space-y-4 animate-fade-in">
              {/* 1. Score Impact Projection Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/60 to-emerald-950/60 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Projected ATS Score
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl font-bold text-slate-400 font-mono">
                        {tailorResult.base_score}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        {tailorResult.projected_tailored_score}
                      </span>
                      <span className="text-xs font-semibold text-emerald-400 ml-1">
                        (+{tailorResult.score_delta} pts)
                      </span>
                    </div>
                  </div>
                </div>

                {tailorResult.unverified_claims_count > 0 ? (
                  <Badge variant="amber" size="sm">
                    {tailorResult.unverified_claims_count} Claim to Confirm
                  </Badge>
                ) : (
                  <Badge variant="emerald" size="sm">
                    100% Verifiable Evidence
                  </Badge>
                )}
              </div>

              {/* Truthful Evidence Alert if unverified claims present */}
              {tailorResult.unverified_claims_count > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Truthful AI Evidence Check:</span> One or more
                    suggested phrasing options contain newly introduced metrics or skills. Please
                    confirm they match your real-world accomplishments before accepting.
                  </div>
                </div>
              )}

              {/* 2. Structured Diff Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Diff className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Proposed Changes ({tailorResult.diff_items.length})</span>
                </h4>

                {tailorResult.diff_items.map((diff: BulletDiffItem) => (
                  <div
                    key={diff.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-white/5">
                      <span className="text-xs font-bold text-cyan-300">{diff.section}</span>
                      <Badge
                        variant={diff.change_type === 'modified' ? 'cyan' : 'emerald'}
                        size="sm"
                      >
                        {diff.change_type === 'modified' ? 'Tailored' : 'Reordered'}
                      </Badge>
                    </div>

                    {diff.change_type === 'modified' && (
                      <div className="space-y-1.5 text-xs">
                        <div className="p-2 rounded bg-rose-950/20 border border-rose-500/10 text-rose-300/80">
                          <span className="text-[10px] font-mono text-rose-400 block uppercase mb-0.5">
                            Original
                          </span>
                          <p>"{diff.original_text}"</p>
                        </div>
                        <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/10 text-emerald-200">
                          <span className="text-[10px] font-mono text-emerald-400 block uppercase mb-0.5">
                            Tailored Draft
                          </span>
                          <p>"{diff.tailored_text}"</p>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 pt-1">{diff.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTailoring}
            disabled={loading}
            className="text-xs flex items-center gap-1 text-slate-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={loading || !tailorResult}
              onClick={() => {
                if (tailorResult) {
                  onApplyTailoring(tailorResult.tailored_resume, targetRole);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Accept Tailored Resume</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
