import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Target,
} from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import ScoreGauge from '../ui/ScoreGauge';
import Button from '../ui/Button';
import InfoTooltip from '../common/InfoTooltip';
import { ATSScoreResponse } from '../../types/resumeStudio';

interface ATSScorePanelProps {
  scoreData: ATSScoreResponse | null;
  loading?: boolean;
  onOpenTailor?: () => void;
  onPracticeWeakSpots?: () => void;
  isPracticing?: boolean;
}

export const ATSScorePanel: React.FC<ATSScorePanelProps> = ({
  scoreData,
  loading,
  onOpenTailor,
  onPracticeWeakSpots,
  isPracticing,
}) => {
  const [whyScoreOpen, setWhyScoreOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'skills' | 'weak_lines'>('skills');

  if (loading) {
    return (
      <Card padding="sm" className="border-cyan-500/20 bg-slate-900/60 text-center py-8">
        <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          Calculating ATS score...
        </p>
      </Card>
    );
  }

  if (!scoreData) {
    return (
      <Card padding="sm" className="border-white/5 bg-slate-900/60 text-center py-8">
        <Target className="w-7 h-7 text-slate-500 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-white">ATS Scoring Ready</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Start typing or paste a job description to calculate your live compatibility score.
        </p>
      </Card>
    );
  }

  const { overall_score, is_tailored, summary_verdict, breakdown, matched_skills, partial_skills, missing_skills, weak_lines, top_action_items } = scoreData;

  const sections = [
    { key: 'match', item: breakdown.keyword_semantic_match, show: is_tailored },
    { key: 'comp', item: breakdown.section_completeness, show: true },
    { key: 'quant', item: breakdown.quantified_achievements, show: true },
    { key: 'verbs', item: breakdown.action_verbs_quality, show: true },
    { key: 'fmt', item: breakdown.formatting_parseability, show: true },
  ].filter((s) => s.show);

  return (
    <div className="space-y-3">
      {/* Top Main Score Card */}
      <Card glow="cyan" padding="sm" className="border-cyan-500/20 bg-slate-900/70 relative">
        <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">ATS Score</span>
          </div>
          <Badge variant={is_tailored ? 'cyan' : 'violet'} size="sm">
            {is_tailored ? 'Job-Tailored' : 'General ATS'}
          </Badge>
        </div>

        {/* Circular Gauge */}
        <div className="flex flex-col items-center justify-center py-1">
          <ScoreGauge score={overall_score} size={130} strokeWidth={11} label={summary_verdict} />
          <p className="text-[11px] text-slate-400 mt-1.5 text-center">
            {is_tailored
              ? '40% JD Match • 60% Content & Formatting'
              : 'Redistributed: 25% Completeness, Metrics, Verbs, Format'}
          </p>

          {/* One-Click Tailor Button if tailored against a JD */}
          {is_tailored && onOpenTailor && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenTailor}
              className="mt-2.5 text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailor to this JD</span>
            </Button>
          )}
        </div>

        {/* Section Progress Bars */}
        <div className="mt-3 space-y-2 pt-2.5 border-t border-white/10">
          {sections.map(({ key, item }) => (
            <div key={key} className="text-xs">
              <div className="flex justify-between items-center text-slate-300 mb-1">
                <span className="flex items-center gap-1 text-[11px]">
                  {item.name}
                  {item.tips.length > 0 && <InfoTooltip text={item.tips[0]} />}
                </span>
                <span className="font-mono text-[11px] text-white">
                  {item.points_earned.toFixed(1)} / {item.max_points.toFixed(0)} pts
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    item.score_percentage >= 75
                      ? 'bg-emerald-400'
                      : item.score_percentage >= 50
                      ? 'bg-cyan-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${item.score_percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* "Why This Score" Collapsible Drawer */}
        <div className="mt-3 pt-2 border-t border-white/10">
          <button
            onClick={() => setWhyScoreOpen(!whyScoreOpen)}
            className="w-full flex items-center justify-between text-xs text-cyan-400 hover:text-cyan-300 font-medium py-0.5 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Why this score?
            </span>
            {whyScoreOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence>
            {whyScoreOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 space-y-1.5 text-[11px] text-slate-300 overflow-hidden"
              >
                {sections.map(({ key, item }) => (
                  <div key={key} className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5 flex justify-between">
                    <span>{item.name}</span>
                    <span className="font-mono text-cyan-300">
                      {item.score_percentage.toFixed(0)}% ({item.points_earned.toFixed(1)} pts)
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Top 3 Prioritized Action Items */}
      {top_action_items.length > 0 && (
        <Card padding="sm" className="border-amber-500/20 bg-slate-900/60">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1.5">
            <Zap className="w-3.5 h-3.5" /> Top Action Items
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {top_action_items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5 leading-snug">
                <span className="text-amber-400 font-mono font-bold">{idx + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Tabs for Skill Matching & Weak-Line Diagnostics */}
      <Card padding="sm" className="border-white/5 bg-slate-900/60">
        <div className="flex items-center gap-2 pb-2 border-b border-white/10 mb-2.5">
          <button
            onClick={() => setActiveTab('skills')}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
              activeTab === 'skills'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Skills ({matched_skills.length + partial_skills.length + missing_skills.length})
          </button>
          <button
            onClick={() => setActiveTab('weak_lines')}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
              activeTab === 'weak_lines'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Weak Lines ({weak_lines.length})
          </button>
        </div>

        {/* Tab 1: Skill Match Chips */}
        {activeTab === 'skills' && (
          <div className="space-y-2.5">
            {matched_skills.length === 0 && partial_skills.length === 0 && missing_skills.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-2">
                Paste a Job Description to see matched and missing skills.
              </p>
            ) : (
              <>
                {matched_skills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-400 flex items-center gap-1 mb-1">
                      <CheckCircle2 className="w-3 h-3" /> Matched ({matched_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matched_skills.map((m, i) => (
                        <span
                          key={i}
                          title={m.resume_evidence_line}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 cursor-help"
                        >
                          {m.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {partial_skills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-amber-400 flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3" /> Related ({partial_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {partial_skills.map((p, i) => (
                        <span
                          key={i}
                          title={p.resume_evidence_line}
                          className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 cursor-help"
                        >
                          {p.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {missing_skills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-rose-400 flex items-center gap-1 mb-1">
                      <XCircle className="w-3 h-3" /> Missing ({missing_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {missing_skills.map((ms, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300"
                        >
                          {ms.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Weak-Line Diagnostics */}
        {activeTab === 'weak_lines' && (
          <div className="space-y-2">
            {weak_lines.length === 0 ? (
              <p className="text-[11px] text-emerald-400 text-center py-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> No weak phrases or length issues detected.
              </p>
            ) : (
              <>
                {weak_lines.slice(0, 5).map((wl, i) => (
                  <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-rose-400 capitalize">{wl.issue_type.replace('_', ' ')}</span>
                      <span>{wl.section}</span>
                    </div>
                    <p className="text-slate-300 italic">"{wl.original_line.slice(0, 100)}..."</p>
                    <p className="text-cyan-300 text-[10px] leading-snug">{wl.recommendation}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Dedicated Targeted Interview Action */}
        {onPracticeWeakSpots && (
          <div className="pt-2.5 border-t border-white/10 mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              Targeted Interview
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onPracticeWeakSpots}
              disabled={isPracticing}
              className="text-xs py-1 px-2.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1"
              title="Start mock interview targeting these resume gaps"
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>{isPracticing ? 'Preparing...' : 'Practice Weak Spots'}</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ATSScorePanel;
