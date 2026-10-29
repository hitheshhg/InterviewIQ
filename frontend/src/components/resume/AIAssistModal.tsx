import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Scissors,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { AIAssistOption, AIAssistAction, AIAssistResponse } from '../../types/resumeStudio';
import { api } from '../../services/api';

interface AIAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  contextRole?: string;
  contextCompany?: string;
  candidateSkills?: string[];
  onAccept: (rewrittenText: string) => void;
}

export const AIAssistModal: React.FC<AIAssistModalProps> = ({
  isOpen,
  onClose,
  originalText,
  contextRole,
  contextCompany,
  candidateSkills = [],
  onAccept,
}) => {
  const [activeAction, setActiveAction] = useState<AIAssistAction>('improve');
  const [loading, setLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<AIAssistOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAssistance = async (action: AIAssistAction) => {
    if (!originalText || originalText.trim().length < 3) return;
    setLoading(true);
    setErrorMsg(null);
    setSelectedIndex(0);

    try {
      const response = await api.post<AIAssistResponse>('/api/v1/resume-studio/assist', {
        text: originalText,
        action,
        context_role: contextRole,
        context_company: contextCompany,
        candidate_skills: candidateSkills,
      });

      setOptions(response.data.options || []);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to generate assistance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAssistance(activeAction);
    }
  }, [isOpen, activeAction]);

  if (!isOpen) return null;

  const currentOption = options[selectedIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-5 sm:p-6 text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Truthful AI Assist</h3>
              <p className="text-[11px] text-slate-400">
                Enhance clarity & impact with verifiable evidence check.
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

        {/* Action Tabs */}
        <div className="grid grid-cols-3 gap-2 my-4">
          <button
            onClick={() => setActiveAction('improve')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
              activeAction === 'improve'
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Improve</span>
          </button>
          <button
            onClick={() => setActiveAction('add_impact')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
              activeAction === 'add_impact'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Add Impact</span>
          </button>
          <button
            onClick={() => setActiveAction('shorten')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
              activeAction === 'shorten'
                ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Shorten</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* Original Text Box */}
          <div className="p-3 bg-slate-950/70 border border-white/10 rounded-lg">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
              Original Phrasing
            </span>
            <p className="text-xs text-slate-300 italic">"{originalText}"</p>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-mono">Generating ATS-optimized variations...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
              {errorMsg}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Option Selector Cards */}
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedIndex === idx
                        ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {opt.diff_summary}
                        </span>
                      </div>
                      {opt.has_new_claims ? (
                        <Badge variant="amber" size="sm">
                          Confirm Claims
                        </Badge>
                      ) : (
                        <Badge variant="emerald" size="sm">
                          Verified Truthful
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-200 mt-2 font-medium leading-relaxed pl-7">
                      "{opt.text}"
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1.5 pl-7">
                      {opt.explanation}
                    </p>

                    {/* Evidence Check Warning Banner if unverified claims present */}
                    {opt.has_new_claims && (
                      <div className="mt-2.5 ml-7 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-amber-300">
                          <span className="font-semibold">Evidence check required:</span> Contains unverified token(s):{' '}
                          <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200 font-mono">
                            {opt.unverified_tokens.join(', ')}
                          </code>
                          . Confirm this accurately reflects your actual achievements before accepting.
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAssistance(activeAction)}
            disabled={loading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={loading || !currentOption}
              onClick={() => {
                if (currentOption) {
                  onAccept(currentOption.text);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Accept Rewrite</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
